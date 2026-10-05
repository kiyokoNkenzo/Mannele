"""Mannele — a cozy, private relationship memory assistant.

A tiny dependency-free web server (Python stdlib + SQLite) that serves a
single-page app and a small JSON API. Everything stays on your own machine,
inside the SQLite file in DATA_DIR.
"""

import hashlib
import hmac
import json
import mimetypes
import os
import re
import secrets
import sqlite3
import threading
import time
from datetime import date, datetime, timedelta
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

BASE_DIR = Path(__file__).resolve().parent
STATIC_DIR = BASE_DIR / "static"
DATA_DIR = Path(os.environ.get("DATA_DIR", BASE_DIR.parent / "data"))
DB_PATH = DATA_DIR / "mannele.db"
HOST = os.environ.get("HOST", "0.0.0.0")
PORT = int(os.environ.get("PORT", "8080"))
APP_PASSWORD = os.environ.get("APP_PASSWORD", "")
SESSION_DAYS = 30
MAX_BODY = 5 * 1024 * 1024

SCHEMA = """
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS people (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    name          TEXT NOT NULL,
    nickname      TEXT NOT NULL DEFAULT '',
    pronouns      TEXT NOT NULL DEFAULT '',
    birthday      TEXT NOT NULL DEFAULT '',
    circle        TEXT NOT NULL DEFAULT 'friends',
    how_met       TEXT NOT NULL DEFAULT '',
    notes         TEXT NOT NULL DEFAULT '',
    avatar        TEXT NOT NULL DEFAULT '{}',
    checkin_days  INTEGER NOT NULL DEFAULT 30,
    favorite      INTEGER NOT NULL DEFAULT 0,
    created_at    TEXT NOT NULL,
    updated_at    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS memories (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    person_id   INTEGER NOT NULL REFERENCES people(id) ON DELETE CASCADE,
    kind        TEXT NOT NULL DEFAULT 'note',
    text        TEXT NOT NULL,
    detail      TEXT NOT NULL DEFAULT '',
    status      TEXT NOT NULL DEFAULT 'open',
    pinned      INTEGER NOT NULL DEFAULT 0,
    created_at  TEXT NOT NULL,
    updated_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS dates (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    person_id   INTEGER NOT NULL REFERENCES people(id) ON DELETE CASCADE,
    label       TEXT NOT NULL,
    date        TEXT NOT NULL,
    yearly      INTEGER NOT NULL DEFAULT 1,
    notes       TEXT NOT NULL DEFAULT '',
    created_at  TEXT NOT NULL,
    updated_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS interactions (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    person_id   INTEGER NOT NULL REFERENCES people(id) ON DELETE CASCADE,
    date        TEXT NOT NULL,
    mode        TEXT NOT NULL DEFAULT 'chat',
    topics      TEXT NOT NULL DEFAULT '',
    mood        TEXT NOT NULL DEFAULT '',
    follow_up   TEXT NOT NULL DEFAULT '',
    created_at  TEXT NOT NULL,
    updated_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS relationships (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    a_id        INTEGER NOT NULL REFERENCES people(id) ON DELETE CASCADE,
    b_id        INTEGER NOT NULL REFERENCES people(id) ON DELETE CASCADE,
    kind        TEXT NOT NULL DEFAULT 'friend',
    notes       TEXT NOT NULL DEFAULT '',
    created_at  TEXT NOT NULL,
    updated_at  TEXT NOT NULL,
    CHECK (a_id <> b_id)
);

CREATE TABLE IF NOT EXISTS meta (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_memories_person ON memories(person_id);
CREATE INDEX IF NOT EXISTS idx_dates_person ON dates(person_id);
CREATE INDEX IF NOT EXISTS idx_interactions_person ON interactions(person_id, date);
CREATE INDEX IF NOT EXISTS idx_rel_a ON relationships(a_id);
CREATE INDEX IF NOT EXISTS idx_rel_b ON relationships(b_id);
"""

