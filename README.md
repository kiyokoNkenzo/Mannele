# ✿ Mannele — little memory garden

A private, cozy **relationship memory assistant**. Mannele quietly remembers the
things people tell you — their interests, important dates, what they're going
through, gift ideas, and what you last talked about — so you can show up for the
people you love. Think personal CRM, minus the sales-funnel creepiness, plus
pastel anime vibes. (◕‿◕✿)

## Features

- 🌸 **People** with hand-made chibi avatars (hair, eyes, cat ears, bows, glasses…), nicknames, pronouns, circles, birthdays (year optional) and "how we met".
- 💭 **Memory jar** per person: going through 🌧️, interests 🌟, loves 💖, dislikes 🙅, gift ideas 🎁, dreams 🌱, notes 📝 — pin them, resolve worries, mark gifts as given.
- ☕ **Chat log**: what you talked about, the vibe, and what to follow up on next time.
- 🗓️ **Special days**: birthdays, anniversaries and one-off moments, with "turning 30" / "5th anniversary" countdowns.
- 🕸️ **Friendship web**: link people (siblings, partners, roommates, coworkers, pets…) and explore them in a draggable graph with you in the middle.
- 🏡 **Home dashboard**: coming up, who to check in on, follow-ups, people you haven't talked to in a while (per-person check-in rhythm), a gift idea jar and recent chats.
- 🔎 Search across everything · ✎ quick "Jot it down" button (`n` shortcut, `/` to search).
- 🌙 Sakura-day and starry-night themes, falling petals (respects reduced motion), works on phones.
- 💾 JSON backup/restore. 🔐 Optional password.

## Privacy

- No accounts, no cloud, no analytics, no external fonts or CDNs — the page never talks to anyone but your own server (enforced by a strict Content-Security-Policy).
- All data lives in one SQLite file (`/data/mannele.db`) in a Docker volume.
- The compose file binds to `127.0.0.1` only. Set `APP_PASSWORD` if you expose it on your network, and put it behind HTTPS (`COOKIE_SECURE=1`) if you expose it further.

## Run it

```bash
docker compose up -d --build
# open http://localhost:8080
```

With demo friends and a password:

```bash
SEED_DEMO=1 APP_PASSWORD='secret word' docker compose up -d --build
```

Or plain Docker:

```bash
docker build -t mannele .
docker run -d -p 127.0.0.1:8080:8080 -v mannele-data:/data --name mannele mannele
```

| Variable        | Default | Meaning                                              |
| --------------- | ------- | ---------------------------------------------------- |
| `APP_PASSWORD`  | *(none)*| Require this password to open the app                |
| `SEED_DEMO`     | `0`     | `1` plants demo friends on first start (empty DB)    |
| `COOKIE_SECURE` | `0`     | `1` marks the session cookie `Secure` (HTTPS only)   |
| `TZ`            | `UTC`   | Your timezone, so "today" and countdowns are right   |
| `PORT`          | `8080`  | Port inside the container                            |
| `DATA_DIR`      | `/data` | Where the SQLite database lives                      |

**Backups:** Settings → *Download backup* gives a JSON file you can restore (merge or replace) later. You can also just copy `mannele.db` out of the volume.

## Development

No dependencies beyond Python 3.10+ — the backend is the standard library (`http.server` + `sqlite3`) and the frontend is vanilla JS/CSS.

```bash
cd app && SEED_DEMO=1 DATA_DIR=../data python server.py   # http://localhost:8080
python -m unittest discover tests                          # from the repo root
```

```
app/server.py        JSON API, auth, static file server
app/seed.py          demo friends
app/static/          single-page app (app.js, avatar.js chibi generator, style.css)
tests/test_api.py    end-to-end API tests
```
