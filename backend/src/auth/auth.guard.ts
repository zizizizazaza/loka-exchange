import {
  CanActivate,
  createParamDecorator,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';

import { type AccessClaims, PrivyService } from './privy.service.js';
import { accessTokenFrom } from './tokens.js';

type AuthedRequest = Request & { auth?: AccessClaims };

/** Requires a valid Privy access token and attaches its claims to the request. */
@Injectable()
export class PrivyAuthGuard implements CanActivate {
  constructor(private readonly privy: PrivyService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AuthedRequest>();
    const token = accessTokenFrom(req);
    if (!token) throw new UnauthorizedException({ code: 'NO_TOKEN', message: 'Sign in required' });
    try {
      req.auth = await this.privy.verifyAccessToken(token);
    } catch {
      throw new UnauthorizedException({ code: 'INVALID_TOKEN', message: 'Session is invalid or expired' });
    }
    return true;
  }
}

/** The verified access claims of the current request. Use only behind PrivyAuthGuard. */
export const CurrentAuth = createParamDecorator((_data: unknown, context: ExecutionContext): AccessClaims => {
  const auth = context.switchToHttp().getRequest<AuthedRequest>().auth;
  if (!auth) throw new UnauthorizedException({ code: 'NO_TOKEN', message: 'Sign in required' });
  return auth;
});