CIRCLES = {"family", "partner", "friends", "work", "community", "other"}
MEMORY_KINDS = {"interest", "like", "dislike", "problem", "gift", "note", "goal"}
MEMORY_STATUSES = {"open", "resolved", "given", "archived"}
INTERACTION_MODES = {"chat", "call", "text", "meet", "video", "letter", "event"}
REL_KINDS = {
    "friend", "best_friend", "partner", "spouse", "ex", "crush", "sibling",
    "parent", "child", "grandparent", "grandchild", "cousin", "relative", "roommate", "coworker", "boss",
    "classmate", "mentor", "mentee", "neighbor", "pet", "owner", "report",
}

DATE_RE = re.compile(r"^(\d{4}-|--)(\d{2})-(\d{2})$")  # YYYY-MM-DD or --MM-DD


class ApiError(Exception):
    def __init__(self, status, message):
        super().__init__(message)
        self.status = status
        self.message = message


# --------------------------------------------------------------------------
# Database
# --------------------------------------------------------------------------

_local = threading.local()


def db():
    conn = getattr(_local, "conn", None)
    if conn is None:
        conn = sqlite3.connect(DB_PATH, timeout=10)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA foreign_keys = ON")
        conn.execute("PRAGMA journal_mode = WAL")
        _local.conn = conn
    return conn


def init_db():
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    conn = db()
    conn.executescript(SCHEMA)
    conn.commit()


def now_iso():
    return datetime.now().isoformat(timespec="seconds")


def rows(sql, params=()):
    return [dict(r) for r in db().execute(sql, params).fetchall()]


def one(sql, params=()):
    r = db().execute(sql, params).fetchone()
    return dict(r) if r else None


def meta_get(key, default=None):
    r = one("SELECT value FROM meta WHERE key = ?", (key,))
    return r["value"] if r else default


def meta_set(key, value):
    db().execute(
        "INSERT INTO meta(key, value) VALUES(?, ?) "
        "ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        (key, value),
    )
    db().commit()


# --------------------------------------------------------------------------
# Validation helpers
# --------------------------------------------------------------------------


def clean_str(value, field, max_len=2000, required=False):
    if value is None:
        value = ""
    if not isinstance(value, str):
        value = str(value)
    value = value.strip()
    if required and not value:
        raise ApiError(400, f"'{field}' is required")
    if len(value) > max_len:
        raise ApiError(400, f"'{field}' is too long (max {max_len} characters)")
    return value


def clean_date(value, field, allow_no_year=False, required=False):
    value = clean_str(value, field, 10, required=required)
    if not value:
        return ""
    m = DATE_RE.match(value)
    if not m or (m.group(1) == "--" and not allow_no_year):
        raise ApiError(400, f"'{field}' must look like YYYY-MM-DD")
    year = 2000 if m.group(1) == "--" else int(m.group(1)[:4])
    try:
        date(year, int(m.group(2)), int(m.group(3)))
    except ValueError:
        raise ApiError(400, f"'{field}' is not a real date")
    return value


def clean_enum(value, field, allowed, default):
    if value in (None, ""):
        return default
    if value not in allowed:
        raise ApiError(400, f"'{field}' must be one of: {', '.join(sorted(allowed))}")
    return value


def clean_bool(value):
    return 1 if value in (True, 1, "1", "true", "on") else 0


def clean_int(value, field, lo, hi, default):
    if value in (None, ""):
        return default
    try:
        value = int(value)
    except (TypeError, ValueError):
        raise ApiError(400, f"'{field}' must be a number")
    return max(lo, min(hi, value))


def clean_avatar(value):
    if isinstance(value, str):
        try:
            value = json.loads(value or "{}")
        except json.JSONDecodeError:
            value = {}
    if not isinstance(value, dict):
        value = {}
    out = {}
    for k, v in value.items():
        if isinstance(k, str) and len(k) <= 20 and isinstance(v, (str, int, float, bool)):
            out[k] = v if not isinstance(v, str) else v[:40]
    return json.dumps(out)


# Each validator takes (payload, partial) and returns a dict of columns.


def v_person(p, partial=False):
    out = {}
    if not partial or "name" in p:
        out["name"] = clean_str(p.get("name"), "name", 120, required=True)
    fields = {
        "nickname": lambda v: clean_str(v, "nickname", 120),
        "pronouns": lambda v: clean_str(v, "pronouns", 40),
        "birthday": lambda v: clean_date(v, "birthday", allow_no_year=True),
        "circle": lambda v: clean_enum(v, "circle", CIRCLES, "friends"),
        "how_met": lambda v: clean_str(v, "how_met", 2000),
        "notes": lambda v: clean_str(v, "notes", 10000),
        "avatar": clean_avatar,
        "checkin_days": lambda v: clean_int(v, "checkin_days", 0, 3650, 30),
        "favorite": clean_bool,
    }
    for k, fn in fields.items():
        if not partial or k in p:
            out[k] = fn(p.get(k))
    return out


