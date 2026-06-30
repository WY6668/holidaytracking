# Out of Office — Team Holiday Tracker (v2)

A small team holiday/leave tracker. One Node/Express server serves both the API and the built React app, so it deploys as a single service with one URL.

## Project structure

```
holiday-app/
  server/
    index.js          Express API + serves built client
    data/holidays.json Where entries are stored (plain JSON file)
  client/               React app (Vite)
    src/
  package.json          Root scripts (build / start)
```

## New in v2

- **Password protection**: set an `APP_PASSWORD` environment variable and the whole app is gated behind a simple shared password screen. Leave it unset for open access (no login).
- **Table view**: the "All time off" list now renders as a proper table.

## Running it locally

You'll need Node.js 18+ installed.

```
npm run install:all   # installs both server and client dependencies
npm run dev:server    # terminal 1 — API on http://localhost:4000
npm run dev:client    # terminal 2 — React dev server on http://localhost:5173
```

Open http://localhost:5173 while developing — it proxies `/api` calls to the server automatically.

To test the password gate locally, set the env var before starting the server:

```
APP_PASSWORD=teamsecret npm run dev:server
```

## Deploying it

This app is built as **one service**: the build step compiles the React app into static files, and the Express server serves them directly, so you only need one host and you get one URL for the whole team.

### Option A: Render (recommended, free tier available)

1. Push this project to a GitHub repository.
2. Go to render.com → New → Web Service → connect your repo.
3. Set:
   - **Build command:** `npm install && npm run build`
   - **Start command:** `npm start`
4. In the **Environment** tab, add a variable:
   - `APP_PASSWORD` = your team's shared password (omit this if you want no login)
5. Click Deploy. Render will give you a URL like `https://your-app.onrender.com` — share that with your team.

**Note:** Render's free tier uses temporary disk storage, so the `holidays.json` data may reset if the service restarts after inactivity. For anything beyond casual/demo use, consider Railway (persistent disk by default) or adding a small database.

### Option B: Railway

1. Push to GitHub, then go to railway.app → New Project → Deploy from GitHub repo.
2. Railway auto-detects Node. Set the build command to `npm run build` and start command to `npm start` if it doesn't infer them.
3. Add the `APP_PASSWORD` environment variable in the project settings.
4. Railway gives you a persistent disk by default, so your data file will survive restarts.

## Password protection details

- If `APP_PASSWORD` is not set, the app runs with open access (same as v1 — anyone with the link can use it).
- If `APP_PASSWORD` is set, visitors must enter it once; an httpOnly cookie keeps them signed in for 30 days.
- Also set `AUTH_SECRET` (any random string) in production — it's used to sign the session cookie. If you don't set one, a default development value is used, which is fine for casual internal use but not recommended for anything sensitive.
