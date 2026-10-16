import { type Draft, draftSchema, listedPeople, normalizeName, screenedPeople, submitProblems } from './draft.js';

const complete = (): Draft =>
  draftSchema.parse({
    step: 'review',
    company: {
      legalName: 'Northwind Capital Pte. Ltd.',
      type: 'Private credit fund',
      country: 'Singapore',
      regNo: '201912345K',
      address: '1 Raffles Place',
      business: 'Credit fund',
      doc: 'certificate.pdf',
    },
    applicant: { name: 'Michael Okafor', title: 'CFO', dob: '1982-03-14', nationality: 'British', ownership: '35' },
    people: [
      { key: 'r0', name: 'Sarah Lin', director: true, dob: '1975-08-02', nationality: 'Singaporean', fromRegistry: true },
      { key: 'r1', name: 'MICHAEL OKAFOR', director: true, fromRegistry: true },
    ],
    ownersComplete: true,
    wallets: ['0xAAAA000000000000000000000000000000000001'],
    treasury: '0x9F2b1C77aD3e5B6C8f0A41dE2b7C9a10E3d4F512',
    declarations: { accurate: true, controls: true },
  });

describe('draft', () => {
  it('fills defaults for an empty form and lowercases wallets', () => {
    expect(draftSchema.parse({}).step).toBe('company');
    expect(complete().wallets).toEqual(['0xaaaa000000000000000000000000000000000001']);
  });

  it('rejects malformed values', () => {
    expect(draftSchema.safeParse({ applicant: { dob: '14/03/1982' } }).success).toBe(false);
    expect(draftSchema.safeParse({ treasury: '0x123' }).success).toBe(false);
  });

  it('normalizes names', () => {
    expect(normalizeName('  José  Okafor-Smith ')).toBe('jose okafor smith');
  });

  it('does not list the applicant twice', () => {
    expect(listedPeople(complete()).map((p) => p.key)).toEqual(['r0']);
    expect(screenedPeople(complete()).map((p) => p.key)).toEqual(['applicant', 'r0']);
  });

  it('accepts a complete form', () => {
    expect(submitProblems(complete())).toEqual([]);
  });

  it('reports what is missing', () => {
    const d = complete();
    d.people.push({ key: 'a1', name: 'Daniel Weiss', director: false, ownership: '8', dob: '', nationality: '', fromRegistry: false });
    d.ownersComplete = false;
    d.declarations.controls = false;
    expect(submitProblems(d)).toEqual(['PEOPLE_INCOMPLETE', 'PERSON_NOT_NEEDED', 'OWNERS_NOT_DECLARED', 'NOT_DECLARED']);
  });

  it('rejects ownership over 100%', () => {
    const d = complete();
    d.people[0].ownership = '70';
    expect(submitProblems(d)).toContain('OWNERSHIP_OVER_100');
  });
});