def v_memory(p, partial=False):
    out = {}
    if not partial or "text" in p:
        out["text"] = clean_str(p.get("text"), "text", 1000, required=True)
    fields = {
        "kind": lambda v: clean_enum(v, "kind", MEMORY_KINDS, "note"),
        "detail": lambda v: clean_str(v, "detail", 5000),
        "status": lambda v: clean_enum(v, "status", MEMORY_STATUSES, "open"),
        "pinned": clean_bool,
    }
    for k, fn in fields.items():
        if not partial or k in p:
            out[k] = fn(p.get(k))
    return out


def v_date(p, partial=False):
    out = {}
    if not partial or "label" in p:
        out["label"] = clean_str(p.get("label"), "label", 200, required=True)
    if not partial or "date" in p:
        out["date"] = clean_date(p.get("date"), "date", allow_no_year=True, required=True)
    if not partial or "yearly" in p:
        out["yearly"] = clean_bool(p.get("yearly", True))
    if not partial or "notes" in p:
        out["notes"] = clean_str(p.get("notes"), "notes", 2000)
    if out.get("date", "").startswith("--"):
        out["yearly"] = 1
    return out


def v_interaction(p, partial=False):
    out = {}
    if not partial or "date" in p:
        out["date"] = clean_date(p.get("date") or date.today().isoformat(), "date")
    fields = {
        "mode": lambda v: clean_enum(v, "mode", INTERACTION_MODES, "chat"),
        "topics": lambda v: clean_str(v, "topics", 5000),
        "mood": lambda v: clean_str(v, "mood", 40),
        "follow_up": lambda v: clean_str(v, "follow_up", 2000),
    }
    for k, fn in fields.items():
        if not partial or k in p:
            out[k] = fn(p.get(k))
    return out


def v_relationship(p, partial=False):
    out = {}
    for k in ("a_id", "b_id"):
        if not partial or k in p:
            try:
                out[k] = int(p.get(k))
            except (TypeError, ValueError):
                raise ApiError(400, f"'{k}' must be a person id")
            if not one("SELECT id FROM people WHERE id = ?", (out[k],)):
                raise ApiError(400, f"'{k}' refers to an unknown person")
    if "a_id" in out and "b_id" in out and out["a_id"] == out["b_id"]:
        raise ApiError(400, "a relationship needs two different people")
    if not partial or "kind" in p:
        out["kind"] = clean_enum(p.get("kind"), "kind", REL_KINDS, "friend")
    if not partial or "notes" in p:
        out["notes"] = clean_str(p.get("notes"), "notes", 2000)
    return out


TABLES = {
    "people": v_person,
    "memories": v_memory,
    "dates": v_date,
    "interactions": v_interaction,
    "relationships": v_relationship,
}


def insert(table, values):
    values = dict(values)
    values["created_at"] = values["updated_at"] = now_iso()
    cols = ", ".join(values)
    qs = ", ".join("?" for _ in values)
    cur = db().execute(f"INSERT INTO {table} ({cols}) VALUES ({qs})", list(values.values()))
    db().commit()
    return one(f"SELECT * FROM {table} WHERE id = ?", (cur.lastrowid,))


def update(table, row_id, values):
    if not one(f"SELECT id FROM {table} WHERE id = ?", (row_id,)):
        raise ApiError(404, "not found")
    if values:
        values = dict(values)
        values["updated_at"] = now_iso()
        sets = ", ".join(f"{k} = ?" for k in values)
        db().execute(f"UPDATE {table} SET {sets} WHERE id = ?", [*values.values(), row_id])
        db().commit()
    return one(f"SELECT * FROM {table} WHERE id = ?", (row_id,))


def delete(table, row_id):
    cur = db().execute(f"DELETE FROM {table} WHERE id = ?", (row_id,))
    db().commit()
    if cur.rowcount == 0:
        raise ApiError(404, "not found")
    return {"ok": True}


