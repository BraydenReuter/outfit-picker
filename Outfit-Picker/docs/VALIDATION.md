# Validation notes

Final local checks: October 3, 2026, on Windows. The project was tested with a separate SQLite wardrobe and upload directory; the existing development wardrobe was left alone.

## Automated checks

| Check | Result |
| --- | --- |
| Backend `npm test` | 35 tests passed across 2 suites |
| Backend `npm run build` | Passed |
| Frontend `npm run lint` | Passed |
| Frontend `npm run build` | Passed |
| Image service `python -m pytest -q` | 11 tests passed |
| `npm run db:setup` with a separate database | Passed |
| Compiled API `npm start` | Started and served the browser workflow |
| Compiled default upload path | Resolves to `backend/uploads`, the same directory used by development |

The API tests cover clothing and outfit CRUD, combined filters and text search, invalid input, clearing optional fields, category/type mismatches, missing records, and deleting outfits that reference removed clothing. Image tests cover upload size/type checks, upstream failures and timeouts, PNG persistence and serving, replacement cleanup, and keeping shared photos while records still reference them.

Python tests cover decoded-image validation, byte and pixel limits, camera orientation, transparency, soft-mask cropping, empty masks, model failures, and concurrent requests. Mask prediction is stubbed in unit tests. These tests check processing behavior, not the quality of the actual model.

The Python suite reports dependency deprecation warnings and an expected Pillow warning in the deliberately low pixel-limit test. None of these caused failures. Prisma 6 reports a deprecation notice for the existing seed configuration.

## Actual browser workflow

The browser was connected to the compiled Express API, SQLite, and the actual local BiRefNet service. It did not use mocked API responses.

- Uploaded and processed real top and bottom photos, reviewed the resulting transparent PNGs, and saved them during the implementation checks.
- Loaded those saved items again after restarting the services and refreshing the browser.
- Edited a clothing record and confirmed the closet count did not increase.
- Combined search, category, type, color, brand, and size filters and confirmed the expected item remained.
- Checked the no-results state and cleared filters to restore the collection.
- Selected a top and bottom with the arrows, saved an outfit, refreshed, and confirmed it remained saved.
- Loaded that saved outfit back into the builder with both selections and its notes intact.
- Canceled an outfit deletion, then confirmed deletion and refreshed to verify it stayed deleted while the clothing remained.
- Added a temporary clothing record and an outfit using it. Deleting that piece removed its dependent outfit, and both stayed deleted after refresh. Other clothing remained.
- Selected, removed, and reselected a photo in the form. Ran real CPU inference again, canceled the form, and checked that the unsaved processed PNG was removed from disk.
- Checked the clothing dialog at 390px and the builder at 320px with no horizontal page overflow. Escape closed the dialog and returned keyboard focus to its opener after a focus-restoration fix.
- Checked the browser error log at the end of the functional journey: no console errors were reported.

The screenshots in `docs/screenshots` show the app using the real processed images. The test wardrobe is not seeded into a new installation.

## Runtime and limits

Node.js 24, Prisma Client 6.19.3, and Python 3.12 were used locally. The copied Python virtual environment's original launcher was not usable in the sandbox, so the tests and live service used the available Python 3.12 runtime with that environment's installed packages. A fresh checkout should create its own virtual environment using the README instructions.

The pinned BiRefNet model loaded from the local Hugging Face cache and completed CPU inference. GPU inference was not tested. The model removes backgrounds; it does not reliably isolate clothing worn by a person. The shirt screenshot retains the hanger, rack, and hat from its input. A single garment on a simple background gives it a better chance of producing the desired result.

The GitHub Actions workflow is included but has not been run on GitHub. Browser checks were performed interactively; a committed frontend end-to-end regression suite remains future work. This is a local, single-user MVP, not an authenticated public deployment.
