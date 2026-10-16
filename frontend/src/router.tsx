import { createHashRouter, Navigate } from 'react-router';

import { Layout } from './layout/Layout';
import { VerifiedOnly } from './layout/VerifiedOnly';
import { AssetPage, AssetPageV2 } from './pages/asset/AssetPage';
import { Deposit } from './pages/Deposit';
import { Issue } from './pages/Issue';
import { Markets } from './pages/Markets';
import { MarketsV2 } from './pages/MarketsV2';
import { MarketsV3 } from './pages/MarketsV3';
import { MarketsV4 } from './pages/MarketsV4';
import { MarketsV5 } from './pages/MarketsV5';
import { Portfolio } from './pages/Portfolio';
import { Verify } from './pages/verify/Verify';
import { V6Borrow } from './v6/Borrow';
import { V6Facilities } from './v6/Facilities';
import { V6Facility } from './v6/Facility';
import { V6FundAccount } from './v6/FundAccount';
import { V6Portfolio } from './v6/Portfolio';
import { V6Shell } from './v6/Shell';
import { V7Borrow } from './v7/Borrow';
import { V7Facilities } from './v7/Facilities';
import { V7Facility } from './v7/Facility';
import { V7FundAccount } from './v7/FundAccount';
import { V7Portfolio } from './v7/Portfolio';
import { V7Shell } from './v7/Shell';

// Hash routes, so URLs match the prototype (#/markets, #/asset/NH200-1, ...) and the app can be served as static files.
// Trade, Earn and Transparency are hidden in this phase and send you to Markets, as in the prototype.
// Opening the app (or an unknown route) goes to the v7 lender app; the original pages stay at their routes for comparison.
export const router = createHashRouter([
  {
    element: <Layout />,
    children: [
      { index: true, element: <Navigate to="/v7/facilities" replace /> },
      { path: 'markets', element: <Markets /> },
      // A more institutional take on Markets, for review against the original (src/styles/markets-v2.css).
      { path: 'markets-v2', element: <MarketsV2 /> },
      // Third take: the original's serif and warm paper, one dark band, fewer blocks (src/styles/markets-v3.css).
      { path: 'markets-v3', element: <MarketsV3 /> },
      // Fourth take: PRD v0.3 wording (Loka Capital, Facilities) in a Galaxy-like frame (src/styles/markets-v4.css).
      { path: 'markets-v4', element: <MarketsV4 /> },
      // Fifth take: an institutional portal, table and documents first (src/styles/markets-v5.css).
      { path: 'markets-v5', element: <MarketsV5 /> },
      // v6: the whole lender app in the institutional style chosen from the previews (src/v6, src/styles/v6.css).
      { path: 'markets-v6', element: <Navigate to="/v6/facilities" replace /> },
      // v7: the whole lender app in the original look moved toward Galaxy's restraint, PRD v0.3 wording and fields
      // (src/v7, src/styles/v7.css). Business verification runs inside the same shell.
      { path: 'markets-v7', element: <Navigate to="/v7/facilities" replace /> },
      {
        path: 'v7',
        element: <V7Shell />,
        children: [
          { index: true, element: <Navigate to="/v7/facilities" replace /> },
          { path: 'facilities', element: <V7Facilities /> },
          { path: 'facility/:sym', element: <V7Facility /> },
          { path: 'portfolio', element: <V7Portfolio /> },
          { path: 'fund-account', element: <V7FundAccount /> },
          { path: 'borrow', element: <V7Borrow /> },
          {
            path: 'verify',
            element: (
              <main className="mk7-w mk7-main">
                <Verify base="/v7" />
              </main>
            ),
          },
        ],
      },
      {
        path: 'v6',
        element: <V6Shell />,
        children: [
          { index: true, element: <Navigate to="/v6/facilities" replace /> },
          { path: 'facilities', element: <V6Facilities /> },
          { path: 'facility/:sym', element: <V6Facility /> },
          { path: 'portfolio', element: <V6Portfolio /> },
          { path: 'fund-account', element: <V6FundAccount /> },
          { path: 'borrow', element: <V6Borrow /> },
        ],
      },
      { path: 'asset/:sym/:tab?', element: <AssetPage /> },
      // A more institutional take on the new-issue page, for review against the original (src/styles/v2.css).
      { path: 'asset-v2/:sym/:tab?', element: <AssetPageV2 /> },
      { path: 'portfolio', element: <VerifiedOnly page="portfolio"><Portfolio /></VerifiedOnly> },
      { path: 'deposit', element: <VerifiedOnly page="deposit"><Deposit /></VerifiedOnly> },
      { path: 'issue', element: <Issue /> },
      // Business verification: not in the prototype, built in its style (src/pages/verify).
      { path: 'verify', element: <Verify /> },
      { path: 'trade/*', element: <Navigate to="/markets" replace /> },
      { path: 'earn', element: <Navigate to="/markets" replace /> },
      { path: 'transparency', element: <Navigate to="/markets" replace /> },
      { path: '*', element: <Navigate to="/v7/facilities" replace /> },
    ],
  },
]);