# --------------------------------------------------------------------------
# Domain logic
# --------------------------------------------------------------------------


def next_occurrence(date_str, today=None):
    """Return (next_date, years_since_or_None) for a YYYY-MM-DD / --MM-DD date."""
    today = today or date.today()
    m = DATE_RE.match(date_str or "")
    if not m:
        return None, None
    month, day = int(m.group(2)), int(m.group(3))
    year0 = None if m.group(1) == "--" else int(m.group(1)[:4])

    def make(y):
        try:
            return date(y, month, day)
        except ValueError:  # Feb 29 on a non-leap year
            return date(y, 2, 28)

    nxt = make(today.year)
    if nxt < today:
        nxt = make(today.year + 1)
    years = (nxt.year - year0) if year0 else None
    return nxt, years


def upcoming_dates(days=60, person_id=None, today=None):
    today = today or date.today()
    out = []
    where = "WHERE id = ?" if person_id else ""
    params = (person_id,) if person_id else ()
    for p in rows(f"SELECT id, name, nickname, avatar, birthday FROM people {where}", params):
        if p["birthday"]:
            nxt, years = next_occurrence(p["birthday"], today)
            if nxt and (nxt - today).days <= days:
                out.append({
                    "type": "birthday", "id": None, "person_id": p["id"],
                    "person_name": p["nickname"] or p["name"], "avatar": p["avatar"],
                    "label": "Birthday", "date": nxt.isoformat(),
                    "days": (nxt - today).days, "years": years,
                })
    where = "WHERE d.person_id = ?" if person_id else ""
    for d in rows(
        "SELECT d.*, p.name, p.nickname, p.avatar FROM dates d "
        f"JOIN people p ON p.id = d.person_id {where}", params,
    ):
        if d["yearly"]:
            nxt, years = next_occurrence(d["date"], today)
        else:
            try:
                nxt, years = date.fromisoformat(d["date"]), None
            except ValueError:
                continue
            if nxt < today:
                continue
        if nxt and (nxt - today).days <= days:
            out.append({
                "type": "date", "id": d["id"], "person_id": d["person_id"],
                "person_name": d["nickname"] or d["name"], "avatar": d["avatar"],
                "label": d["label"], "date": nxt.isoformat(),
                "days": (nxt - today).days, "years": years, "notes": d["notes"],
            })
    out.sort(key=lambda x: (x["days"], x["person_name"].lower()))
    return out


PEOPLE_SUMMARY_SQL = """
SELECT p.*,
  (SELECT MAX(date) FROM interactions i WHERE i.person_id = p.id) AS last_contact,
  (SELECT COUNT(*) FROM memories m WHERE m.person_id = p.id) AS memory_count,
  (SELECT COUNT(*) FROM memories m WHERE m.person_id = p.id
       AND m.kind = 'problem' AND m.status = 'open') AS open_problems,
  (SELECT COUNT(*) FROM memories m WHERE m.person_id = p.id
       AND m.kind = 'gift' AND m.status = 'open') AS gift_ideas,
  (SELECT COUNT(*) FROM relationships r WHERE r.a_id = p.id OR r.b_id = p.id) AS link_count
FROM people p
"""


def with_contact_info(p, today=None):
    today = today or date.today()
    days_since = None
    if p.get("last_contact"):
        days_since = (today - date.fromisoformat(p["last_contact"])).days
    p["days_since_contact"] = days_since
    p["overdue"] = bool(
        p["checkin_days"]
        and (days_since is None or days_since > p["checkin_days"])
    )
    if p.get("birthday"):
        nxt, years = next_occurrence(p["birthday"], today)
        p["next_birthday"] = nxt.isoformat() if nxt else None
        p["next_birthday_days"] = (nxt - today).days if nxt else None
        p["turning"] = years
    return p


def list_people():
    ppl = rows(PEOPLE_SUMMARY_SQL + " ORDER BY p.favorite DESC, lower(p.name)")
    return [with_contact_info(p) for p in ppl]


