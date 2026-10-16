import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router';

import '@phosphor-icons/web/regular/style.css';
import '@phosphor-icons/web/light/style.css';
import '@phosphor-icons/web/fill/style.css';
import './issuer.css';

import { router } from './router';

// Issuer console for compute operators (the borrowers), migrated 1:1 from v2-exchange/app/issuer/index.html.
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
