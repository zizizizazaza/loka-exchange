import { useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';

import { useDemo } from '../demo/state';
import { useApi, useUpload } from '../session/api';
import type { ApiError } from '../session/types';
import {
  fromView,
  getKyb,
  type KybStep,
  type KybView,
  resetKyb,
  setKyb,
  simulateCompanyCheck,
  simulateIdCheck,
  toDraft,
} from './store';

/** Messages for the backend's submission problems (backend/src/kyb/draft.ts and kyb.service.ts). */
const PROBLEMS: Record<string, string> = {
  COMPANY_INCOMPLETE: 'Complete the company details',
  COMPANY_NOT_CHECKED: 'Upload the registration certificate',
  COMPANY_REJECTED: 'The certificate was not accepted; upload another',
  APPLICANT_INCOMPLETE: 'Complete your details',
  APPLICANT_NOT_VERIFIED: 'Verify your ID with the name and birth date in the form',
  PEOPLE_INCOMPLETE: 'Complete every director and owner',
  PERSON_NOT_NEEDED: 'Only list directors and owners of 25% or more',
  OWNERSHIP_OVER_100: 'Ownership adds up to more than 100%',
  OWNERS_NOT_DECLARED: 'Confirm the list of directors and owners',
  NO_WALLET: 'Choose an investing address',
  WALLET_NOT_USABLE: 'One of the investing addresses cannot be used',
  NO_TREASURY: 'Enter the withdrawal address',
  NOT_DECLARED: 'Confirm both declarations',
};

export function errorText(e: unknown): string {
  const err = e as Partial<ApiError>;
  if (err.problems?.length) return PROBLEMS[err.problems[0]] ?? err.message ?? 'Something went wrong';
  // The provider's own code (e.g. out of credits, key not allowed) helps while testing.
  const code = err.providerCode && import.meta.env.DEV ? ` (${err.providerCode})` : '';
  return (err.message ?? 'Something went wrong. Try again.') + code;
}

/**
 * What the verification steps can do. Live when signed in for real (not previewing); then every action goes to the
 * backend and the form is refreshed from its answer. Otherwise the checks are simulated in the browser.
 */
export function useKybActions() {
  const { signedIn, preview } = useDemo();
  const api = useApi();
  const upload = useUpload();
  const queryClient = useQueryClient();
  const live = signedIn && !preview;

  return useMemo(() => {
    const apply = (v: KybView) => setKyb(() => fromView(v));
    const save = () => (live ? api<KybView>('/kyb/draft', { method: 'PUT', json: toDraft(getKyb()) }) : Promise.resolve(null));

    return {
      live,

      /** Live: loads the case from the backend. */
      async load() {
        if (live) apply(await api<KybView>('/kyb'));
      },

      /** Moves to another step, saving the form first. */
      async go(step: KybStep) {
        setKyb((s) => ({ ...s, step }));
        await save();
      },

      /**
       * Live: sends the certificate to the provider (10 credits). `onProgress` follows the upload (0 to 1), after
       * which the provider reads it. Demo: `found` picks the sample outcome.
       */
      async uploadCertificate(file: File, onProgress: (sent: number) => void, found = true) {
        setKyb((s) => ({ ...s, company: { ...s.company, doc: file.name }, check: null }));
        if (!live) {
          onProgress(1);
          return simulateCompanyCheck(found);
        }
        await save();
        const form = new FormData();
        form.append('document', file);
        apply(await upload<KybView>('/kyb/company', form, onProgress));
      },

      /** Live: returns the DocuPass link to embed. Demo: simulates the check and returns null. */
      async startIdCheck(): Promise<string | null> {
        if (!live) {
          await simulateIdCheck();
          return null;
        }
        await save();
        const session = await api<{ url: string }>('/kyb/applicant/session', { method: 'POST' });
        setKyb((s) => ({ ...s, applicant: { ...s.applicant, id: 'checking' } }));
        return session.url;
      },

      /** Live: asks the backend for the session result (it polls the provider). */
      async pollIdCheck() {
        if (live) apply(await api<KybView>('/kyb/applicant'));
      },

      async submit() {
        if (!live) {
          setKyb((s) => ({ ...s, step: 'submitted', submittedAt: new Date().toISOString().slice(0, 10) }));
          return;
        }
        await save();
        apply(await api<KybView>('/kyb/submit', { method: 'POST' }));
        // The header and the access dialog follow the session's tier, which is now "in review".
        await queryClient.invalidateQueries({ queryKey: ['session'] });
      },

      /** Demo, or live in development only (the backend refuses it in production). */
      async reset() {
        if (!live) return resetKyb();
        apply(await api<KybView>('/kyb', { method: 'DELETE' }));
        await queryClient.invalidateQueries({ queryKey: ['session'] });
      },
    };
  }, [live, api, upload, queryClient]);
}
