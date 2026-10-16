import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import type { PrivyIdentity } from '../src/auth/identity.js';
import { PrivyService } from '../src/auth/privy.service.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

/**
 * Real Privy tokens only come from a browser login, so this test replaces the token verification step only.
 * Everything else (HTTP, guard, cookies, database) is the real app.
 */
const ALICE = 'did:privy:alice';
const BOB = 'did:privy:bob';
/** A second Privy user carrying Alice's email: what we would see if Privy failed to merge her sign-ins. */
const ALICE_DUPLICATE = 'did:privy:alice-google';
const EXTERNAL = '0xaaaa000000000000000000000000000000000001';
const EMBEDDED = '0xaaaa000000000000000000000000000000000002';

let aliceIdentity: PrivyIdentity;

const fakePrivy = {
  async verifyAccessToken(token: string) {
    if (token === 'access-alice') return { privyDid: ALICE, sessionId: 's-alice' };
    if (token === 'access-bob') return { privyDid: BOB, sessionId: 's-bob' };
    if (token === 'access-alice-google') return { privyDid: ALICE_DUPLICATE, sessionId: 's-dup' };
    throw new Error('invalid');
  },
  async verifyIdentityToken(token: string): Promise<PrivyIdentity> {
    if (token === 'id-alice') return aliceIdentity;
    if (token === 'id-bob') return { privyDid: BOB, email: null, wallets: [] };
    if (token === 'id-alice-google') return { privyDid: ALICE_DUPLICATE, email: 'alice@northwind.example', wallets: [] };
    throw new Error('invalid');
  },
};

describe('Accounts (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrivyService)
      .useValue(fakePrivy)
      .compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
  });

  beforeEach(async () => {
    aliceIdentity = {
      privyDid: ALICE,
      email: 'alice@northwind.example',
      wallets: [
        { address: EXTERNAL, kind: 'EXTERNAL', delegated: false },
        { address: EMBEDDED, kind: 'EMBEDDED', delegated: false },
      ],
    };
    await prisma.$executeRawUnsafe('TRUNCATE users, institutions, wallets, memberships, kyb_cases, audit_logs CASCADE');
  });

  afterAll(async () => {
    await app.close();
  });

  const http = () => request(app.getHttpServer());

  it('rejects requests without a token', async () => {
    const res = await http().get('/api/me').expect(401);
    expect(res.body.code).toBe('NO_TOKEN');
  });

  it('rejects an invalid token', async () => {
    const res = await http().get('/api/me').set('Authorization', 'Bearer forged').expect(401);
    expect(res.body.code).toBe('INVALID_TOKEN');
  });

  it('asks for a session sync before /me works', async () => {
    const res = await http().get('/api/me').set('Authorization', 'Bearer access-alice').expect(404);
    expect(res.body.code).toBe('SESSION_NOT_SYNCED');
  });

  it('requires the identity token to create a session', async () => {
    const res = await http().post('/api/auth/session').set('Authorization', 'Bearer access-alice').expect(400);
    expect(res.body.code).toBe('NO_IDENTITY_TOKEN');
  });

  it('refuses an identity token that belongs to someone else', async () => {
    const res = await http()
      .post('/api/auth/session')
      .set('Authorization', 'Bearer access-alice')
      .set('privy-id-token', 'id-bob')
      .expect(401);
    expect(res.body.code).toBe('TOKEN_MISMATCH');
  });

  it('creates the user and wallets from the identity token, using cookies', async () => {
    const res = await http()
      .post('/api/auth/session')
      .set('Cookie', ['privy-token=access-alice', 'privy-id-token=id-alice'])
      .expect(200);

    expect(res.body.user.email).toBe('alice@northwind.example');
    expect(res.body.accessTier).toBe('unverified');
    expect(res.body.institutions).toEqual([]);
    expect(res.body.wallets).toEqual([
      { address: EXTERNAL, kind: 'EXTERNAL', delegated: false, institutionId: null, whitelisted: false },
      { address: EMBEDDED, kind: 'EMBEDDED', delegated: false, institutionId: null, whitelisted: false },
    ]);

    const me = await http().get('/api/me').set('Authorization', 'Bearer access-alice').expect(200);
    expect(me.body).toEqual(res.body);
  });

  it('is idempotent and drops wallets unlinked in Privy, but keeps whitelisted ones', async () => {
    const sync = () =>
      http().post('/api/auth/session').set('Authorization', 'Bearer access-alice').set('privy-id-token', 'id-alice');
    await sync().expect(200);
    await prisma.wallet.update({ where: { address: EXTERNAL }, data: { whitelistedAt: new Date() } });

    aliceIdentity = { ...aliceIdentity, wallets: [] };
    const res = await sync().expect(200);
    expect(res.body.wallets.map((w: { address: string }) => w.address)).toEqual([EXTERNAL]);
    expect(await prisma.user.count()).toBe(1);
  });

  it('refuses a second Privy user with an email that already has an account', async () => {
    await http()
      .post('/api/auth/session')
      .set('Authorization', 'Bearer access-alice')
      .set('privy-id-token', 'id-alice')
      .expect(200);

    const res = await http()
      .post('/api/auth/session')
      .set('Authorization', 'Bearer access-alice-google')
      .set('privy-id-token', 'id-alice-google')
      .expect(409);
    expect(res.body.code).toBe('EMAIL_IN_USE');
    expect(await prisma.user.count()).toBe(1);
    expect(await prisma.auditLog.count({ where: { action: 'auth.email_held_by_other_privy_user' } })).toBe(1);
  });

  it('reports the access tier from the institution KYB status', async () => {
    await http()
      .post('/api/auth/session')
      .set('Authorization', 'Bearer access-alice')
      .set('privy-id-token', 'id-alice')
      .expect(200);
    const user = await prisma.user.findUniqueOrThrow({ where: { privyDid: ALICE } });
    const institution = await prisma.institution.create({
      data: { name: 'Northwind Capital', members: { create: { userId: user.id, role: 'ADMIN' } } },
    });

    await prisma.kybCase.create({ data: { institutionId: institution.id, provider: 'idanalyzer', status: 'SUBMITTED' } });
    let me = await http().get('/api/me').set('Authorization', 'Bearer access-alice').expect(200);
    expect(me.body.accessTier).toBe('pending');
    expect(me.body.institutions).toEqual([
      { id: institution.id, name: 'Northwind Capital', role: 'ADMIN', kybStatus: 'SUBMITTED' },
    ]);

    await prisma.kybCase.update({ where: { institutionId: institution.id }, data: { status: 'APPROVED' } });
    me = await http().get('/api/me').set('Authorization', 'Bearer access-alice').expect(200);
    expect(me.body.accessTier).toBe('verified');
  });
});