def get_person(pid):
    p = one(PEOPLE_SUMMARY_SQL + " WHERE p.id = ?", (pid,))
    if not p:
        raise ApiError(404, "person not found")
    with_contact_info(p)
    p["memories"] = rows(
        "SELECT * FROM memories WHERE person_id = ? "
        "ORDER BY pinned DESC, (status = 'open') DESC, created_at DESC, id DESC", (pid,),
    )
    p["dates"] = rows("SELECT * FROM dates WHERE person_id = ? ORDER BY substr(date, 6)", (pid,))
    p["interactions"] = rows(
        "SELECT * FROM interactions WHERE person_id = ? ORDER BY date DESC, id DESC", (pid,),
    )
    p["relationships"] = rows(
        """
        SELECT r.*, pa.name AS a_name, pa.nickname AS a_nickname, pa.avatar AS a_avatar,
               pb.name AS b_name, pb.nickname AS b_nickname, pb.avatar AS b_avatar
        FROM relationships r
        JOIN people pa ON pa.id = r.a_id
        JOIN people pb ON pb.id = r.b_id
        WHERE r.a_id = ? OR r.b_id = ?
        ORDER BY r.kind
        """, (pid, pid),
    )
    p["upcoming"] = upcoming_dates(366, pid)
    return p


def dashboard():
    people = list_people()
    open_problems = rows(
        "SELECT m.*, p.name, p.nickname, p.avatar FROM memories m "
        "JOIN people p ON p.id = m.person_id "
        "WHERE m.kind = 'problem' AND m.status = 'open' "
        "ORDER BY m.pinned DESC, m.updated_at DESC LIMIT 12"
    )
    follow_ups = rows(
        "SELECT i.*, p.name, p.nickname, p.avatar FROM interactions i "
        "JOIN people p ON p.id = i.person_id "
        "WHERE i.follow_up <> '' AND i.id IN ("
        "  SELECT MAX(id) FROM interactions GROUP BY person_id) "
        "ORDER BY i.date DESC LIMIT 12"
    )
    gifts = rows(
        "SELECT m.*, p.name, p.nickname, p.avatar FROM memories m "
        "JOIN people p ON p.id = m.person_id "
        "WHERE m.kind = 'gift' AND m.status = 'open' ORDER BY RANDOM() LIMIT 6"
    )
    recent = rows(
        "SELECT i.*, p.name, p.nickname, p.avatar FROM interactions i "
        "JOIN people p ON p.id = i.person_id ORDER BY i.date DESC, i.id DESC LIMIT 6"
    )
    overdue = [p for p in people if p["overdue"]]
    overdue.sort(key=lambda p: -(p["days_since_contact"] if p["days_since_contact"] is not None else 10**6))
    return {
        "counts": {
            "people": len(people),
            "memories": one("SELECT COUNT(*) AS c FROM memories")["c"],
            "relationships": one("SELECT COUNT(*) AS c FROM relationships")["c"],
            "interactions": one("SELECT COUNT(*) AS c FROM interactions")["c"],
        },
        "upcoming": upcoming_dates(45),
        "open_problems": open_problems,
        "follow_ups": follow_ups,
        "gift_ideas": gifts,
        "recent": recent,
        "overdue": overdue[:8],
    }


def search(q):
    q = (q or "").strip()
    if not q:
        return {"people": [], "memories": [], "interactions": []}
    like = f"%{q}%"
    return {
        "people": rows(
            "SELECT id, name, nickname, avatar, circle FROM people "
            "WHERE name LIKE ? OR nickname LIKE ? OR notes LIKE ? OR how_met LIKE ? "
            "ORDER BY lower(name) LIMIT 20", (like, like, like, like),
        ),
        "memories": rows(
            "SELECT m.*, p.name, p.nickname, p.avatar FROM memories m "
            "JOIN people p ON p.id = m.person_id "
            "WHERE m.text LIKE ? OR m.detail LIKE ? ORDER BY m.updated_at DESC LIMIT 40",
            (like, like),
        ),
        "interactions": rows(
            "SELECT i.*, p.name, p.nickname, p.avatar FROM interactions i "
            "JOIN people p ON p.id = i.person_id "
            "WHERE i.topics LIKE ? OR i.follow_up LIKE ? ORDER BY i.date DESC LIMIT 20",
            (like, like),
        ),
    }


