# Alex D&D Training — Frontend

A single static page (`index.html` + `app.js`, no build step, no
framework) replacing the three Tkinter tabs, talking to the FastAPI
backend over the endpoints in `backend/main.py`.

## Files

- **`index.html`** — markup + all CSS (no external stylesheet, no font
  loading — system fonts only, since this is an internal daily-use
  tool, not a marketing page).
- **`app.js`** — all logic: login, API calls, course autofill, live
  customer-ID/doc-number preview chips, PDF generation + inline
  preview, the email modal, history, and settings.

## How auth works

One shared password (`APP_PASSWORD` on the backend), entered once on
a login screen. The password and server URL are kept only in an
in-memory JS variable for the tab's lifetime — **never** written to
localStorage or sessionStorage. Closing the tab signs you out; there
is no "remember me." This is a deliberate trade-off: for a single
shared internal password, the convenience of staying signed in is not
worth the password sitting in browser storage.

## Running it locally

You need the backend running first (see `backend/README.md`). Then,
from this folder:

```bash
python3 -m http.server 8080
```

Open `http://localhost:8080`, and on the login screen enter:
- **Password**: whatever `APP_PASSWORD` is set to on the backend
- **Server URL**: `http://localhost:8000` (or wherever the backend is running)

## What's been tested

Since this sandbox has no real browser available, testing took two
forms:

1. **Static verification** — every `getElementById` call in `app.js`
   (including the six that build IDs from template literals, like
   `${prefix}-amount-exc`) was cross-checked against every `id=` in
   `index.html` and confirmed to resolve; `node --check app.js` confirms
   no syntax errors; the HTML was run through a real parser to confirm
   no unclosed/mismatched tags.
2. **Live request simulation** — every request shape `app.js` sends
   (login check, course load, course-autofill formula, customer-ID and
   doc-number live preview, invoice/receipt/enrolment generation,
   email send with both its error paths, history list/delete,
   settings save/load) was replicated exactly against the real running
   backend and confirmed to behave as the JS expects — correct status
   codes, correct PDF content-type/magic-bytes, correct
   `Content-Disposition` filename format that the JS parses back out
   with a regex, correct `{success, error}` shape for both email
   failure modes.

**Not yet done**: a real click-through in an actual browser. The logic
and contract are verified; what's unverified is purely
presentation-layer (does it look right, does focus/tab order feel
right, does the modal overlay behave as expected on a touch device).
Worth doing once you have a moment — open it locally and run through
each tab once.

## Deploying

This is a plain static file pair, so it deploys identically to any
static host. Two solid free, trusted options:

- **Cloudflare Pages** — no documented bandwidth cap, explicit
  commercial-use allowance on the free tier, backed by one of the
  largest infrastructure companies around. Drag-and-drop the
  `frontend/` folder in the dashboard, or connect a GitHub repo.
- **Render Static Site** — if you'd rather keep both frontend and
  backend in one dashboard alongside the existing Render web service.

Either way: once deployed, open the live URL, and on the login screen
set **Server URL** to your deployed backend's Render URL (e.g.
`https://alexdd-backend.onrender.com`) — you'll only need to type that
once per browser session, since it's not persisted between page
reloads. If you want it pre-filled instead of typed every time, set
`DEFAULT_SERVER_URL` near the top of `app.js` to your backend's URL
before deploying.

## Known rough edges / next steps

- **CORS**: `backend/main.py` currently allows all origins
  (`allow_origins=["*"]`) for local testing. Once the frontend has a
  real deployed URL, lock that down to just that origin.
- **Course picker UX**: the desktop app's searchable type-to-filter
  picker was simplified to a plain `<select>` plus a free-text
  override on Register. This is a UI simplification, not a data
  change — all the same courses are there, just selected differently.
  If the full search-as-you-type behavior is wanted back, it's an
  enhancement to layer on later rather than a gap to fix now.
- **First real-browser pass**: see "What's been tested" above.
