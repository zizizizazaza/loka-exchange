import { createHashRouter, Navigate } from 'react-router';

import { Layout } from './Layout';
import { Apply } from './pages/Apply';
import { Company } from './pages/Company';
import { Loan } from './pages/Loan';
import { Loans } from './pages/Loans';

// Hash routes, same as the prototype: #/loans, #/loan/<id>/<tab>, #/apply, #/company. Anything else shows the loans.
export const router = createHashRouter([
  {
    element: <Layout />,
    children: [
      { index: true, element: <Navigate to="/loans" replace /> },
      { path: 'loans', element: <Loans /> },
      { path: 'loan/:id/:tab?', element: <Loan /> },
      { path: 'apply', element: <Apply /> },
      { path: 'company', element: <Company /> },
      { path: '*', element: <Loans /> },
    ],
  },
]);
