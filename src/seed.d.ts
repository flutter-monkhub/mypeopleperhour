// `@seed` is a Vite alias for ./shared/generated/seed.json (see vite.config.ts).
// Typed here so TypeScript never has to infer a type for the 1.7 MB JSON file.
declare module '@seed' {
  import type { DemoDatabase } from '@shared/types';
  const seed: DemoDatabase;
  export default seed;
}
