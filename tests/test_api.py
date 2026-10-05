"""End-to-end API tests. Run with:  python -m unittest discover tests"""

import json
import os
import sys
import tempfile
import threading
import unittest
import urllib.error
import urllib.request
from datetime import date, timedelta
from pathlib import Path

TMP = tempfile.mkdtemp(prefix="mannele-test-")
os.environ["DATA_DIR"] = TMP
os.environ["QUIET"] = "1"
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "app"))

import server  # noqa: E402


def start(password=""):
    server.APP_PASSWORD = password
    server.init_db()
    httpd = server.ThreadingHTTPServer(("127.0.0.1", 0), server.Handler)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return httpd


class Client:
    def __init__(self, port):
        self.base = f"http://127.0.0.1:{port}"
        self.cookie = None

    def req(self, method, path, body=None, headers=None):
        data = json.dumps(body).encode() if body is not None else None
        h = {"X-Requested-With": "mannele"}
        if data is not None:
            h["Content-Type"] = "application/json"
        if self.cookie:
            h["Cookie"] = self.cookie
        h.update(headers or {})
        r = urllib.request.Request(self.base + path, data=data, method=method, headers=h)
        try:
            with urllib.request.urlopen(r) as resp:
                sc = resp.headers.get("Set-Cookie")
                if sc:
                    self.cookie = sc.split(";")[0]
                raw = resp.read()
                return resp.status, (json.loads(raw) if raw and "json" in resp.headers.get("Content-Type", "") else raw)
        except urllib.error.HTTPError as e:
            return e.code, json.loads(e.read() or b"{}")


class ApiTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.httpd = start()
        cls.c = Client(cls.httpd.server_address[1])

    @classmethod
    def tearDownClass(cls):
        cls.httpd.shutdown()

    def test_people_memories_dates_chats_relationships(self):
        c = self.c
        st, a = c.req("POST", "/api/people", {"name": "Aiko", "birthday": "--12-24", "circle": "friends",
                                              "avatar": {"hair": "#ff0000", "style": "bob"}})
        self.assertEqual(st, 200, a)
        self.assertEqual(a["birthday"], "--12-24")
        self.assertEqual(json.loads(a["avatar"])["style"], "bob")
        st, b = c.req("POST", "/api/people", {"name": "Bo"})
        self.assertEqual(st, 200)

        st, m = c.req("POST", f"/api/people/{a['id']}/memories", {"kind": "problem", "text": "Sore back"})
        self.assertEqual(st, 200, m)
        st, m2 = c.req("PUT", f"/api/memories/{m['id']}", {"status": "resolved"})
        self.assertEqual(m2["status"], "resolved")
        self.assertEqual(m2["text"], "Sore back")

        soon = (date.today() + timedelta(days=3)).isoformat()
        st, d = c.req("POST", f"/api/people/{a['id']}/dates", {"label": "Recital", "date": soon, "yearly": False})
        self.assertEqual(st, 200, d)

        st, i = c.req("POST", f"/api/people/{a['id']}/interactions",
                      {"topics": "Cats", "follow_up": "Ask about the recital"})
        self.assertEqual(st, 200, i)
        self.assertEqual(i["date"], date.today().isoformat())

        st, r = c.req("POST", "/api/relationships", {"a_id": b["id"], "b_id": a["id"], "kind": "sibling"})
        self.assertEqual(st, 200, r)

        st, full = c.req("GET", f"/api/people/{a['id']}")
        self.assertEqual(len(full["memories"]), 1)
        self.assertEqual(len(full["relationships"]), 1)
        self.assertEqual(full["days_since_contact"], 0)
        self.assertFalse(full["overdue"])
        self.assertTrue(any(e["label"] == "Recital" and e["days"] == 3 for e in full["upcoming"]))

        st, dash = c.req("GET", "/api/dashboard")
        self.assertEqual(st, 200)
        self.assertTrue(any(f["follow_up"] == "Ask about the recital" for f in dash["follow_ups"]))

        st, s = c.req("GET", "/api/search?q=sore")
        self.assertEqual(len(s["memories"]), 1)

        # export → import (merge) doubles the people
        st, exp = c.req("GET", "/api/export")
        n = len(exp["people"])
        st, res = c.req("POST", "/api/import", {"data": exp})
        self.assertEqual(st, 200, res)
        st, ppl = c.req("GET", "/api/people")
        self.assertEqual(len(ppl), n * 2)

        # cascade delete
        st, _ = c.req("DELETE", f"/api/people/{a['id']}")
        self.assertEqual(st, 200)
        st, _ = c.req("GET", f"/api/people/{a['id']}")
        self.assertEqual(st, 404)
        st, g = c.req("GET", "/api/relationships")
        self.assertFalse(any(r_["a_id"] == a["id"] or r_["b_id"] == a["id"] for r_ in g["relationships"]))

    def test_validation(self):
        c = self.c
        self.assertEqual(c.req("POST", "/api/people", {"name": ""})[0], 400)
        self.assertEqual(c.req("POST", "/api/people", {"name": "X", "birthday": "2020-02-30"})[0], 400)
        self.assertEqual(c.req("POST", "/api/people", {"name": "X", "circle": "nope"})[0], 400)
        st, p = c.req("POST", "/api/people", {"name": "Solo"})
        self.assertEqual(c.req("POST", "/api/relationships", {"a_id": p["id"], "b_id": p["id"]})[0], 400)
        self.assertEqual(c.req("POST", "/api/people/99999/memories", {"text": "x"})[0], 404)

    def test_csrf_header_required(self):
        st, _ = self.c.req("POST", "/api/people", {"name": "Z"}, headers={"X-Requested-With": ""})
        self.assertEqual(st, 403)

    def test_next_occurrence_leap_day(self):
        nxt, years = server.next_occurrence("2000-02-29", date(2027, 3, 1))
        self.assertEqual(nxt, date(2028, 2, 29))
        self.assertEqual(years, 28)
        nxt, _ = server.next_occurrence("--02-29", date(2026, 1, 1))
        self.assertEqual(nxt, date(2026, 2, 28))

    def test_static_and_spa_fallback(self):
        st, body = self.c.req("GET", "/")
        self.assertEqual(st, 200)
        self.assertIn(b"Mannele", body)
        st, body = self.c.req("GET", "/../../etc/passwd")
        self.assertIn(b"Mannele", body)

    def test_demo_seed(self):
        st, _ = self.c.req("POST", "/api/demo", {})
        self.assertEqual(st, 200)
        st, dash = self.c.req("GET", "/api/dashboard")
        self.assertGreaterEqual(dash["counts"]["people"], 5)


class AuthTests(unittest.TestCase):
    def test_password_flow(self):
        httpd = start("hunter2")
        try:
            c = Client(httpd.server_address[1])
            self.assertEqual(c.req("GET", "/api/people")[0], 401)
            self.assertEqual(c.req("POST", "/api/login", {"password": "nope"})[0], 401)
            self.assertEqual(c.req("POST", "/api/login", {"password": "hunter2"})[0], 200)
            self.assertIsNotNone(c.cookie)
            self.assertEqual(c.req("GET", "/api/people")[0], 200)
            c.cookie = "mannele_session=123.abc.def"
            self.assertEqual(c.req("GET", "/api/people")[0], 401)
        finally:
            httpd.shutdown()
            server.APP_PASSWORD = ""


if __name__ == "__main__":
    unittest.main()
