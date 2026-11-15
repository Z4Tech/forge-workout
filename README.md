# Forge — personal workout app

A Gravl-style planner and tracker that runs as an installable web app (PWA). It's plain HTML/CSS/JS
with no build step and no dependencies. All data stays in your browser's localStorage.

## Features

- **Workout generator**: picks the split day (full body / upper-lower / push-pull-legs, depending on
  days per week) whose muscles are most recovered, then fills it with exercises matching your
  equipment, goal and session length. You can swap, remove or add exercises, regenerate the plan,
  or change the focus.
- **Progressive overload** (double progression): add reps at the same weight until every top set hits
  the top of the rep range, then add weight. Missing the bottom of the range twice in a row
  triggers a 10% deload. Bodyweight and timed moves progress by reps or seconds.
- **Logging**: each set is prefilled with the target and shows what you did last time. A new weight
  carries down to the remaining sets. Checking off a set starts a rest timer that beeps and
  vibrates when it ends. A workout in progress survives a page reload.
- **Recovery map**: front and back body diagrams plus a per-muscle list. Each set adds fatigue that
  fades over 36–72h, depending on the muscle.
- **History & stats**: workout log and details, weekly volume, sets per muscle, estimated 1RM trend
  and PRs per exercise, and a week streak.
- **Export**: a JSON backup (all data) and a CSV with one row per set, for spreadsheets. Importing a
  backup merges it with what's already there and never overwrites anything.
- **Sync** across devices through a private GitHub gist (see below).

## Sync

1. Create a GitHub token with only the `gist` scope:
   https://github.com/settings/tokens/new?scopes=gist&description=Forge%20workout%20sync
2. In Forge, open Settings → Sync across devices, paste the token and tap Connect. This creates a
   private gist called `forge-sync.json`.
3. On another device, paste the same token. It finds the existing gist and merges. On a fresh
   install, use "Restore with sync" on the welcome screen.

Forge syncs when it opens, when you switch back to it, and a moment after each change. Workouts are
merged by id, so workouts logged on different devices are all kept. Deletions carry over between
devices. For settings and hidden exercises, the most recent change wins. A workout in progress
and today's plan stay on the device where you started them.

The token is stored in this browser's localStorage under `forge.sync`, separate from your workout
data, and is never included in exports. Because it only has the `gist` scope, someone who got hold
of it could read or change your gists but nothing else on your account. You can revoke it on GitHub
at any time.

## Run locally

```bash
powershell -NoProfile -ExecutionPolicy Bypass -File serve.ps1
```

Then open http://localhost:8080. The service worker (offline mode) is skipped on localhost so that
your edits show up right away.

## Live site

Hosted on GitHub Pages at **https://z4tech.github.io/forge-workout/** from the `main` branch of
https://github.com/Z4Tech/forge-workout.

To publish a change:

1. Bump `CACHE` in `sw.js` (for example `forge-v2` → `forge-v3`) so installed copies pick up the new files.
2. Commit and push:
   ```bash
   git add -A
   git commit -m "Describe the change"
   git push
   ```
3. Pages redeploys in about a minute. Installed apps get the update the next time they're
   opened, and show it after one more reopen.

## Put it on your phone

Service workers and "Add to Home Screen" need HTTPS, so host the folder on any free static host:

- **GitHub Pages**: push this folder to a repo, then go to Settings → Pages → deploy from branch.
- **Netlify Drop**: drag the folder onto https://app.netlify.com/drop.

Open the URL on your phone, then use Share → Add to Home Screen (iOS) or Install app (Android).
Data is stored per device and per browser, so use Export/Import to move it.

## Code layout

| File | Purpose |
| --- | --- |
| `js/exercises.js` | Exercise library (muscles, equipment, compound/isolation) |
| `js/engine.js` | Recovery model, generator, progression, stats |
| `js/app.js` | Screens, routing, events |
| `js/body.js` | Body-map SVG |
| `js/store.js` | localStorage persistence and the merge logic (weights are stored in kg) |
| `js/sync.js` | GitHub Gist sync |
| `sw.js` | Offline cache. Bump `CACHE` when you deploy changes |
