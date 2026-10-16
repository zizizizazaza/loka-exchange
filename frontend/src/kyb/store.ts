import { useSyncExternalStore } from 'react';

/**
 * Business verification (KYB) form state, shared by the steps under src/pages/verify.
 *
 * Two modes (src/kyb/actions.ts picks one):
 * - live: signed in for real. The form is loaded from and saved to the backend (GET/PUT /api/kyb), and the checks
 *   are real ID Analyzer calls (backend/docs/kyb.md). Nothing is kept in the browser.
 * - demo: the development "view as" preview. Checks are simulated with the same shapes, saved in the browser.
 *
 * Who does what, modelled on Stripe's business onboarding:
 * - the applicant verifies their own ID with a selfie, in the page;
 * - directors and owners of 25% or more are entered by the applicant; after submission the backend screens their
 *   names (sanctions, PEP) for the reviewer, without holding up the applicant;
 * - the platform asks one of them to verify their ID only if screening or review calls for it.
 */

export type KybStep = 'company' | 'you' | 'owners' | 'wallets' | 'review' | 'submitted';
export type KybMode = 'demo' | 'live';

export interface CompanyCheck {
  found: boolean;
  decision: 'ACCEPT' | 'REVIEW' | 'REJECT';
  warnings: { code: string; description?: string }[];
  status: string;
  incorporated: string;
  /** Directors read from the certificate, used to prefill the owners step. */
  officers: string[];
}

export interface Applicant {
  name: string;
  title: string;
  dob: string;
  nationality: string;
  director: boolean;
  /** Share of the company, as typed. Empty when the applicant owns none. */
  ownership: string;
  /** checking: a session is open; review: done, a reviewer looks at it; failed: rejected, try again. */
  id: 'none' | 'checking' | 'verified' | 'review' | 'failed';
}

export interface KybPerson {
  key: string;
  name: string;
  director: boolean;
  ownership: string;
  dob: string;
  nationality: string;
  /** Named on the certificate, so the name is fixed. */
  fromRegistry: boolean;
}

export interface KybState {
  step: KybStep;
  company: {
    legalName: string;
    type: string;
    country: string;
    regNo: string;
    address: string;
    business: string;
    website: string;
    /** The certificate's file name. POST /kyb needs the file and reads the other registry fields from it. */
    doc: string | null;
  };
  check: CompanyCheck | null;
  applicant: Applicant;
  people: KybPerson[];
  /** "No one else owns 25% or more, and these are all the directors." */
  ownersComplete: boolean;
  wallets: string[];
  treasury: string;
  declarations: { accurate: boolean; controls: boolean };
  /** What the applicant's passed ID check read from the document. These fields are not editable. */
  fromId: IdDetails | null;
  submittedAt: string | null;
}

export interface IdDetails {
  name: string;
  dob: string;
  nationality: string;
}

const KEY = 'loka-kyb-demo-v4';
/** Owners at or above this share are listed and screened (to be confirmed by compliance). */
export const OWNER_THRESHOLD = 25;

export const EMPTY: KybState = {
  step: 'company',
  company: { legalName: '', type: '', country: '', regNo: '', address: '', business: '', website: '', doc: null },
  check: null,
  applicant: { name: '', title: '', dob: '', nationality: '', director: false, ownership: '', id: 'none' },
  people: [],
  ownersComplete: false,
  wallets: [],
  treasury: '',
  declarations: { accurate: false, controls: false },
  fromId: null,
  submittedAt: null,
};

function load(): KybState {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const s = { ...EMPTY, ...(JSON.parse(raw) as KybState) };
      // A check interrupted by a reload never finishes; let the applicant start it again.
      return s.applicant.id === 'checking' ? { ...s, applicant: { ...s.applicant, id: 'none' } } : s;
    }
  } catch {
    // Storage blocked or corrupt: start fresh.
  }
  return EMPTY;
}

let mode: KybMode = 'demo';
let state = load();
const listeners = new Set<() => void>();

function emit() {
  if (mode === 'demo') {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch {
      // Storage blocked: progress lasts for this page only.
    }
  }
  listeners.forEach((l) => l());
}

/** Switches between the backend and the browser-only demo. The form starts over from the new source. */
export function setKybMode(next: KybMode) {
  if (next === mode) return;
  mode = next;
  state = next === 'live' ? EMPTY : load();
  listeners.forEach((l) => l());
}

export const getKyb = () => state;

export function setKyb(f: (s: KybState) => KybState) {
  state = f(state);
  emit();
}

export function resetKyb() {
  state = EMPTY;
  emit();
}

export function useKyb() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
  );
}

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/** The registry row that is the applicant, if any: they verified their ID already, so they are not listed again. */
export const isApplicant = (p: KybPerson, a: Applicant) => !!a.name.trim() && same(p.name, a.name);

export const pctOf = (v: string) => {
  const n = Number(v);
  return v.trim() && Number.isFinite(n) ? n : 0;
};

