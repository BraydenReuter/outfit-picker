# Outfit Picker frontend

React, TypeScript, and Vite. From this folder, use `npm ci` and `npm run dev`.

`npm run build` checks TypeScript and creates the production bundle. `npm run lint` runs Oxlint.

In development the API defaults to `http://localhost:4000/api`; production builds call `/api` on the same origin. Set `VITE_API_BASE_URL` to override it. Background removal runs in the browser (`src/utils/backgroundRemoval.ts`). See the [project README](../../README.md) for setup and deployment.
