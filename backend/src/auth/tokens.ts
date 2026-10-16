import type { Request } from 'express';

/**
 * Privy sends tokens either as cookies (when the frontend uses HTTP-only cookies) or as headers.
 * Access token: `Authorization: Bearer <token>` or cookie `privy-token`.
 * Identity token: header `privy-id-token` or cookie `privy-id-token`.
 */
export function accessTokenFrom(req: Request): string | null {
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) return header.slice('Bearer '.length).trim() || null;
  return cookie(req, 'privy-token');
}

export function identityTokenFrom(req: Request): string | null {
  const header = req.headers['privy-id-token'];
  if (typeof header === 'string' && header) return header;
  return cookie(req, 'privy-id-token');
}

function cookie(req: Request, name: string): string | null {
  const value = (req.cookies as Record<string, unknown> | undefined)?.[name];
  return typeof value === 'string' && value ? value : null;
}
