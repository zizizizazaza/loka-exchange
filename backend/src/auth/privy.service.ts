import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrivyClient } from '@privy-io/node';

import type { Env } from '../config/env.js';
import { type PrivyIdentity, toIdentity } from './identity.js';

export interface AccessClaims {
  privyDid: string;
  sessionId: string;
}

/** Verifies the two tokens Privy issues to the frontend. Both throw when the token is invalid or expired. */
@Injectable()
export class PrivyService {
  private readonly client: PrivyClient;

  constructor(config: ConfigService<Env, true>) {
    this.client = new PrivyClient({
      appId: config.get('PRIVY_APP_ID', { infer: true }),
      appSecret: config.get('PRIVY_APP_SECRET', { infer: true }),
      jwtVerificationKey: config.get('PRIVY_VERIFICATION_KEY', { infer: true }),
    });
  }

  /** Access token: proves who is calling. */
  async verifyAccessToken(token: string): Promise<AccessClaims> {
    const claims = await this.client.utils().auth().verifyAccessToken(token);
    return { privyDid: claims.user_id, sessionId: claims.session_id };
  }

  /** Identity token: carries the user's linked email and wallets, signed by Privy. */
  async verifyIdentityToken(token: string): Promise<PrivyIdentity> {
    return toIdentity(await this.client.utils().auth().verifyIdentityToken(token));
  }
}
