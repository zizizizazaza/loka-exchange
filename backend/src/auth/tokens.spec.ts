import type { Request } from 'express';

import { accessTokenFrom, identityTokenFrom } from './tokens.js';

const req = (headers: Record<string, string> = {}, cookies: Record<string, string> = {}) =>
  ({ headers, cookies }) as unknown as Request;

describe('token extraction', () => {
  it('prefers the Authorization header for the access token', () => {
    expect(accessTokenFrom(req({ authorization: 'Bearer abc' }, { 'privy-token': 'cookie' }))).toBe('abc');
  });

  it('falls back to the privy-token cookie', () => {
    expect(accessTokenFrom(req({}, { 'privy-token': 'cookie' }))).toBe('cookie');
  });

  it('returns null when there is no access token', () => {
    expect(accessTokenFrom(req({ authorization: 'Basic xyz' }))).toBeNull();
    expect(accessTokenFrom(req({ authorization: 'Bearer ' }))).toBeNull();
  });

  it('reads the identity token from the header or cookie', () => {
    expect(identityTokenFrom(req({ 'privy-id-token': 'h' }))).toBe('h');
    expect(identityTokenFrom(req({}, { 'privy-id-token': 'c' }))).toBe('c');
    expect(identityTokenFrom(req())).toBeNull();
  });
});
