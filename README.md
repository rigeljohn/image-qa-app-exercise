# image-qa-app

## Overview

The `image-qa-app` is a stateless, single-purpose web application that lets users upload an image and ask a natural-language question about it. The application proxies the image and question to the Gemini API and renders the model's answer in the browser. A stretch goal adds an agentic vision mode that surfaces the model's reasoning steps, executed Python code, and intermediate images as a timeline.

## Tech Stack

| Layer    | Technology                        |
|----------|-----------------------------------|
| Frontend | Browser HTML + Vanilla JS         |
| Backend  | Node.js / Express                 |
| AI Model | Gemini API (`gemini-2.5-flash`)   |

## Key Design Decisions

- **Stateless** — The app does not store any user data or session information. Each request is independent and self-contained.
- **Plain HTML + Vanilla JS frontend** — No build step, no framework overhead; keeps the client simple and deployable as static files.
- **Node.js/Express backend** — Lightweight and easy to deploy on any cloud platform; acts purely as a secure proxy so the API key never reaches the browser.
- **Inline image data (base64)** — Images ≤ 5 MB are sent inline in the Gemini API request body, avoiding the need for the Files API and keeping the flow stateless.
- **`@google/genai` SDK** — The official Google Gen AI JavaScript SDK handles request construction, retries, and response parsing.

---

## Local Setup

### Prerequisites

- Node.js 18 or later
- A Gemini API key — get one free at [https://aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey)

### Steps

1. **Clone the repository**

   ```bash
   git clone <your-repo-url>
   cd image-qa-app
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Configure environment variables**

   ```bash
   cp .env.example .env
   ```

   Open `.env` and set your key:

   ```
   GEMINI_API_KEY=your_key_here
   ```

4. **Start the server**

   ```bash
   npm start
   ```

   Or with auto-reload during development:

   ```bash
   npm run dev
   ```

5. **Open the app**

   Navigate to [http://localhost:3000](http://localhost:3000) in your browser.

---

## Running Tests

```bash
# Run all unit, property-based, and integration tests
npm test

# Watch mode during development
npm run test:watch

# Run tests for a specific module
npx vitest run src/geminiClient
npx vitest run src/routes/ask
```

## Running Locally (Without the Full Server)

```bash
# Serve only the frontend
npx serve public

# Start the backend
npm start
```

---

## Architecture

```
Browser (Vercel)
  └── public/index.html
  └── public/app.js             ← orchestrates UI events
  └── public/apiClient.js       ← fetch wrapper → POST /api/ask
  └── public/imageValidator.js
  └── public/questionValidator.js
  └── public/uiController.js

Backend (Railway)
  └── src/server.ts             ← Express app, static file serving, CORS
  └── src/routes/ask.ts         ← POST /api/ask handler
  └── src/geminiClient.ts       ← Gemini API proxy
  └── src/requestLogger.ts      ← structured JSON logger
```

The frontend and backend are co-located in one repository but deployed to separate platforms. In local development they run as a single process (Express serves both the API and the static files). In production, `public/config.js` points the frontend at the Railway backend URL.

---

## Deployment

The app is deployed as two separate services:

| Layer    | Platform | Notes                              |
|----------|----------|------------------------------------|
| Frontend | Vercel   | Serves the static `public/` directory |
| Backend  | Railway  | Runs the Node.js/Express server    |

### Deploy the Backend to Railway

1. Push the repository to GitHub.
2. Create a new project on [Railway](https://railway.app) and connect your GitHub repo.
3. Set the following environment variables in the Railway dashboard:
   - `GEMINI_API_KEY` — your Gemini API key
   - `FRONTEND_URL` — your Vercel frontend URL (e.g. `https://image-qa-app.vercel.app`)
4. Railway will detect `railway.json` and run `npm start` automatically.
5. Note the Railway-assigned public URL (e.g. `https://image-qa-app.up.railway.app`).

### Deploy the Frontend to Vercel

1. Create a new project on [Vercel](https://vercel.com) and import the same GitHub repo.
2. Vercel will detect `vercel.json` and serve the `public/` directory.
3. After the first deploy, open `public/config.js` and set `window.API_BASE_URL` to your Railway backend URL:

   ```js
   window.API_BASE_URL = 'https://image-qa-app.up.railway.app';
   ```

4. Commit and push — Vercel will redeploy automatically.

### Why Railway + Vercel?

- **Railway** is the simplest platform for deploying a persistent Node.js server. It supports environment variables, auto-deploys from GitHub, and provides a public HTTPS URL with minimal configuration.
- **Vercel** is purpose-built for static frontends. The `public/` directory is plain HTML + vanilla JS with no build step, making it a natural fit.
- Splitting the two services keeps the API key exclusively on the server side and allows each layer to scale independently.

---

## What I Would Improve

- **Streaming responses** — Stream the Gemini response token-by-token so the user sees the answer appear progressively rather than waiting for the full response.
- **File drag-and-drop** — Add a drag-and-drop zone as an alternative to the file picker.
- **Better error messages** — Map specific Gemini error codes to user-friendly explanations (e.g. quota exceeded, unsupported image format).
- **Rate limiting** — Add server-side rate limiting per IP to prevent abuse of the Gemini API quota.
- **Agentic mode UI** — Complete the agentic vision timeline to surface the model's reasoning steps.
- **Multi-turn conversation** — Allow users to ask follow-up questions without re-uploading the image.
- **CI/CD pipeline** — Add a GitHub Actions workflow that runs `npm test` on every pull request.