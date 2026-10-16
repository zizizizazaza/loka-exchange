import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router';

import '@phosphor-icons/web/regular/style.css';
import '@phosphor-icons/web/light/style.css';
import '@phosphor-icons/web/fill/style.css';
import './styles/prototype.css';
import './styles/kyb.css';
import './styles/v2.css';

import { DemoProvider } from './demo/DemoContext';
import { Providers } from './providers';
import { router } from './router';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Providers>
      <DemoProvider>
        <RouterProvider router={router} />
      </DemoProvider>
    </Providers>
  </StrictMode>,
);
