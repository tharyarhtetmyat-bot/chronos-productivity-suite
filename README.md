# Chronos — Personal Productivity Suite

A private, fully client-side productivity workspace: **calendar, weekly schedule, habits, finance tracker, Kanban tasks with a Pomodoro timer, notes, analytics, and reminders**. No backend, no tracking, no dependencies — deploy it as static files on GitHub Pages.

## Run locally

```bash
python3 -m http.server 8080   # then open http://localhost:8080
```
(A local server is needed for the service worker and Web Crypto; `file://` will not work.)

## Features

| Area | What it does |
|---|---|
| Home | Pending tasks, active habits, net balance, today's agenda |
| Calendar & Events | Month grid, click a day to add events, edit/delete, optional reminder time |
| Weekly Schedule | Recurring weekly blocks with location; end-time validation |
| Habits | Daily check-ins with streaks that reset automatically after a missed day |
| Finance | Income/expense ledger (with delete), balance, quick bill splitter |
| Tasks & Focus | To Do / In Progress / Completed board, accurate 25-min Pomodoro |
| Notes | Scratchpad entries |
| Analytics | Completion and habit rates |
| Profile & Security | Profile, password change, recovery question, notification status |
| Quick Command | `Ctrl/⌘ + K` to jump anywhere or toggle theme / download backup |

Shortcuts: `Alt + 0…8` switch sections, `Space` starts/pauses the timer on the Tasks page, `Esc` closes dialogs.

## Security model (what it does and does not protect)

- Each account has a random 256-bit **data key**. Everything you store (`tasks`, `notes`, `budget`, …) is encrypted with it using **AES-GCM**.
- The data key is wrapped by a key derived from your **password** (PBKDF2-SHA-256, 600 000 iterations) and, separately, from your **recovery word**. No password or recovery word is stored anywhere; a successful unwrap *is* the check.
- Changing your password or resetting it with the recovery word only re-wraps the data key, so **your data is never lost or re-encrypted**.
- The session key lives in `sessionStorage` and disappears when the tab closes (you sign in again next time).
- Protects against: someone reading your browser's storage files or a copied profile.
- Does **not** protect against: malware or a malicious browser extension on your device, or a weak password. The recovery word is only as strong as the word you choose — pick something long and unguessable.
- Display name, bio, recovery *question* and username are stored unencrypted (needed on the sign-in screen).
- Backups are **plain JSON** so they can be restored into any account — keep the file private.
- A strict Content-Security-Policy blocks inline scripts and third-party code.

### Upgrading from an earlier version
Existing accounts migrate automatically on their next sign-in: data is re-encrypted under the new scheme and the old user database (which stored passwords in recoverable form) is deleted.

## Project structure

```
index.html            App shell
manifest.json, sw.js  PWA manifest and offline cache (bump CACHE in sw.js per release)
css/                  variables · styles · components · animations
js/cryptoEngine.js    AES-GCM / PBKDF2 primitives
js/storage.js         Encrypted per-user storage, backup/restore
js/auth.js            Accounts, sessions, recovery, migration
js/*Module.js ...     One file per feature
js/commandPalette.js  Quick Command
js/app.js             Navigation, shortcuts, shared helpers
assets/icon.png       App icon
```

## Deploy on GitHub Pages
Push to `main`, then **Settings → Pages → Deploy from branch → `main` / root**.
