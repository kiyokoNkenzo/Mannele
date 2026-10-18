# Mannele｜まんねれ — relationship notebook

A private, cozy **relationship memory assistant**. Mannele quietly remembers the
things people tell you — their interests, important dates, what they're going
through, gift ideas, and what you last talked about — so you can show up for the
people you love. Think personal CRM, minus the sales-funnel creepiness.

The interface is modelled on mid-2000s Japanese social and blog sites rather
than a modern app template:

- **mixi (PC site, c. 2005–2010)**: fixed-width three-column layout, boxes with
  an orange header band, a 3×3 friend photo grid with "Name (n)", a two-column
  profile table with shaded label cells, dated lists ("10/05(Sun) ・ title (name)")
  and ★ birthday notices.
- **Ameblo / Hatena blog sidebars**: the mini calendar with Sundays in red and
  Saturdays in blue, "more »" links, a centred copyright footer.
- **TV drama / anime 人物相関図**: the relationship chart, with portraits on name
  plates and coloured arrows carrying short labels.

Each person gets a small anime-style portrait you design yourself.

## Features

- **People** with a small portrait you design (hair, eyes, accessories…), nickname, pronouns, group, birthday (year optional) and how you met.
- **Photos**: the drawn portrait stays the main picture everywhere, and you can add up to 3 real photos per person (shown under the portrait on their page, click to view, with captions). Photos are resized in the browser before upload, stored as files next to the database, and included in backups.
- **Notes** per person, by category: worries, interests, likes, dislikes, gift ideas, goals, notes. Pin them, mark worries resolved, mark gifts given.
- **Conversation log**: what you talked about, how they seemed, and what to ask next time.
- **Dates**: birthdays, anniversaries and one-off events, with "turning 30" / "5th" countdowns.
- **Connections (相関図)**: link people (siblings, partners, roommates, coworkers, pets…) and explore them in a draggable chart with you in the centre.
- **Home**: upcoming dates, who to check in on, follow-ups, people you haven't talked to in a while (per-person reminder interval), gift ideas and recent conversations.
- **Before you meet**: a summary card at the top of each person's page (what to ask about, open worries, last conversation, the next date, likes and dislikes) that prints as a one-page cheat sheet.
- **Gift and worry history**: the date a gift was given or a worry resolved is recorded; a "Gifts given" list and a warning when you note a gift similar to one you already gave.
- **Archive** people you've drifted from or who moved away: they keep all their notes but leave reminders, the calendar and the chart.
- **Calendar subscription**: a private `.ics` link (or a one-off download) puts birthdays and dates into your phone or computer calendar.
- **Contacts import**: add people from a `.vcf` export (phone, Google, iCloud, Outlook) including birthdays, notes and photos.
- **Automatic daily backups** on the server (compressed, newest 14 kept) that you can download and restore from Settings.
- One-click "talked today" for when you just want to reset the check-in reminder.
- Search across everything, quick "Jot down" button (`n` shortcut, `/` to search).
- Light and dark themes, works on phones.
- JSON backup/restore. Optional password.

## Privacy

- No accounts, no cloud, no analytics, no external fonts or CDNs — the page never talks to anyone but your own server (enforced by a strict Content-Security-Policy).
- All data lives in the Docker volume: one SQLite file (`/data/mannele.db`) plus uploaded photos in `/data/photos/`. Photos are only served to a logged-in session when a password is set.
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
| `BACKUP_KEEP`   | `14`    | Daily automatic backups to keep (`0` turns them off) |

**Backups:** a compressed backup is written to `/data/backups/` every day (newest 14 kept). Settings → *Download backup* gives a JSON file on demand, and *Restore from file* accepts both kinds (merge or replace).

**Calendar subscription:** Settings → *Calendar* shows a private link like `http://your-server:8080/ics/<token>.ics`. The link works without a login so calendar apps can fetch it, so keep it private and use *Make a new link* if it leaks. Your calendar app has to be able to reach the server; with the default `127.0.0.1` port binding that's only this computer, so use the *Download .ics file* button otherwise.

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
