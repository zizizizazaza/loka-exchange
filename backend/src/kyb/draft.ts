import { z } from 'zod';

/**
 * The KYB form as the applicant saves it (frontend/src/kyb/store.ts has the same shape).
 * Saving is lenient so a half-filled form can be kept; `submitProblems` is the strict check at submission.
 */

/** Owners at or above this share are listed and screened (docs/kyb.md; to be confirmed by compliance). */
export const OWNER_THRESHOLD = 25;

const text = (max = 200) => z.string().trim().max(max).default('');
const date = z.union([z.literal(''), z.iso.date()]).default('');
const percent = z.union([z.literal(''), z.string().regex(/^\d{1,3}(\.\d{1,2})?$/)]).default('');

export const draftSchema = z.object({
  step: z.enum(['company', 'you', 'owners', 'wallets', 'review', 'submitted']).default('company'),
  company: z
    .object({
      legalName: text(),
      type: text(60),
      country: text(60),
      regNo: text(60),
      address: text(300),
      business: text(500),
      website: text(200),
      doc: z.string().max(200).nullable().default(null),
    })
    .prefault({}),
  applicant: z
    .object({
      name: text(),
      title: text(100),
      dob: date,
      nationality: text(60),
      director: z.boolean().default(false),
      ownership: percent,
    })
    .prefault({}),
  people: z
    .array(
      z.object({
        key: z.string().min(1).max(40),
        name: text(),
        director: z.boolean().default(false),
        ownership: percent,
        dob: date,
        nationality: text(60),
        fromRegistry: z.boolean().default(false),
      }),
    )
    .max(30)
    .default([]),
  ownersComplete: z.boolean().default(false),
  wallets: z
    .array(z.string().regex(/^0x[0-9a-fA-F]{40}$/).transform((a) => a.toLowerCase()))
    .max(10)
    .default([]),
  treasury: z.union([z.literal(''), z.string().regex(/^0x[0-9a-fA-F]{40}$/)]).default(''),
  declarations: z.object({ accurate: z.boolean().default(false), controls: z.boolean().default(false) }).prefault({}),
});

export type Draft = z.infer<typeof draftSchema>;
export type DraftPerson = Draft['people'][number];

export const emptyDraft = (): Draft => draftSchema.parse({});

/** Case- and accent-insensitive name, for matching one person across the form, checks and lists. */
export function normalizeName(name: string): string {
  return name
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

export const pct = (v: string) => (v ? Number(v) : 0);
export const needsListing = (director: boolean, ownership: string) => director || pct(ownership) >= OWNER_THRESHOLD;

/** The draft's directors and owners other than the applicant, who verifies their own ID instead. */
export function listedPeople(draft: Draft): DraftPerson[] {
  const me = normalizeName(draft.applicant.name);
  return draft.people.filter((p) => !me || normalizeName(p.name) !== me);
}

/** Everyone whose name is screened: the listed people, and the applicant. */
export function screenedPeople(draft: Draft): { key: string; name: string; dob: string }[] {
  return [
    { key: 'applicant', name: draft.applicant.name, dob: draft.applicant.dob },
    ...listedPeople(draft).map((p) => ({ key: p.key, name: p.name, dob: p.dob })),
  ];
}

/** Everything that stops a submission, as short codes. Empty when the form is complete. */
export function submitProblems(draft: Draft): string[] {
  const problems: string[] = [];
  const c = draft.company;
  if (!c.legalName || !c.type || !c.country || !c.regNo || !c.address || !c.business) problems.push('COMPANY_INCOMPLETE');
  const a = draft.applicant;
  if (!a.name || !a.title || !a.dob || !a.nationality) problems.push('APPLICANT_INCOMPLETE');
  const people = listedPeople(draft);
  if (people.some((p) => !p.name || !p.dob || !p.nationality)) problems.push('PEOPLE_INCOMPLETE');
  if (people.some((p) => !p.fromRegistry && !needsListing(p.director, p.ownership))) problems.push('PERSON_NOT_NEEDED');
  if (people.reduce((n, p) => n + pct(p.ownership), pct(a.ownership)) > 100) problems.push('OWNERSHIP_OVER_100');
  if (!draft.ownersComplete) problems.push('OWNERS_NOT_DECLARED');
  if (draft.wallets.length === 0) problems.push('NO_WALLET');
  if (!draft.treasury) problems.push('NO_TREASURY');
  if (!draft.declarations.accurate || !draft.declarations.controls) problems.push('NOT_DECLARED');
  return problems;
}
