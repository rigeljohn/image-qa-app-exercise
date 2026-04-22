# image-qa-app-exercise
Tiime Start 5:30pm
## Overview
The image-qa-app is a stateless, single-purpose web application that lets users upload an image and ask a natural-language question about it. The application proxies the image and question to the Gemini API and renders the model's answer in the browser. A stretch goal adds an agentic vision mode that surfaces the model's reasoning steps, executed Python code, and intermediate images as a timeline.


**Key design decisions:**
- **Stateless**: The app does not store any user data or session information. Each request is independent and self-contained.
- **Plain HTML + vanilla JS frontend** — no build step, no framework overhead; keeps the client simple and deployable as static files.
- **Node.js/Express backend** — lightweight, well-understood, easy to deploy on any cloud platform; acts purely as a secure proxy so the API key never reaches the browser.
- **Inline image data (base64)** — images ≤ 5 MB are sent inline in the Gemini API request body, avoiding the need for the Files API and keeping the flow stateless.
- **`@google/genai` SDK** — the official Google Gen AI JavaScript SDK handles request construction, retries, and response parsing.

Frontend - "Browser HTML + VANILLA JS"
Backend - "Node.js Express"
Gemini - "Gemini API - gemini-2.5-flash"

npm test - runs all the validator unit and property test in public
npm run test:watch - watch mode during development