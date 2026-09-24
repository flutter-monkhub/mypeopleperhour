import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';
import { applyDemoHooks, exposeDebugHandle } from './lib/demoHooks';
import { initDb } from './store/db';

// Hydrate the local database (or load + rebase the seed) before the first render,
// so every component can treat `useDb()` as ready.
async function bootstrap() {
  await initDb();
  await applyDemoHooks();
  exposeDebugHandle();
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

void bootstrap();
