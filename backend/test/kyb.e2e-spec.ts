import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import type { PrivyIdentity } from '../src/auth/identity.js';
import { PrivyService } from '../src/auth/privy.service.js';
import {
  type CompanyCheckResult,
  KYB_PROVIDER,
  type KybProvider,
  type PersonSessionResult,
  ProviderError,
} from '../src/kyb/provider.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

/**
 * The KYB flow against the real app and database. Privy token checks and the verification provider are replaced:
 * real provider calls cost credits and need a person in front of a camera.
 */
const ALICE = 'did:privy:alice';
const WALLET = '0xaaaa000000000000000000000000000000000001';
const DELEGATED = '0xaaaa000000000000000000000000000000000002';
const TREASURY = '0x9f2b1c77ad3e5b6c8f0a41de2b7c9a10e3d4f512';

const identity: PrivyIdentity = {
  privyDid: ALICE,
  email: 'michael@northwind.example',
  wallets: [
    { address: WALLET, kind: 'EXTERNAL', delegated: false },
    { address: DELEGATED, kind: 'EMBEDDED', delegated: true },
  ],
};

const fakePrivy = {
  async verifyAccessToken(token: string) {
    if (token === 'access-alice') return { privyDid: ALICE, sessionId: 's-alice' };
    throw new Error('invalid');
  },
  async verifyIdentityToken(token: string) {
    if (token === 'id-alice') return identity;
    throw new Error('invalid');
  },
};

/** What the applicant's ID says. */
const FROM_ID = { name: 'Michael Okafor', dob: '1982-03-14', nationality: 'United Kingdom' };

const companyResult: CompanyCheckResult = {
  transactionId: 'tx-company',
  decision: 'accept',
  warnings: [],
  registry: { found: true, active: true, source: 'official_registry', legalName: 'NORTHWIND CAPITAL PTE. LTD.', status: 'active' },
  company: {
    legalName: 'Northwind Capital Pte. Ltd.',
    registrationNumber: '201912345K',
    country: 'SG',
    address: '1 Raffles Place, Singapore, 048616',
    incorporationDate: '2019-04-11',
    entityType: 'Private Company',
    status: 'active',
  },
  principals: [
    { name: 'Sarah Lin', role: 'director', ownershipPercent: null },
    { name: 'Michael Okafor', role: 'director', ownershipPercent: null },
    { name: 'Michael Okafor', role: 'shareholder', ownershipPercent: 35 },
    { name: 'Daniel Weiss', role: 'shareholder', ownershipPercent: 8 },
    { name: 'Priya Raman', role: 'authorized_signatory', ownershipPercent: null },
  ],
};

class FakeProvider implements KybProvider {
  name = 'fake';
  sessionsCreated = 0;
  sessionResult: PersonSessionResult = { status: 'pending', transactionId: null, warnings: [], person: null };
  failNext = false;
  /** Plays a free account, where ID Analyzer refuses /amlv3. */
  amlRefused = false;

  async verifyCompany() {
    if (this.failNext) {
      this.failNext = false;
      throw new ProviderError(500, 'ERROR_INTERNAL', 'boom');
    }
    return companyResult;
  }

  async createPersonSession() {
    this.sessionsCreated += 1;
    return {
      reference: `ref-${this.sessionsCreated}`,
      url: `https://docupass.test/ref-${this.sessionsCreated}`,
      qrCode: null,
      expiresAt: new Date(Date.now() + 86_400_000),
    };
  }

  async getPersonSession() {
    return this.sessionResult;
  }

  async searchAml(name: string) {
    if (this.amlRefused) throw new ProviderError(422, 'ERROR_OPERATION_FAILED', 'This service is available for paid customer only.');
    return name === 'Sarah Lin'
      ? [{ id: 'aml-1', names: ['LIN, Sarah'], birthDates: [], countries: ['sg'], topics: ['role.pep'], score: 3 }]
      : [{ id: 'aml-2', names: ['Michaela Okafor'], birthDates: [], countries: [], topics: ['sanction'], score: 1 }];
  }
}

const provider = new FakeProvider();

