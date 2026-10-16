import type { KybStatus } from '../generated/prisma/enums.js';

/**
 * The four states of the prototype's access switcher (docs/kyb.md section 2).
 * `public` is a request without a valid session; the other three come from the institutions' KYB cases.
 */
export type AccessTier = 'public' | 'unverified' | 'pending' | 'verified';

const PENDING: readonly KybStatus[] = ['SUBMITTED', 'INFO_REQUESTED'];

/** A signed-in user's tier: verified if any of their institutions is approved, pending if any is in review. */
export function tierFor(statuses: readonly KybStatus[]): Exclude<AccessTier, 'public'> {
  if (statuses.includes('APPROVED')) return 'verified';
  if (statuses.some((s) => PENDING.includes(s))) return 'pending';
  return 'unverified';
}
