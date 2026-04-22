# Learning Log

## Hours Spent

| Day | Hours | Focus |
|-----|-------|-------|
| Day 1 | 4h 10m (5:30 PM – 9:50 PM) | Project scaffold, environment setup, frontend validation modules, backend, integration tests, deployment setup (Railway + Vercel), README |

---

## Blockers and Resolutions

**dotenv not loaded at runtime**
The server started but `GEMINI_API_KEY` was always undefined. The `.env` file existed but nothing was reading it — `dotenv` was not installed and `import 'dotenv/config'` was missing from `server.ts`. Fixed by installing `dotenv` and adding the import as the first line of the entry point.

**Gemini free-tier quota exhausted (gemini-2.0-flash)**
When testing the app for the first time, every request returned a 429 RESOURCE_EXHAUSTED error. The root cause was that I initially used gemini-2.0-flash as the model, carried over from a previous personal project — a crochet app where users photograph a crochet item, upload it, and Gemini generates a pattern image along with step-by-step instructions on how to recreate it. That project had already consumed the free-tier daily quota for gemini-2.0-flash, leaving zero tokens remaining when I started testing this app. Resolved by switching to gemini-2.5-flash, which has a completely separate quota pool and worked immediately.

Known Issues

These issues are inherent to using the Gemini free tier and are outside the scope of the application itself.

429 RESOURCE_EXHAUSTED — Daily quota exceeded
The free tier enforces a daily request limit per model. Once the quota is exhausted, all requests fail until the quota resets (typically at midnight Pacific Time). If you hit this error, wait for the reset or switch to a different model variant with a separate quota pool.
503 UNAVAILABLE — Model overloaded
json{
  "error": {
    "code": 503,
    "message": "This model is currently experiencing high demand. Spikes in demand are usually temporary. Please try again later.",
    "status": "UNAVAILABLE"
  }
}
Gemini free-tier endpoints occasionally return 503 during peak usage periods. This is a transient server-side issue — retrying the request after a short wait typically resolves it. The app does not currently implement automatic retries, so the user will need to re-submit manually.

**TypeScript build error — `req.file` not typed on Express Request**
The TypeScript compiler rejected `req.file` in `src/routes/ask.ts` with error TS2339 because multer's file attachment is not part of the base Express `Request` type. This caused the Vercel build to fail (Vercel was running `npm run build` which compiles the TypeScript backend, even though Vercel only needs to serve the static frontend). Fixed in two steps: added a local `MulterFile` interface and cast `req` to include it; and added `"buildCommand": ""` to `vercel.json` so Vercel skips the build entirely and just serves `public/`.

**`@types/multer` missing — `File` export not found**
After installing `@types/multer` to fix the above, the import `import type { File as MulterFile } from 'multer'` failed because `@types/multer` does not export a `File` type by that name. Resolved by removing the import and defining a local `MulterFile` interface directly in `ask.ts` with the fields actually used (`buffer`, `mimetype`, etc.).

**CORS for split deployment**
When the frontend (Vercel) and backend (Railway) are on different origins, the browser blocks requests. Resolved by adding the `cors` middleware to Express, reading the allowed origin from `FRONTEND_URL` env var, and exposing the `X-Request-ID` header.

**Deployment URL concatenation bug**
After deploying to Vercel and Railway, requests were going to `https://image-qa-app.vercel.app/image-qa-app-production.up.railway.app/api/ask` instead of the Railway URL directly. The cause was that `public/config.js` had the Railway URL set without the `https://` protocol prefix, so the browser treated it as a relative path and appended it to the Vercel origin. Fixed by ensuring the full `https://` URL is set in `config.js`.

---

## AI Tools Used

**Kiro (AI development environment)**
Used throughout the project for spec-driven development. Kiro generated the requirements document, design document, and implementation task list from a rough idea. It then executed each task: writing source files, test files, and configuration. All generated code was reviewed before acceptance — checking that module exports matched the spec interfaces, that property tests used the correct fast-check generators, and that error handling matched the HTTP status code table in the design doc.

Key validations performed on AI-generated output:
- Ran `npm test` after each task to confirm tests passed before moving on.
- Manually tested the running app in the browser (image upload, question submission, error states).
- Reviewed the Gemini client to confirm the API key scrubbing logic actually strips the key from error messages.
- Checked that `X-Request-ID` was present in both success and error response headers.

---

## Key Architectural Decisions

**Single-process local dev, split-deploy production**
Running Express as a single process (serving both static files and the API) keeps local development simple — one command, one port. For production, splitting onto Vercel (frontend) and Railway (backend) gives each layer its own scaling and deployment lifecycle without changing any application code. The `public/config.js` file bridges the two by injecting the backend URL at runtime.

**Reusing Gemini integration knowledge from a prior project**
The Gemini API integration pattern (base64 inline image, `generateContent` with `inlineData` parts) was adapted from a previous crochet app project where users photograph a crochet item and Gemini generates a matching pattern with step-by-step instructions. That prior experience meant the core Gemini client code was familiar, though the quota exhaustion from that project caused the blocker described above.

**Inline base64 images instead of the Files API**
Images ≤ 5 MB are converted to base64 and sent inline in the Gemini `generateContent` request. This avoids the extra round-trip to upload a file and keeps the flow stateless — no file handles or upload IDs to manage between requests.

**Vanilla JS frontend with no build step**
Using plain HTML and ES modules means the frontend can be deployed as-is to any static host. There is no bundler, no transpilation, and no framework to update. The trade-off is that the code is more verbose than a React/Vue equivalent, but for a single-page utility app the simplicity is worth it.

**Property-based testing with fast-check**
Chose fast-check over writing exhaustive example-based tests because the correctness properties (e.g. "any file over 5 MB is rejected", "the API key never appears in any response") are universal claims. A property test with 100 random inputs gives much stronger evidence than a handful of hand-picked examples.

---

## What I Would Do Differently

- **Start with a deployed skeleton earlier.** I built and tested everything locally before thinking about deployment. Setting up Railway and Vercel on day 1 with a "hello world" endpoint would have caught the CORS and environment variable issues much sooner.
- **Use streaming from the start.** The current implementation waits for the full Gemini response before sending anything to the browser. Adding streaming later requires changes to both the backend (SSE or chunked transfer) and the frontend (incremental DOM updates), which is harder to retrofit than to design in from the beginning.
- **Write the integration tests before the implementation.** The property tests were written alongside the implementation (as the spec required), but the integration tests came last. Writing them first would have caught the missing `dotenv` issue on day 1 instead of later.
- **Use a separate API key for new projects.** Sharing the same Gemini API key across multiple projects meant the quota from the crochet app bled into this one. A dedicated key per project would have avoided the quota exhaustion blocker entirely.
