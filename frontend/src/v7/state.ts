import { MILESTONES, type Facility } from '../demo/facilities';
import type { Tone } from './Shell';

/** Status word and tone for a facility's state (PRD 4.4). */
export function stateOf(f: Facility): [string, Tone] {
  switch (f.phase) {
    case 'open':
      return ['Open', 'open'];
    case 'conditions':
      return [`Conditions ${f.conds!.filter(Boolean).length} of 6`, 'wait'];
    case 'drawdown':
      return [`Drawdown ${f.drawn} of ${MILESTONES.length}`, 'build'];
    case 'performing':
      return ['Performing', 'ok'];
  }
}