/** Directors and owners of 25% or more are listed; anyone else does not need to be. */
export const needsListing = (director: boolean, ownership: string) => director || pctOf(ownership) >= OWNER_THRESHOLD;

export const isAddress = (a: string) => /^0x[0-9a-fA-F]{40}$/.test(a.trim());

/* ---------- Live mode: mapping to and from the backend (backend/src/kyb) ---------- */

/** GET /api/kyb and the other KYB endpoints return this. */
export interface KybView {
  status: 'NOT_STARTED' | 'IN_PROGRESS' | 'SUBMITTED' | 'INFO_REQUESTED' | 'APPROVED' | 'REJECTED' | 'SUSPENDED';
  submittedAt: string | null;
  draft: KybDraft | null;
  company: {
    decision: CompanyCheck['decision'];
    warnings: CompanyCheck['warnings'];
    registry: { found: boolean } | null;
    status: string;
    incorporated: string;
    directors: string[];
  } | null;
  applicant: { status: 'pending' | 'expired' | 'accept' | 'review' | 'reject'; fromId: IdDetails | null } | null;
}

/** The form as the backend stores it (backend/src/kyb/draft.ts). */
export interface KybDraft {
  step: KybStep;
  company: KybState['company'];
  applicant: Omit<Applicant, 'id'>;
  people: KybPerson[];
  ownersComplete: boolean;
  wallets: string[];
  treasury: string;
  declarations: KybState['declarations'];
}

export function toDraft(s: KybState): KybDraft {
  const a = s.applicant;
  return {
    step: s.step,
    company: s.company,
    applicant: { name: a.name, title: a.title, dob: a.dob, nationality: a.nationality, director: a.director, ownership: a.ownership },
    people: s.people.map((p) => ({
      key: p.key,
      name: p.name,
      director: p.director,
      ownership: p.ownership,
      dob: p.dob,
      nationality: p.nationality,
      fromRegistry: p.fromRegistry,
    })),
    ownersComplete: s.ownersComplete,
    wallets: s.wallets,
    treasury: s.treasury,
    declarations: s.declarations,
  };
}

export function fromView(v: KybView): KybState {
  const d = v.draft;
  if (!d) return EMPTY;
  const status = v.applicant?.status;
  const id: Applicant['id'] =
    status === 'accept'
      ? 'verified'
      : status === 'review'
        ? 'review'
        : status === 'reject'
          ? 'failed'
          : status === 'pending'
            ? 'checking'
            : 'none';
  return {
    step: v.status === 'SUBMITTED' || v.status === 'INFO_REQUESTED' ? 'submitted' : d.step,
    company: d.company,
    check: v.company
      ? {
          found: !!v.company.registry?.found,
          decision: v.company.decision,
          warnings: v.company.warnings,
          status: v.company.status,
          incorporated: v.company.incorporated,
          officers: v.company.directors,
        }
      : null,
    applicant: { ...d.applicant, id },
    people: d.people,
    ownersComplete: d.ownersComplete,
    wallets: d.wallets,
    treasury: d.treasury,
    declarations: d.declarations,
    fromId: v.applicant?.fromId ?? null,
    submittedAt: v.submittedAt ? v.submittedAt.slice(0, 10) : null,
  };
}

/* ---------- Demo mode: simulated checks ---------- */

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Stands in for POST /kyb, which takes only the certificate: the company details and its directors are read from it,
 * then matched against the registry. `found: false` plays a company with no online registry, checked by hand in review.
 */
export async function simulateCompanyCheck(found = true) {
  await wait(1600);
  const officers = ['Sarah Lin', 'Michael Okafor'];
  setKyb((s) => ({
    ...s,
    company: {
      ...s.company,
      legalName: 'Northwind Capital Pte. Ltd.',
      regNo: '201912345K',
      country: 'Singapore',
      address: '1 Raffles Place, #20-01, Singapore 048616',
    },
    check: {
      found,
      decision: found ? 'ACCEPT' : 'REVIEW',
      warnings: found ? [] : [{ code: 'BUSINESS_NOT_FOUND' }],
      status: found ? 'Active' : '',
      incorporated: '2019-04-11',
      officers,
    },
    people: officers.map((name, i) => ({
      key: 'r' + i,
      name,
      director: true,
      ownership: '',
      dob: '',
      nationality: '',
      fromRegistry: true,
    })),
    ownersComplete: false,
  }));
}

/** Stands in for an embedded DocuPass session: ID document, selfie and liveness, read a few seconds later. */
export async function simulateIdCheck() {
  setKyb((s) => ({ ...s, applicant: { ...s.applicant, id: 'checking' } }));
  await wait(2500);
  const fromId = { name: 'Michael Okafor', dob: '1982-03-14', nationality: 'United Kingdom' };
  setKyb((s) => ({ ...s, fromId, applicant: { ...s.applicant, ...fromId, id: 'verified' } }));
}