describe('KYB (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrivyService)
      .useValue(fakePrivy)
      .overrideProvider(KYB_PROVIDER)
      .useValue(provider)
      .compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
  });

  beforeEach(async () => {
    provider.sessionsCreated = 0;
    provider.sessionResult = { status: 'pending', transactionId: null, warnings: [], person: null };
    provider.amlRefused = false;
    await prisma.$executeRawUnsafe('TRUNCATE users, institutions, wallets, memberships, kyb_cases, audit_logs CASCADE');
    await http().post('/api/auth/session').set(auth).set('privy-id-token', 'id-alice').expect(200);
  });

  afterAll(async () => {
    await app.close();
  });

  const auth = { Authorization: 'Bearer access-alice' };
  const http = () => request(app.getHttpServer());
  const upload = () =>
    http()
      .post('/api/kyb/company')
      .set(auth)
      .attach('document', Buffer.from('%PDF-1.4 test'), { filename: 'certificate.pdf', contentType: 'application/pdf' });

  /** Uploads the certificate and fills in everything the applicant types (their name and birth date come from the ID). */
  async function fillForm() {
    const res = await upload().expect(200);
    const draft = res.body.draft;
    draft.company = { ...draft.company, type: 'Private credit fund', business: 'Credit fund' };
    draft.applicant = { ...draft.applicant, title: 'CFO', director: true, ownership: '35' };
    draft.people = draft.people.map((p: { key: string }) =>
      p.key === 'r0' ? { ...p, dob: '1975-08-02', nationality: 'Singaporean' } : p,
    );
    draft.ownersComplete = true;
    draft.wallets = [WALLET];
    draft.treasury = TREASURY;
    draft.declarations = { accurate: true, controls: true };
    await http().put('/api/kyb/draft').set(auth).send(draft).expect(200);
    return draft;
  }

  async function verifyApplicant() {
    await http().post('/api/kyb/applicant/session').set(auth).expect(200);
    provider.sessionResult = { status: 'accept', transactionId: 'tx-id', warnings: [], person: FROM_ID };
    return http().get('/api/kyb/applicant').set(auth).expect(200);
  }

  it('starts empty', async () => {
    const res = await http().get('/api/kyb').set(auth).expect(200);
    expect(res.body).toMatchObject({ status: 'NOT_STARTED', draft: null, company: null });
  });

  it('reads the certificate and prefills the form', async () => {
    const res = await upload().expect(200);
    expect(res.body.status).toBe('IN_PROGRESS');
    expect(res.body.draft.company).toMatchObject({
      legalName: 'Northwind Capital Pte. Ltd.',
      regNo: '201912345K',
      country: 'Singapore',
      doc: 'certificate.pdf',
    });
    // Directors and owners of 25% or more; the 8% shareholder and the signatory are not listed.
    expect(res.body.draft.people).toEqual([
      expect.objectContaining({ key: 'r0', name: 'Sarah Lin', director: true, fromRegistry: true }),
      expect.objectContaining({ key: 'r1', name: 'Michael Okafor', director: true, ownership: '35' }),
    ]);
    expect(res.body.company).toMatchObject({ decision: 'ACCEPT', status: 'active', directors: ['Sarah Lin', 'Michael Okafor'] });

    const me = await http().get('/api/me').set(auth).expect(200);
    expect(me.body.institutions[0]).toMatchObject({ role: 'ADMIN', kybStatus: 'IN_PROGRESS' });
    expect(me.body.accessTier).toBe('unverified');
  });

  it('refuses other file types', async () => {
    const res = await http()
      .post('/api/kyb/company')
      .set(auth)
      .attach('document', Buffer.from('hello'), { filename: 'note.txt', contentType: 'text/plain' })
      .expect(400);
    expect(res.body.code).toBe('BAD_DOCUMENT_TYPE');
  });

  it('reports a provider failure as 502', async () => {
    provider.failNext = true;
    const res = await upload().expect(502);
    expect(res.body.code).toBe('PROVIDER_ERROR');
  });

  it('reuses an open ID session', async () => {
    await fillForm();
    const a = await http().post('/api/kyb/applicant/session').set(auth).expect(200);
    const b = await http().post('/api/kyb/applicant/session').set(auth).expect(200);
    expect(b.body.url).toBe(a.body.url);
    expect(provider.sessionsCreated).toBe(1);
  });

  it('polls the ID session and fills the applicant from the ID', async () => {
    await fillForm();
    await http().post('/api/kyb/applicant/session').set(auth).expect(200);
    let res = await http().get('/api/kyb/applicant').set(auth).expect(200);
    expect(res.body.applicant).toEqual({ status: 'pending', fromId: null });
    expect(res.body.draft.applicant.name).toBe('');

    provider.sessionResult = { status: 'review', transactionId: 'tx-id', warnings: [{ code: 'FACE_MISMATCH' }], person: FROM_ID };
    res = await http().get('/api/kyb/applicant').set(auth).expect(200);
    expect(res.body.applicant).toEqual({ status: 'review', fromId: FROM_ID });
    expect(res.body.draft.applicant).toMatchObject({ ...FROM_ID, title: 'CFO' });

    // The verified details cannot be changed by saving the form.
    const draft = res.body.draft;
    draft.applicant = { ...draft.applicant, name: 'Someone Else', dob: '1990-01-01' };
    res = await http().put('/api/kyb/draft').set(auth).send(draft).expect(200);
    expect(res.body.draft.applicant).toMatchObject({ name: 'Michael Okafor', dob: '1982-03-14' });
  });

  /** Screening results the reviewer will see, by person. */
  async function screening() {
    const rows = await prisma.kybCheck.findMany({ where: { kind: 'SCREENING' }, orderBy: { personKey: 'asc' } });
    return rows.map((r) => ({ key: r.personKey, name: r.personName, decision: r.decision, status: (r.result as { status: string }).status }));
  }

  it('runs the whole flow to submission, then screens the names', async () => {
    await fillForm();
    await verifyApplicant();

    const res = await http().post('/api/kyb/submit').set(auth).expect(200);
    expect(res.body).toMatchObject({ status: 'SUBMITTED', draft: { step: 'submitted' } });
    expect(res.body).not.toHaveProperty('screening');
    expect(await screening()).toEqual([
      { key: 'applicant', name: 'Michael Okafor', decision: 'ACCEPT', status: 'clear' },
      { key: 'r0', name: 'Sarah Lin', decision: 'REVIEW', status: 'possible_match' },
    ]);

    const me = await http().get('/api/me').set(auth).expect(200);
    expect(me.body.accessTier).toBe('pending');
    expect(me.body.institutions[0].name).toBe('Northwind Capital Pte. Ltd.');
    expect(me.body.wallets.find((w: { address: string }) => w.address === WALLET).institutionId).toBe(me.body.institutions[0].id);

    const locked = await http().put('/api/kyb/draft').set(auth).send({}).expect(409);
    expect(locked.body.code).toBe('CASE_LOCKED');
  });

  it('submits even when the names cannot be screened', async () => {
    provider.amlRefused = true;
    await fillForm();
    await verifyApplicant();
    const res = await http().post('/api/kyb/submit').set(auth).expect(200);
    expect(res.body.status).toBe('SUBMITTED');
    expect(await screening()).toEqual([
      { key: 'applicant', name: 'Michael Okafor', decision: null, status: 'not_screened' },
      { key: 'r0', name: 'Sarah Lin', decision: null, status: 'not_screened' },
    ]);
  });

  it('refuses to submit without an ID check', async () => {
    const draft = await fillForm();
    draft.applicant = { ...draft.applicant, ...FROM_ID };
    await http().put('/api/kyb/draft').set(auth).send(draft).expect(200);
    const res = await http().post('/api/kyb/submit').set(auth).expect(400);
    expect(res.body.problems).toEqual(['APPLICANT_NOT_VERIFIED']);
  });

  it('refuses a wallet the applicant cannot use', async () => {
    await fillForm();
    await verifyApplicant();
    const { body } = await http().get('/api/kyb').set(auth).expect(200);
    const draft = body.draft;
    draft.wallets = [WALLET, DELEGATED];
    await http().put('/api/kyb/draft').set(auth).send(draft).expect(200);

    const res = await http().post('/api/kyb/submit').set(auth).expect(400);
    expect(res.body.problems).toEqual(['WALLET_NOT_USABLE']);
  });

  it('can start over in development', async () => {
    await fillForm();
    await http().delete('/api/kyb').set(auth).expect(200);
    const res = await http().get('/api/kyb').set(auth).expect(200);
    expect(res.body.status).toBe('NOT_STARTED');
    expect(await prisma.institution.count()).toBe(0);
  });
});
