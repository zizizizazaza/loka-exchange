import { Injectable } from '@nestjs/common';

import type { PrivyIdentity } from '../auth/identity.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { tierFor } from './access-tier.js';

/** The email is already held by a different Privy user. */
export class EmailInUseError extends Error {
  constructor() {
    super('Email belongs to another account');
  }
}

@Injectable()
export class AccountsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Creates or updates the user and their wallets from a verified identity token.
   * Wallets unlinked in Privy are dropped, except whitelisted ones: removing those is a compliance action.
   */
  async syncFromIdentity(identity: PrivyIdentity) {
    if (identity.email) {
      const holder = await this.prisma.user.findUnique({ where: { email: identity.email } });
      if (holder && holder.privyDid !== identity.privyDid) {
        // Privy should have merged these sign-ins into one user. Merging here would leave the person with two
        // embedded wallets, so refuse and let them sign in the way they did before.
        await this.prisma.auditLog.create({
          data: {
            actorUserId: holder.id,
            action: 'auth.email_held_by_other_privy_user',
            target: identity.email,
            detail: { existingPrivyDid: holder.privyDid, newPrivyDid: identity.privyDid },
          },
        });
        throw new EmailInUseError();
      }
    }

    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.upsert({
        where: { privyDid: identity.privyDid },
        create: { privyDid: identity.privyDid, email: identity.email },
        update: { email: identity.email },
      });

      for (const wallet of identity.wallets) {
        const existing = await tx.wallet.findUnique({ where: { address: wallet.address } });
        if (existing && existing.userId !== user.id) {
          // Privy links a wallet to one user only, so this means our records are stale. Keep the owner, log it.
          await tx.auditLog.create({
            data: {
              actorUserId: user.id,
              action: 'wallet.link_conflict',
              target: wallet.address,
              detail: { currentOwnerUserId: existing.userId },
            },
          });
          continue;
        }
        await tx.wallet.upsert({
          where: { address: wallet.address },
          create: { address: wallet.address, kind: wallet.kind, delegated: wallet.delegated, userId: user.id },
          update: { kind: wallet.kind, delegated: wallet.delegated },
        });
      }

      await tx.wallet.deleteMany({
        where: {
          userId: user.id,
          address: { notIn: identity.wallets.map((w) => w.address) },
          whitelistedAt: null,
        },
      });
      return user;
    });
  }

  /** What the app shows about the signed-in user; null if they have not synced a session yet. */
  async profile(privyDid: string) {
    const user = await this.prisma.user.findUnique({
      where: { privyDid },
      include: {
        wallets: { orderBy: { createdAt: 'asc' } },
        memberships: { include: { institution: { include: { kybCase: true } } } },
      },
    });
    if (!user) return null;

    const institutions = user.memberships.map((m) => ({
      id: m.institution.id,
      name: m.institution.name,
      role: m.role,
      kybStatus: m.institution.kybCase?.status ?? 'NOT_STARTED',
    }));
    return {
      user: { id: user.id, email: user.email },
      wallets: user.wallets.map((w) => ({
        address: w.address,
        kind: w.kind,
        delegated: w.delegated,
        institutionId: w.institutionId,
        whitelisted: w.whitelistedAt !== null,
      })),
      institutions,
      accessTier: tierFor(institutions.map((i) => i.kybStatus)),
    };
  }
}
