import { Navigate, useParams } from 'react-router';

import { useDemo } from '../../demo/state';
import { bySym, LOANS } from '../../demo/data';
import { Markets } from '../Markets';
import { LoanDetail } from './LoanDetail';
import { NewIssueDetail } from './NewIssueDetail';
import { NewIssueDetailV2 } from './NewIssueDetailV2';

/** #/asset/<sym>[/<tab>]: a new issue, or a funded loan. Same dispatch as the prototype's renderAsset(). */
export function AssetPage() {
  const { sym = '', tab = '' } = useParams();
  const { issues } = useDemo();

  const ni = issues.find((x) => x.sym === sym);
  if (ni) return <NewIssueDetail n={ni} tab={tab} />;
  const m = bySym(sym);
  if (!m || m.soon) return <Markets />;
  // The CCV vault is hidden in this phase.
  if (sym === 'CCV') return <Navigate to="/markets" replace />;
  return <LoanDetail m={m} l={LOANS[sym]} tab={tab} />;
}

/** #/asset-v2/<sym>: the institutional take on new issues; funded loans keep the original page for now. */
export function AssetPageV2() {
  const { sym = '', tab = '' } = useParams();
  const { issues } = useDemo();
  const ni = issues.find((x) => x.sym === sym);
  if (ni) return <NewIssueDetailV2 n={ni} tab={tab} />;
  return <Navigate to={`/asset/${sym}`} replace />;
}