def graph():
    return {
        "people": rows("SELECT id, name, nickname, avatar, circle, favorite FROM people"),
        "relationships": rows("SELECT * FROM relationships"),
    }


EXPORT_TABLES = ["people", "memories", "dates", "interactions", "relationships"]


def export_all():
    data = {"app": "mannele", "version": 1, "exported_at": now_iso()}
    for t in EXPORT_TABLES:
        data[t] = rows(f"SELECT * FROM {t} ORDER BY id")
    return data


def import_all(data, replace=False):
    if not isinstance(data, dict) or data.get("app") != "mannele":
        raise ApiError(400, "that doesn't look like a Mannele export")
    conn = db()
    id_map = {}
    try:
        conn.execute("BEGIN")
        if replace:
            for t in reversed(EXPORT_TABLES):
                conn.execute(f"DELETE FROM {t}")
        for p in data.get("people", []):
            vals = v_person(p)
            vals["created_at"] = p.get("created_at") or now_iso()
            vals["updated_at"] = p.get("updated_at") or now_iso()
            cur = conn.execute(
                f"INSERT INTO people ({', '.join(vals)}) VALUES ({', '.join('?' * len(vals))})",
                list(vals.values()),
            )
            id_map[p.get("id")] = cur.lastrowid
        validators = {"memories": v_memory, "dates": v_date, "interactions": v_interaction}
        for t, fn in validators.items():
            for r in data.get(t, []):
                pid = id_map.get(r.get("person_id"))
                if not pid:
                    continue
                vals = fn(r)
                vals["person_id"] = pid
                vals["created_at"] = r.get("created_at") or now_iso()
                vals["updated_at"] = r.get("updated_at") or now_iso()
                conn.execute(
                    f"INSERT INTO {t} ({', '.join(vals)}) VALUES ({', '.join('?' * len(vals))})",
                    list(vals.values()),
                )
        for r in data.get("relationships", []):
            a, b = id_map.get(r.get("a_id")), id_map.get(r.get("b_id"))
            if not a or not b or a == b:
                continue
            conn.execute(
                "INSERT INTO relationships (a_id, b_id, kind, notes, created_at, updated_at) "
                "VALUES (?, ?, ?, ?, ?, ?)",
                (a, b, clean_enum(r.get("kind"), "kind", REL_KINDS, "friend"),
                 clean_str(r.get("notes"), "notes", 2000), now_iso(), now_iso()),
            )
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    return {"ok": True, "people_imported": len(id_map)}


# --------------------------------------------------------------------------
# Auth (optional — enabled when APP_PASSWORD is set)
# --------------------------------------------------------------------------


def secret_key():
    key = meta_get("secret_key")
    if not key:
        key = secrets.token_hex(32)
        meta_set("secret_key", key)
    return key.encode()


def make_token():
    expires = int(time.time()) + SESSION_DAYS * 86400
    pw_tag = hashlib.sha256(APP_PASSWORD.encode()).hexdigest()[:16]
    msg = f"{expires}.{pw_tag}"
    sig = hmac.new(secret_key(), msg.encode(), hashlib.sha256).hexdigest()
    return f"{msg}.{sig}"


def valid_token(token):
    try:
        expires, pw_tag, sig = token.split(".")
        msg = f"{expires}.{pw_tag}"
        good = hmac.new(secret_key(), msg.encode(), hashlib.sha256).hexdigest()
        current_tag = hashlib.sha256(APP_PASSWORD.encode()).hexdigest()[:16]
        return (
            hmac.compare_digest(sig, good)
            and hmac.compare_digest(pw_tag, current_tag)
            and int(expires) > time.time()
        )
    except (ValueError, AttributeError):
        return False


_login_attempts = {}
_login_lock = threading.Lock()


def throttle_login(ip):
    with _login_lock:
        now = time.time()
        attempts = [t for t in _login_attempts.get(ip, []) if now - t < 300]
        if len(attempts) >= 10:
            raise ApiError(429, "too many attempts — take a breather and try again in a few minutes")
        attempts.append(now)
        _login_attempts[ip] = attempts


# --------------------------------------------------------------------------
# HTTP
# --------------------------------------------------------------------------

ROUTES = []


