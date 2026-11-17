# Validation notes

Checks for the free-hosting version: November 17, 2026, on Linux with Node.js 22 and PostgreSQL 16. Tests ran against a separate test database.

## Automated checks

| Check | Result |
| --- | --- |
| Backend `npm test` | 37 tests passed across 3 suites |
| Backend TypeScript build | Passed |
| Frontend `npm run lint` | Passed |
| Frontend `npm run build` | Passed |
| Root `npm run build` (what Render runs) | Passed |

The API tests cover clothing and outfit CRUD, combined filters and case-insensitive text search, invalid input, clearing optional fields, category/type mismatches, missing records, and deleting outfits that reference removed clothing.

Image tests cover rejecting missing, mislabelled, fake, oversized, and too-large-dimension PNGs; storing and serving a PNG; the storage cap; keeping shared photos while records still use them; deleting discarded previews and replaced photos; and cleanup removing only old, unused photos.

Demo tests cover loading the sample wardrobe, seeding an empty database on the first request, not resetting before the interval, and the clothing and outfit caps.

## Production-style run

The root build was started with `npm start` and the same settings as `render.yaml`, against a new, empty Postgres database:

- Migrations applied on startup, and the first request loaded the 8-piece sample wardrobe and 3 outfits.
- `/` served the React app, deep links fell back to it, and sample photos were served from the database.
- In headless Chromium (Playwright), a JPEG photo of a shirt on a textured background was uploaded, its background was removed in the browser (about 13 seconds on the test container's CPU), the result was reviewed, and the item was saved. No console errors.

## Not verified here

- The test container could not reach IMG.LY's CDN, so the browser test loaded the model from a local copy of `@imgly/background-removal-data`. The deployed site loads it from the CDN, which is the library's default. Check one upload after the first deploy.
- The Render and Neon deployment itself.
- Segmentation quality on real photos beyond the sample above. The model is a general foreground/background model, not a clothing parser.
