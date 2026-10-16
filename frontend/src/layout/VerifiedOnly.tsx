import type { ReactNode } from 'react';

import { useDemo } from '../demo/state';
import { Onboard } from '../pages/Onboard';

/** Portfolio and Deposit show the onboarding steps until the account is verified, as in the prototype. */
export function VerifiedOnly({ page, children }: { page: 'portfolio' | 'deposit'; children: ReactNode }) {
  const { ok } = useDemo();
  return ok ? children : <Onboard page={page} />;
}