def route(method, pattern):
    regex = re.compile("^" + re.sub(r":(\w+)", r"(?P<\1>\\d+)", pattern) + "$")

    def deco(fn):
        ROUTES.append((method, regex, fn))
        return fn

    return deco


@route("GET", "/api/dashboard")
def r_dashboard(h, body, q):
    return dashboard()


@route("GET", "/api/people")
def r_people(h, body, q):
    return list_people()


@route("POST", "/api/people")
def r_people_create(h, body, q):
    p = insert("people", v_person(body))
    return get_person(p["id"])


@route("GET", "/api/people/:id")
def r_person(h, body, q, id):
    return get_person(int(id))


@route("PUT", "/api/people/:id")
def r_person_update(h, body, q, id):
    update("people", int(id), v_person(body, partial=True))
    return get_person(int(id))


@route("DELETE", "/api/people/:id")
def r_person_delete(h, body, q, id):
    return delete("people", int(id))


def make_child_routes(table):
    @route("POST", f"/api/people/:id/{table}")
    def create(h, body, q, id):
        get_person(int(id))  # 404 if missing
        vals = TABLES[table](body)
        vals["person_id"] = int(id)
        return insert(table, vals)

    @route("PUT", f"/api/{table}/:id")
    def upd(h, body, q, id):
        return update(table, int(id), TABLES[table](body, partial=True))

    @route("DELETE", f"/api/{table}/:id")
    def dele(h, body, q, id):
        return delete(table, int(id))


for _t in ("memories", "dates", "interactions"):
    make_child_routes(_t)


@route("GET", "/api/relationships")
def r_rels(h, body, q):
    return graph()


@route("POST", "/api/relationships")
def r_rel_create(h, body, q):
    return insert("relationships", v_relationship(body))


@route("PUT", "/api/relationships/:id")
def r_rel_update(h, body, q, id):
    return update("relationships", int(id), v_relationship(body, partial=True))


@route("DELETE", "/api/relationships/:id")
def r_rel_delete(h, body, q, id):
    return delete("relationships", int(id))


@route("GET", "/api/upcoming")
def r_upcoming(h, body, q):
    days = clean_int(q.get("days", [None])[0], "days", 1, 366, 366)
    return upcoming_dates(days)


@route("GET", "/api/search")
def r_search(h, body, q):
    return search(q.get("q", [""])[0])


@route("GET", "/api/export")
def r_export(h, body, q):
    return export_all()


@route("POST", "/api/import")
def r_import(h, body, q):
    return import_all(body.get("data"), replace=bool(body.get("replace")))


@route("POST", "/api/demo")
def r_demo(h, body, q):
    from seed import seed_demo
    seed_demo()
    return {"ok": True}


@route("GET", "/api/meta")
def r_meta(h, body, q):
    return {
        "circles": sorted(CIRCLES),
        "memory_kinds": sorted(MEMORY_KINDS),
        "interaction_modes": sorted(INTERACTION_MODES),
        "relationship_kinds": sorted(REL_KINDS),
        "auth": bool(APP_PASSWORD),
        "today": date.today().isoformat(),
    }


