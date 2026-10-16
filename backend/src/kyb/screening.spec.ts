import type { AmlRecord } from './provider.js';
import { screen } from './screening.js';

const record = (names: string[], birthDates: string[] = []): AmlRecord => ({
  id: names[0],
  names,
  birthDates,
  countries: [],
  topics: ['sanction'],
  score: 1,
});

describe('screen', () => {
  it('is clear when no record carries the same name', () => {
    const r = screen({ name: 'Sarah Lin', dob: '1975-08-02' }, [record(['Sarah Lindqvist']), record(['Lin Sarahi'])]);
    expect(r.status).toBe('clear');
  });

  it('matches names ignoring case, accents, punctuation and word order', () => {
    const r = screen({ name: 'José Okafor-Smith', dob: '' }, [record(['SMITH, Jose Okafor'])]);
    expect(r.status).toBe('possible_match');
  });

  it('matches an alias', () => {
    const r = screen({ name: 'William Lai', dob: '1959-10-06' }, [record(['Lai Ching-te', 'William Lai'], ['1959-10-06'])]);
    expect(r.status).toBe('possible_match');
  });

  it('clears a same-name record with a different birth year', () => {
    const r = screen({ name: 'Michael Okafor', dob: '1982-03-14' }, [record(['Michael Okafor'], ['1961-01-01'])]);
    expect(r.status).toBe('clear');
  });

  it('keeps a same-name record without a birth date as a possible match', () => {
    const r = screen({ name: 'Michael Okafor', dob: '1982-03-14' }, [record(['Michael Okafor'])]);
    expect(r).toMatchObject({ status: 'possible_match', hits: [{ id: 'Michael Okafor' }] });
  });
});
