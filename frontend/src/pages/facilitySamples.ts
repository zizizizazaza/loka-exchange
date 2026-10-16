// Sample construction facilities for the Facilities previews (#/markets-v4, #/markets-v5).
// Construction facilities are new in PRD v0.3 and not in the shared sample data (src/demo/data.ts) yet; kept here so
// the existing pages stay as they are. Milestones and draw shares follow PRD 4.5.6 (examples).
export const MILESTONES: [string, number][] = [
  ['Notice to proceed', 0.3],
  ['Equipment delivered', 0.4],
  ['Racked and powered', 0.2],
  ['First rent received', 0.1],
];
export const BUILD_OPEN = {
  sym: 'ABL-B300',
  name: 'Abilene B300 Campus',
  gpu: '512 × NVIDIA B300',
  site: 'Abilene, Texas, US',
  amt: 12000000,
  cost: 20000000,
  sub: 0.35,
  rate: 0.13,
  term: 36,
  build: 9,
  closes: '2026-11-20',
};
export const BUILD_ACTIVE = {
  sym: 'PHX-B300',
  name: 'Phoenix B300 Hall',
  gpu: '256 × NVIDIA B300',
  site: 'Phoenix, Arizona, US',
  amt: 6500000,
  cost: 11000000,
  drawn: 2,
  rate: 0.125,
  term: 33,
  buildLeft: 4,
};
export const drawnShare = (k: number) => MILESTONES.slice(0, k).reduce((a, [, s]) => a + s, 0);