class Handler(BaseHTTPRequestHandler):
    server_version = "Mannele/1.0"

    def log_message(self, fmt, *args):
        if os.environ.get("QUIET") != "1":
            super().log_message(fmt, *args)

    # -- helpers -----------------------------------------------------------

    def send_json(self, status, payload, headers=None):
        data = json.dumps(payload).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-store")
        for k, v in (headers or {}).items():
            self.send_header(k, v)
        self.end_headers()
        self.wfile.write(data)

    def read_body(self):
        length = int(self.headers.get("Content-Length") or 0)
        if length > MAX_BODY:
            raise ApiError(413, "request too large")
        if not length:
            return {}
        try:
            data = json.loads(self.rfile.read(length))
        except json.JSONDecodeError:
            raise ApiError(400, "invalid JSON")
        if not isinstance(data, dict):
            raise ApiError(400, "expected a JSON object")
        return data

    def cookie(self, name):
        for part in (self.headers.get("Cookie") or "").split(";"):
            k, _, v = part.strip().partition("=")
            if k == name:
                return v
        return None

    def authed(self):
        return not APP_PASSWORD or valid_token(self.cookie("mannele_session") or "")

    def security_headers(self):
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Referrer-Policy", "no-referrer")
        self.send_header("X-Frame-Options", "DENY")
        self.send_header(
            "Content-Security-Policy",
            "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; "
            "script-src 'self'; connect-src 'self'; font-src 'self' data:",
        )

    def end_headers(self):
        self.security_headers()
        super().end_headers()

    # -- dispatch ----------------------------------------------------------

    def handle_api(self, method):
        url = urlparse(self.path)
        try:
            body = self.read_body() if method in ("POST", "PUT") else {}

            if url.path == "/api/login" and method == "POST":
                if not APP_PASSWORD:
                    return self.send_json(200, {"ok": True})
                throttle_login(self.client_address[0])
                pw = str(body.get("password") or "")
                if not hmac.compare_digest(pw.encode(), APP_PASSWORD.encode()):
                    raise ApiError(401, "incorrect password")
                cookie = (
                    f"mannele_session={make_token()}; Path=/; HttpOnly; SameSite=Strict; "
                    f"Max-Age={SESSION_DAYS * 86400}"
                )
                if os.environ.get("COOKIE_SECURE") == "1":
                    cookie += "; Secure"
                return self.send_json(200, {"ok": True}, {"Set-Cookie": cookie})

            if url.path == "/api/logout" and method == "POST":
                return self.send_json(200, {"ok": True}, {
                    "Set-Cookie": "mannele_session=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0"
                })

            if url.path == "/api/session":
                return self.send_json(200, {"authed": self.authed(), "auth": bool(APP_PASSWORD)})

            if not self.authed():
                raise ApiError(401, "login required")

            if method != "GET":
                # CSRF guard: same-origin JSON requests only.
                if "application/json" not in (self.headers.get("Content-Type") or "") and method != "DELETE":
                    raise ApiError(415, "expected application/json")
                if self.headers.get("X-Requested-With") != "mannele":
                    raise ApiError(403, "missing request header")

            q = parse_qs(url.query)
            for m, regex, fn in ROUTES:
                if m != method:
                    continue
                match = regex.match(url.path)
                if match:
                    return self.send_json(200, fn(self, body, q, **match.groupdict()))
            raise ApiError(404, "no such endpoint")
        except ApiError as e:
            self.send_json(e.status, {"error": e.message})
        except sqlite3.IntegrityError as e:
            self.send_json(400, {"error": f"database constraint: {e}"})
        except Exception as e:  # pragma: no cover - last resort
            self.log_error("unhandled error: %r", e)
            self.send_json(500, {"error": "something went wrong"})

    def serve_static(self):
        path = urlparse(self.path).path
        if path in ("", "/"):
            path = "/index.html"
        target = (STATIC_DIR / path.lstrip("/")).resolve()
        if not str(target).startswith(str(STATIC_DIR.resolve())) or not target.is_file():
            target = STATIC_DIR / "index.html"  # SPA fallback
        data = target.read_bytes()
        ctype = mimetypes.guess_type(str(target))[0] or "application/octet-stream"
        if ctype.startswith("text/") or ctype in ("application/javascript", "image/svg+xml"):
            ctype += "; charset=utf-8"
        self.send_response(200)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-cache")
        self.end_headers()
        if self.command != "HEAD":
            self.wfile.write(data)

    def do_GET(self):
        if self.path.startswith("/api/"):
            return self.handle_api("GET")
        if self.path == "/healthz":
            return self.send_json(200, {"ok": True})
        self.serve_static()

    def do_HEAD(self):
        self.serve_static()

    def do_POST(self):
        self.handle_api("POST")

    def do_PUT(self):
        self.handle_api("PUT")

    def do_DELETE(self):
        self.handle_api("DELETE")


mimetypes.add_type("application/javascript", ".js")
mimetypes.add_type("image/svg+xml", ".svg")
mimetypes.add_type("application/manifest+json", ".webmanifest")


def main():
    init_db()
    if os.environ.get("SEED_DEMO") == "1" and not one("SELECT id FROM people LIMIT 1"):
        from seed import seed_demo
        seed_demo()
        print("Seeded demo people")
    server = ThreadingHTTPServer((HOST, PORT), Handler)
    print(f"Mannele is listening on http://{HOST}:{PORT}  (auth: {'on' if APP_PASSWORD else 'off'})")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
