import {
  BadRequestException,
  ConflictException,
  Controller,
  Get,
  HttpCode,
  NotFoundException,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';

import { CurrentAuth, PrivyAuthGuard } from '../auth/auth.guard.js';
import type { PrivyIdentity } from '../auth/identity.js';
import { type AccessClaims, PrivyService } from '../auth/privy.service.js';
import { identityTokenFrom } from '../auth/tokens.js';
import { AccountsService, EmailInUseError } from './accounts.service.js';

@Controller()
@UseGuards(PrivyAuthGuard)
export class AccountsController {
  constructor(
    private readonly accounts: AccountsService,
    private readonly privy: PrivyService,
  ) {}

  /**
   * Called by the frontend after every Privy login, and again after linking a wallet.
   * Needs both tokens: the access token proves who is calling, the identity token carries their wallets.
   */
  @Post('auth/session')
  @HttpCode(200)
  async session(@CurrentAuth() auth: AccessClaims, @Req() req: Request) {
    const token = identityTokenFrom(req);
    if (!token) throw new BadRequestException({ code: 'NO_IDENTITY_TOKEN', message: 'Identity token required' });

    let identity: PrivyIdentity;
    try {
      identity = await this.privy.verifyIdentityToken(token);
    } catch {
      throw new UnauthorizedException({ code: 'INVALID_IDENTITY_TOKEN', message: 'Identity token is invalid' });
    }
    if (identity.privyDid !== auth.privyDid) {
      throw new UnauthorizedException({ code: 'TOKEN_MISMATCH', message: 'Tokens belong to different users' });
    }

    try {
      await this.accounts.syncFromIdentity(identity);
    } catch (error) {
      if (error instanceof EmailInUseError) {
        throw new ConflictException({
          code: 'EMAIL_IN_USE',
          message: 'This email already has an account. Sign in the way you did before.',
        });
      }
      throw error;
    }
    return this.accounts.profile(auth.privyDid);
  }

  @Get('me')
  async me(@CurrentAuth() auth: AccessClaims) {
    const profile = await this.accounts.profile(auth.privyDid);
    if (!profile) throw new NotFoundException({ code: 'SESSION_NOT_SYNCED', message: 'Call POST /auth/session first' });
    return profile;
  }
}
