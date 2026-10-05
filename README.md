# Mannele｜まんねれ — relationship notebook

A private, cozy **relationship memory assistant**. Mannele quietly remembers the
things people tell you — their interests, important dates, what they're going
through, gift ideas, and what you last talked about — so you can show up for the
people you love. Think personal CRM, minus the sales-funnel creepiness.

The interface takes its cues from Japanese websites: washi-paper background,
vermilion and indigo accents, bilingual section headings (Upcoming 近日の予定),
news-style date lists (2026.10.14), breadcrumbs, spec tables and a 相関図-style
relationship chart, with small anime-style portraits for each person.

## Features

- **People** with a small portrait you design (hair, eyes, accessories…), nickname, pronouns, group, birthday (year optional) and how you met.
- **Notes** per person, by category: worries, interests, likes, dislikes, gift ideas, goals, notes. Pin them, mark worries resolved, mark gifts given.
- **Conversation log**: what you talked about, how they seemed, and what to ask next time.
- **Dates**: birthdays, anniversaries and one-off events, with "turning 30" / "5th" countdowns.
- **Connections (相関図)**: link people (siblings, partners, roommates, coworkers, pets…) and explore them in a draggable chart with you in the centre.
- **Home**: upcoming dates, who to check in on, follow-ups, people you haven't talked to in a while (per-person reminder interval), gift ideas and recent conversations.
- Search across everything, quick "Jot down" button (`n` shortcut, `/` to search).
- Light and dark themes, works on phones.
- JSON backup/restore. Optional password.

## Privacy

- No accounts, no cloud, no analytics, no external fonts or CDNs — the page never talks to anyone but your own server (enforced by a strict Content-Security-Policy).
- All data lives in one SQLite file (`/data/mannele.db`) in a Docker volume.
- The compose file binds to `127.0.0.1` only. Set `APP_PASSWORD` if you expose it on your network, and put it behind HTTPS (`COOKIE_SECURE=1`) if you expose it further.

## Run it

```bash
docker compose up -d --build
# open http://localhost:8080
```

With example people and a password:

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
| `SEED_DEMO`     | `0`     | `1` adds example people on first start (empty DB)    |
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
app/seed.py          example people
app/static/          single-page app (app.js, avatar.js portrait generator, style.css)
tests/test_api.py    end-to-end API tests
```
