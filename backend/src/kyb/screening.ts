import { normalizeName } from './draft.js';
import type { AmlRecord } from './provider.js';

/**
 * Turns an /amlv3 name search into a result for one person.
 * The search is fuzzy and takes only a name, so a record counts as a possible match only when one of its names is
 * the same name (ignoring case, accents, punctuation and word order), and its birth year, when the list has one,
 * is the person's. Everything else is noise from the fuzzy search. Possible matches go to the reviewer; none block.
 */
export type ScreeningOutcome = { status: 'clear' | 'possible_match'; hits: AmlRecord[] };

const tokens = (name: string) => normalizeName(name).split(' ').filter(Boolean).sort().join(' ');

export function screen(person: { name: string; dob: string }, records: AmlRecord[]): ScreeningOutcome {
  const target = tokens(person.name);
  const year = person.dob.slice(0, 4);
  const hits = records.filter((r) => {
    if (!r.names.some((n) => tokens(n) === target)) return false;
    const years = r.birthDates.map((d) => d.slice(0, 4)).filter((y) => /^\d{4}$/.test(y));
    return years.length === 0 || !year || years.includes(year);
  });
  return { status: hits.length ? 'possible_match' : 'clear', hits };
}
