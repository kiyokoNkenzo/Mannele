/* Mannele - relationship notebook (UI modelled on mid-2000s Japanese SNS / blog pages) */
(function () {
  "use strict";

  // ------------------------------------------------------------------
  // helpers
  // ------------------------------------------------------------------
  const $ = (sel, el = document) => el.querySelector(sel);
  const $$ = (sel, el = document) => Array.from(el.querySelectorAll(sel));
  const ESC = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ESC[c]);

  const MEMORY_KINDS = {
    problem: { label: "Worry", jp: "悩み", one: "Something they're going through", hint: "ongoing struggles, things to check in about" },
    interest: { label: "Interest", jp: "趣味", one: "Interest", hint: "hobbies, current obsessions" },
    like: { label: "Likes", jp: "好き", one: "Something they like", hint: "favourite foods, comfort things" },
    dislike: { label: "Dislikes", jp: "苦手", one: "Something they dislike", hint: "allergies, pet peeves" },
    gift: { label: "Gift idea", jp: "贈り物", one: "Gift idea", hint: "things they mentioned wanting" },
    goal: { label: "Goal", jp: "目標", one: "Goal", hint: "what they're working towards" },
    note: { label: "Note", jp: "メモ", one: "Note", hint: "anything else" },
  };
  const KIND_ORDER = ["problem", "interest", "like", "gift", "goal", "dislike", "note"];

  const MODES = {
    chat: "Chat", meet: "Met up", call: "Phone call", video: "Video call",
    text: "Messages", letter: "Letter", event: "Event",
  };
  const MOODS = ["great", "good", "okay", "tired", "anxious", "down"];

  const CIRCLES = {
    family: { label: "Family", color: "#ef8424" },
    partner: { label: "Partner", color: "#e5537c" },
    friends: { label: "Friends", color: "#35a262" },
    work: { label: "Work", color: "#3b72c6" },
    community: { label: "Community", color: "#c49a12" },
    other: { label: "Other", color: "#8a8a8a" },
  };

  const REL = {
    friend: { label: "friend", inv: "friend", group: "friend" },
    best_friend: { label: "best friend", inv: "best_friend", group: "friend" },
    partner: { label: "partner", inv: "partner", group: "love" },
    spouse: { label: "spouse", inv: "spouse", group: "love" },
    crush: { label: "crush", inv: "crush", group: "love" },
    ex: { label: "ex", inv: "ex", group: "love" },
    sibling: { label: "sibling", inv: "sibling", group: "family" },
    parent: { label: "parent", inv: "child", group: "family" },
    child: { label: "child", inv: "parent", group: "family" },
    grandparent: { label: "grandparent", inv: "grandchild", group: "family" },
    grandchild: { label: "grandchild", inv: "grandparent", group: "family" },
    cousin: { label: "cousin", inv: "cousin", group: "family" },
    relative: { label: "relative", inv: "relative", group: "family" },
    roommate: { label: "roommate", inv: "roommate", group: "friend" },
    neighbor: { label: "neighbour", inv: "neighbor", group: "friend" },
    coworker: { label: "coworker", inv: "coworker", group: "work" },
    boss: { label: "boss", inv: "report", group: "work" },
    report: { label: "team member", inv: "boss", group: "work" },
    classmate: { label: "classmate", inv: "classmate", group: "work" },
    mentor: { label: "mentor", inv: "mentee", group: "work" },
    mentee: { label: "mentee", inv: "mentor", group: "work" },
    pet: { label: "pet", inv: "owner", group: "pet" },
    owner: { label: "owner", inv: "pet", group: "pet" },
  };
  const REL_GROUPS = {
    love: { label: "Love", color: "#e5537c" },
    family: { label: "Family", color: "#ef8424" },
    friend: { label: "Friends", color: "#35a262" },
    work: { label: "Work / school", color: "#3b72c6" },
    pet: { label: "Pets", color: "#c49a12" },
  };

  const state = { today: new Date().toISOString().slice(0, 10), people: null, peopleFilter: "all", peopleSort: "name", memFilter: "all" };

  // ------------------------------------------------------------------
  // API
  // ------------------------------------------------------------------
  class AuthError extends Error {}

  async function api(method, path, body) {
    const opts = { method, headers: { "X-Requested-With": "mannele" }, credentials: "same-origin" };
    if (body !== undefined) {
      opts.headers["Content-Type"] = "application/json";
      opts.body = JSON.stringify(body);
    }
    const res = await fetch(path, opts);
    let data = null;
    try { data = await res.json(); } catch (_) { /* empty */ }
    if (res.status === 401 && path !== "/api/login") throw new AuthError("login required");
    if (!res.ok) throw new Error((data && data.error) || `Request failed (${res.status})`);
    if (method !== "GET") state.people = null;
    return data;
  }

  async function getPeople(force) {
    if (!state.people || force) state.people = await api("GET", "/api/people");
    return state.people;
  }

  // ------------------------------------------------------------------
  // formatting
  // ------------------------------------------------------------------
  const parseAv = (a) => { try { return typeof a === "string" ? JSON.parse(a || "{}") : a || {}; } catch (_) { return {}; } };
  const dname = (p) => p.nickname || p.name || "";
  /** Square "profile photo" in a thin frame, as on mid-2000s Japanese SNS pages. */
  const photo = (p, size = 50, extra = "") =>
    `<span class="photo s${size} ${extra}">${Avatar.render(parseAv(p.avatar), (p.id || "") + ":" + (p.name || p.nickname || ""), { title: dname(p) })}</span>`;

  const WD = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const pad = (n) => String(n).padStart(2, "0");

  function toDate(iso) {
    const m = /^(\d{4}-|--)(\d{2})-(\d{2})/.exec(iso || "");
    if (!m) return null;
    return new Date(m[1] === "--" ? 2000 : +m[1].slice(0, 4), +m[2] - 1, +m[3]);
  }
  const isoOf = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  /** "10/05(Sun)" — the short date used in Japanese lists */
  function md(iso, withDay = true) {
    const d = toDate(iso);
    if (!d) return "";
    return `${pad(d.getMonth() + 1)}/${pad(d.getDate())}${withDay && !String(iso).startsWith("--") ? `(${WD[d.getDay()]})` : ""}`;
  }
  /** "2026/10/05" */
  function ymd(iso) {
    const d = toDate(iso);
    if (!d) return "";
    return String(iso).startsWith("--") ? `${pad(d.getMonth() + 1)}/${pad(d.getDate())}` : `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())}`;
  }
  function daysSince(iso) {
    const a = toDate(iso), b = toDate(state.today);
    return a && b ? Math.round((b - a) / 86400000) : null;
  }
  function ago(days) {
    if (days == null) return "never";
    if (days === 0) return "today";
    if (days === 1) return "yesterday";
    if (days < 14) return `${days} days ago`;
    if (days < 60) return `${Math.round(days / 7)} weeks ago`;
    if (days < 365) return `${Math.round(days / 30)} months ago`;
    const y = Math.round(days / 365);
    return `${y} year${y > 1 ? "s" : ""} ago`;
  }
  function until(days) {
    if (days === 0) return "today";
    if (days === 1) return "tomorrow";
    if (days < 14) return `in ${days} days`;
    if (days < 60) return `in ${Math.round(days / 7)} weeks`;
    return `in ${Math.round(days / 30)} months`;
  }
  const isNew = (created) => { const d = daysSince(created); return d != null && d <= 2; };
  const newMark = (created) => (isNew(created) ? `<span class="new">NEW</span>` : "");
  const ordinal = (n) => n + (["th", "st", "nd", "rd"][(n % 100 - 20) % 10] || ["th", "st", "nd", "rd"][n % 100] || "th");
  const cat = (k) => { const key = MEMORY_KINDS[k] ? k : "note"; return `<span class="cat c-${key}">${MEMORY_KINDS[key].label}</span>`; };

  function eventText(e, withPerson = true) {
    if (e.type === "birthday") return `${withPerson ? esc(e.person_name) + "'s birthday" : "Birthday"}${e.years ? ` (turning ${e.years})` : ""}`;
    return `${esc(e.label)}${e.years ? ` (${ordinal(e.years)})` : ""}`;
  }

  function relRole(rel, viewerId) {
    // Stored meaning: a is <kind> of b. Returns the other person and their role relative to the viewer.
    if (rel.b_id === viewerId) return { otherId: rel.a_id, name: rel.a_nickname || rel.a_name, avatar: rel.a_avatar, oname: rel.a_name, kind: rel.kind };
    return { otherId: rel.b_id, name: rel.b_nickname || rel.b_name, avatar: rel.b_avatar, oname: rel.b_name, kind: (REL[rel.kind] || REL.friend).inv };
  }

  /** A mixi-style box: header band with a small orange square, optional count and right-side links. */
  function box(title, body, o = {}) {
    return `<section class="box ${o.cls || ""}"${o.id ? ` id="${o.id}"` : ""}>
      <div class="box-h">${title}${o.n != null ? `<span class="n">(${o.n})</span>` : ""}${o.right ? `<span class="r">${o.right}</span>` : ""}</div>
      <div class="box-b">${body}</div>
      ${o.foot ? `<div class="box-f">${o.foot}</div>` : ""}
    </section>`;
  }
  const path = (...parts) => `<p class="path"><a href="#/">Home</a>${parts.map((p) => ` &gt; ${p}`).join("")}</p>`;
  const pagehead = (title, small = "", right = "") => `<h1 class="pagehead">${title}${small ? `<small>${small}</small>` : ""}${right ? `<span class="right">${right}</span>` : ""}</h1>`;
  const empty = (text) => `<p class="empty">${esc(text)}</p>`;

  // ------------------------------------------------------------------
  // toasts, modal, confirm
  // ------------------------------------------------------------------
  function toast(msg, isErr) {
    const el = document.createElement("div");
    el.className = "toast" + (isErr ? " err" : "");
    el.textContent = msg;
    $("#toasts").appendChild(el);
    setTimeout(() => el.remove(), 2600);
  }

  let modalCleanup = null;
  let lastFocus = null;
  function openModal(title, html, opts = {}) {
    lastFocus = document.activeElement;
    $("#modal-body").innerHTML = `<h2 id="modal-title">${title}</h2><div class="mb">${html}</div>`;
    $(".modal").classList.toggle("wide", !!opts.wide);
    $("#modal").hidden = false;
    modalCleanup = opts.onClose || null;
    const first = $("#modal-body [autofocus]") || $("#modal-body input:not([type=hidden]), #modal-body select, #modal-body textarea");
    if (first) setTimeout(() => first.focus(), 30);
  }
  function closeModal() {
    $("#modal").hidden = true;
    $("#modal-body").innerHTML = "";
    if (modalCleanup) modalCleanup();
    modalCleanup = null;
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }
  const submitRow = (label = "Save") => `
    <div class="submit-row">
      <button type="button" class="btn" data-action="close-modal">Cancel</button>
      <button type="submit" class="btn orange big">${label}</button>
    </div>`;
  /** One row of a Japanese-style form table: shaded label cell + input cell. */
  const frow = (label, html, req, hint) =>
    `<tr><th>${label}${req ? `<span class="req">Required</span>` : ""}</th><td>${html}${hint ? `<span class="hint">${hint}</span>` : ""}</td></tr>`;

  function confirmBox(title, text, okLabel = "Delete") {
    return new Promise((resolve) => {
      let answered = false;
      openModal(esc(title), `
        <p>${esc(text)}</p>
        <div class="submit-row">
          <button class="btn" data-action="confirm-no">Cancel</button>
          <button class="btn orange big" data-action="confirm-yes" autofocus>${esc(okLabel)}</button>
        </div>`, { onClose: () => { if (!answered) resolve(false); } });
      actions["confirm-yes"] = () => { answered = true; closeModal(); resolve(true); };
      actions["confirm-no"] = () => { answered = true; closeModal(); resolve(false); };
    });
  }

  // ------------------------------------------------------------------
  // shared widgets
  // ------------------------------------------------------------------
  const app = () => $("#app");
  const loading = () => { app().innerHTML = `<p class="loading">Loading...</p>`; };

  /** Blog-sidebar style mini calendar: Sunday red, Saturday blue, event days filled orange. */
  function miniCal(events) {
    const t = toDate(state.today);
    const y = t.getFullYear(), m = t.getMonth();
    const first = new Date(y, m, 1), days = new Date(y, m + 1, 0).getDate();
    const byDay = {};
    events.forEach((e) => { const d = toDate(e.date); if (d.getFullYear() === y && d.getMonth() === m) (byDay[d.getDate()] = byDay[d.getDate()] || []).push(e); });
    let cells = "", row = "";
    for (let i = 0; i < first.getDay(); i++) row += "<td></td>";
    for (let d = 1; d <= days; d++) {
      const wd = (first.getDay() + d - 1) % 7;
      const cls = [wd === 0 ? "su" : wd === 6 ? "sa" : "", byDay[d] ? "ev" : "", d === t.getDate() ? "today" : ""].join(" ");
      const title = byDay[d] ? byDay[d].map((e) => (e.type === "birthday" ? `${e.person_name}'s birthday` : `${e.label} (${e.person_name})`)).join(", ") : "";
      row += `<td class="${cls}">${byDay[d] ? `<a href="#/calendar" title="${esc(title)}">${d}</a>` : d}</td>`;
      if (wd === 6) { cells += `<tr>${row}</tr>`; row = ""; }
    }
    if (row) cells += `<tr>${row}</tr>`;
    return `<table class="cal"><caption>${y}/${pad(m + 1)}</caption>
      <tr>${WD.map((w, i) => `<th class="${i === 0 ? "su" : i === 6 ? "sa" : ""}">${w.slice(0, 2)}</th>`).join("")}</tr>${cells}</table>`;
  }

  // ---------- Home ----------
  async function viewHome() {
    const [d, people] = await Promise.all([api("GET", "/api/dashboard"), getPeople(true)]);

    if (!d.counts.people) {
      app().innerHTML = `
        <div class="center">${box("Welcome to Mannele", `
          <span class="logo-word">Mannele</span>
          <p>A private notebook for the people in your life: what they're into, what they're going through, the dates that matter to them, and what you talked about last time.</p>
          <p class="st">Everything is stored on this machine only.</p>
          <div class="submit-row">
            <button class="btn orange big" data-action="new-person">Add the first person</button>
            <button class="btn" data-action="seed-demo">Load example people</button>
          </div>`)}</div>`;
      return;
    }

    // left column — friend grid + groups
    const grid = people.slice().sort((a, b) => b.favorite - a.favorite || (a.days_since_contact ?? 1e9) - (b.days_since_contact ?? 1e9)).slice(0, 9)
      .map((p) => `<a href="#/person/${p.id}">${photo(p, 50)}${esc(dname(p))}<span style="white-space:nowrap">(${p.memory_count})</span></a>`).join("");
    const groups = {};
    people.forEach((p) => { groups[p.circle] = (groups[p.circle] || 0) + 1; });
    const groupList = Object.entries(CIRCLES).filter(([k]) => groups[k])
      .map(([k, c]) => `<li><a href="#/people/${k}">${c.label}</a> (${groups[k]})</li>`).join("");

    // notices
    const notices = [];
    d.upcoming.filter((e) => e.days <= 14).forEach((e) => {
      notices.push(`<li><a href="#/person/${e.person_id}">${eventText(e)}</a> is ${e.days === 0 ? "today!" : `on ${md(e.date)} (${until(e.days)})`}</li>`);
    });
    if (d.overdue.length) notices.push(`<li>There ${d.overdue.length === 1 ? "is 1 person" : `are ${d.overdue.length} people`} you haven't talked to in a while.</li>`);

    const li = (date, text, who, href, extra = "") => `<li><span class="d">${date}</span><span class="t"><a href="${href}">${text}</a>${who ? ` <span class="who">(${esc(who)})</span>` : ""}${extra}</span></li>`;
    const upcoming = d.upcoming.slice(0, 8).map((e) => `<li><span class="d">${md(e.date)}</span><span class="t"><a href="#/person/${e.person_id}">${eventText(e, false)}</a> <span class="who">(${esc(e.person_name)})</span></span><span class="x ${e.days <= 7 ? "soon" : ""}">${until(e.days)}</span></li>`).join("");
    const problems = d.open_problems.map((m) => li(md(m.created_at), esc(m.text), m.nickname || m.name, `#/person/${m.person_id}`, newMark(m.created_at))).join("");
    const follow = d.follow_ups.map((i) => li(md(i.date), esc(i.follow_up), i.nickname || i.name, `#/person/${i.person_id}`)).join("");
    const recent = d.recent.map((i) => li(md(i.date), esc(i.topics || MODES[i.mode] || "Conversation"), i.nickname || i.name, `#/person/${i.person_id}`, newMark(i.date))).join("");

    const overdue = d.overdue.map((p) => `<li style="display:flex;gap:6px;align-items:center;padding:3px 0;border-bottom:1px dotted var(--dotted)">
        <a href="#/person/${p.id}">${photo(p, 34)}</a>
        <span style="flex:1;min-width:0"><a href="#/person/${p.id}">${esc(dname(p))}</a><br><span class="st">last: ${p.days_since_contact == null ? "never" : ago(p.days_since_contact)}</span></span>
        <a href="#" data-action="log-chat" data-person="${p.id}" style="font-size:11px">Log</a></li>`).join("");
    const gifts = d.gift_ideas.map((m) => `<li><a href="#/person/${m.person_id}">${esc(m.text)}</a> <span class="who">(for ${esc(m.nickname || m.name)})</span></li>`).join("");

    app().innerHTML = `
      <div class="cols three">
        <div class="col">
          ${box("People", `<div class="pgrid">${grid}</div>`, { n: people.length, foot: `<a class="more" href="#/people">All people</a>` })}
          ${box("Groups", `<ul class="blist">${groupList}</ul>`)}
          ${box("Totals", `<ul class="blist"><li>Notes: ${d.counts.memories}</li><li>Conversations: ${d.counts.interactions}</li><li>Connections: ${d.counts.relationships}</li></ul>`)}
        </div>
        <div class="col">
          ${notices.length ? `<ul class="notice">${notices.join("")}</ul>` : ""}
          ${box("Upcoming dates", upcoming ? `<ul class="dl">${upcoming}</ul>` : empty("Nothing coming up."), { foot: `<a class="more" href="#/calendar">Calendar</a>` })}
          ${box("Check in on", problems ? `<ul class="dl">${problems}</ul>` : empty("No open worries."), { n: d.open_problems.length })}
          ${box("Ask next time", follow ? `<ul class="dl">${follow}</ul>` : empty("No follow-ups."))}
          ${box("Recent conversations", recent ? `<ul class="dl">${recent}</ul>` : empty("No conversations logged yet."))}
        </div>
        <div class="col">
          ${box("Calendar", miniCal(d.upcoming), { foot: `<a class="more" href="#/calendar">See all</a>` })}
          ${box("Been a while", overdue ? `<ul>${overdue}</ul>` : empty("You're up to date with everyone."))}
          ${box("Gift ideas", gifts ? `<ul class="blist">${gifts}</ul>` : empty("None saved."), { right: `<a href="#" data-action="refresh">shuffle</a>` })}
        </div>
      </div>`;
  }

  // ---------- People ----------
  async function viewPeople(circle) {
    if (circle) state.peopleFilter = CIRCLES[circle] ? circle : "all";
    const people = await getPeople(true);
    const counts = {};
    people.forEach((p) => { counts[p.circle] = (counts[p.circle] || 0) + 1; });
    let list = people.filter((p) => state.peopleFilter === "all" || p.circle === state.peopleFilter);
    const sorters = {
      name: (a, b) => b.favorite - a.favorite || a.name.localeCompare(b.name),
      contact: (a, b) => (b.days_since_contact ?? 1e9) - (a.days_since_contact ?? 1e9),
      birthday: (a, b) => (a.next_birthday_days ?? 1e9) - (b.next_birthday_days ?? 1e9),
      recent: (a, b) => String(b.created_at).localeCompare(String(a.created_at)),
    };
    list = list.slice().sort(sorters[state.peopleSort] || sorters.name);

    const tabs = [`<button class="${state.peopleFilter === "all" ? "on" : ""}" data-action="filter-circle" data-v="all">All (${people.length})</button>`]
      .concat(Object.entries(CIRCLES).filter(([k]) => counts[k]).map(([k, c]) =>
        `<button class="${state.peopleFilter === k ? "on" : ""}" data-action="filter-circle" data-v="${k}">${c.label} (${counts[k]})</button>`)).join("");

    const cells = list.map((p) => {
      let flag = "";
      if (p.next_birthday_days != null && p.next_birthday_days <= 30) flag = `★ birthday ${until(p.next_birthday_days)}`;
      else if (p.overdue) flag = "say hello";
      return `<a href="#/person/${p.id}">${photo(p, 76)}${p.favorite ? "♥ " : ""}${esc(p.name)} (${p.memory_count})
        <span class="meta">${p.last_contact ? "talked " + ago(p.days_since_contact) : "no conversations"}</span>
        ${flag ? `<span class="flag">${flag}</span>` : ""}</a>`;
    }).join("");

    app().innerHTML = `
      ${path("People")}
      ${pagehead("People", `${people.length} registered`, `<button class="btn orange" data-action="new-person">+ Add person</button>`)}
      <div class="tabs">${tabs}</div>
      <p style="text-align:right;margin:0 0 6px">Sort:
        <select id="people-sort" aria-label="Sort people">
          <option value="name">Favourites, then name</option>
          <option value="contact">Longest since contact</option>
          <option value="birthday">Next birthday</option>
          <option value="recent">Recently added</option>
        </select></p>
      ${box(state.peopleFilter === "all" ? "Everyone" : CIRCLES[state.peopleFilter].label, cells ? `<div class="pgrid wide">${cells}</div>` : empty("Nobody in this group yet."), { n: list.length })}`;
    const sortSel = $("#people-sort");
    sortSel.value = state.peopleSort;
    sortSel.addEventListener("change", () => { state.peopleSort = sortSel.value; viewPeople(); });
  }

  // ---------- Person ----------
  async function viewPerson(id) {
    const p = await api("GET", `/api/people/${id}`);
    state.current = p;
    const c = CIRCLES[p.circle] || CIRCLES.other;

    // profile table (mixi-style)
    const nb = p.next_birthday ? toDate(p.next_birthday) : null;
    const rows = [
      ["Name", `${esc(p.name)}${p.favorite ? ` <span style="color:var(--notice)">♥</span>` : ""}`],
      p.nickname && ["Nickname", esc(p.nickname)],
      p.pronouns && ["Pronouns", esc(p.pronouns)],
      ["Group", esc(c.label)],
      ["Birthday", p.birthday ? `${ymd(p.birthday)}${p.turning ? ` (turning ${p.turning})` : ""} <span class="${p.next_birthday_days <= 14 ? "soon" : "st"}">… ${until(p.next_birthday_days)}${nb ? `, ${WD[nb.getDay()]}` : ""}</span>` : `<span class="st">not set</span>`],
      ["Last contact", p.last_contact ? `${ymd(p.last_contact)} <span class="${p.overdue ? "soon" : "st"}">(${ago(p.days_since_contact)})</span>` : `<span class="soon">no conversations logged</span>`],
      ["Check-in", p.checkin_days ? `every ${p.checkin_days} days` : "no reminder"],
      p.how_met && ["How we met", esc(p.how_met)],
      p.notes && ["About", `<span style="white-space:pre-wrap">${esc(p.notes)}</span>`],
    ].filter(Boolean).map(([k, v]) => `<tr><th>${k}</th><td>${v}</td></tr>`).join("");

    // notes
    const mems = p.memories.filter((m) => state.memFilter === "all" || m.kind === state.memFilter);
    const kindCounts = {};
    p.memories.forEach((m) => { kindCounts[m.kind] = (kindCounts[m.kind] || 0) + 1; });
    const tabs = [`<button class="${state.memFilter === "all" ? "on" : ""}" data-action="mem-filter" data-v="all">All (${p.memories.length})</button>`]
      .concat(KIND_ORDER.filter((k) => kindCounts[k]).map((k) =>
        `<button class="${state.memFilter === k ? "on" : ""}" data-action="mem-filter" data-v="${k}">${MEMORY_KINDS[k].label} (${kindCounts[k]})</button>`)).join("");
    const memItem = (m) => {
      const done = m.status === "resolved" || m.status === "given" || m.status === "archived";
      let toggle = "";
      if (m.kind === "problem") toggle = `<a href="#" data-action="mem-status" data-id="${m.id}" data-v="${done ? "open" : "resolved"}">${done ? "reopen" : "resolved"}</a>`;
      else if (m.kind === "gift") toggle = `<a href="#" data-action="mem-status" data-id="${m.id}" data-v="${done ? "open" : "given"}">${done ? "not given" : "given"}</a>`;
      const status = m.status === "resolved" ? " [resolved]" : m.status === "given" ? " [given]" : m.status === "archived" ? " [archived]" : "";
      return `<li class="${done ? "done" : ""} ${m.pinned ? "pinned" : ""}">
          ${cat(m.kind)}
          <span class="t"><span class="txt">${m.pinned ? "【PIN】" : ""}${esc(m.text)}</span>${newMark(m.created_at)} <span class="st">${md(m.created_at)}${status}</span>
            ${m.detail ? `<div class="detail">${esc(m.detail)}</div>` : ""}</span>
          <span class="ops">${toggle}<a href="#" data-action="mem-pin" data-id="${m.id}" data-v="${m.pinned ? 0 : 1}">${m.pinned ? "unpin" : "pin"}</a><a href="#" data-action="edit-memory" data-id="${m.id}">edit</a><a href="#" data-action="delete-memory" data-id="${m.id}">delete</a></span>
        </li>`;
    };
    const kindOptions = KIND_ORDER.map((k) => `<option value="${k}">${MEMORY_KINDS[k].label}</option>`).join("");
    const notesBody = `
      <form class="quick" data-form="quick-memory" data-person="${p.id}">
        <select name="kind" aria-label="Category">${kindOptions}</select>
        <input type="text" name="text" placeholder="What did ${esc(dname(p))} mention?" aria-label="Note" maxlength="1000" required>
        <button class="btn orange" type="submit">Add</button>
      </form>
      <div class="tabs">${tabs}</div>
      ${mems.length ? `<ul class="notes">${mems.map(memItem).join("")}</ul>` : empty(p.memories.length ? "Nothing in this category." : "Nothing noted yet.")}`;

    // conversations, diary style
    const chats = p.interactions.map((i) => `<li>
        <div class="dh"><b>${ymd(i.date)}(${WD[toDate(i.date).getDay()]})</b><span>${esc(MODES[i.mode] || "Chat")}${i.mood ? ` ・ mood: ${esc(i.mood)}` : ""}</span>${newMark(i.date)}
          <span class="ops"><a href="#" data-action="edit-chat" data-id="${i.id}">edit</a><a href="#" data-action="delete-chat" data-id="${i.id}">delete</a></span></div>
        <div class="db">${i.topics ? esc(i.topics) : `<span class="st">(no topics noted)</span>`}</div>
        ${i.follow_up ? `<div class="fu">${esc(i.follow_up)}</div>` : ""}
      </li>`).join("");

    // dates
    const upcomingIds = new Set(p.upcoming.map((e) => e.id));
    const dates = p.upcoming.map((e) => `<li><span class="d">${md(e.date)}</span><span class="t">${eventText(e, false)}${e.notes ? ` <span class="who">— ${esc(e.notes)}</span>` : ""}</span>
        <span class="x ${e.days <= 7 ? "soon" : "st"}">${until(e.days)}</span>
        ${e.id ? `<span class="ops"><a href="#" data-action="edit-date" data-id="${e.id}">edit</a><a href="#" data-action="delete-date" data-id="${e.id}">delete</a></span>` : ""}</li>`).join("")
      + p.dates.filter((d) => !upcomingIds.has(d.id)).map((d) => `<li><span class="d">${ymd(d.date)}</span><span class="t st">${esc(d.label)} (past)</span>
        <span class="ops"><a href="#" data-action="edit-date" data-id="${d.id}">edit</a><a href="#" data-action="delete-date" data-id="${d.id}">delete</a></span></li>`).join("");

    // connections grid
    const rels = p.relationships.map((r) => {
      const role = relRole(r, p.id);
      return `<a href="#/person/${role.otherId}">${photo({ id: role.otherId, name: role.oname, avatar: role.avatar }, 50)}${esc(role.name)}<span class="meta">${esc((REL[role.kind] || REL.friend).label)}</span></a>`;
    }).join("");
    const relList = p.relationships.map((r) => {
      const role = relRole(r, p.id);
      return `<li>${esc(role.name)} <span class="who">— ${esc(dname(p))}'s ${esc((REL[role.kind] || REL.friend).label)}${r.notes ? `, ${esc(r.notes)}` : ""}</span>
        <span class="ops" style="font-size:11px"><a href="#" data-action="edit-rel" data-id="${r.id}">edit</a><a href="#" data-action="delete-rel" data-id="${r.id}">delete</a></span></li>`;
    }).join("");

    // photo album: up to 3 real photos under the avatar (like the small extra photos on mixi profiles)
    const photos = p.photos || [];
    const thumbs = photos.map((ph, i) => `<a href="#" class="thumb" data-action="view-photo" data-i="${i}" title="${esc(ph.caption || "Photo")}"><img src="/api/photos/${ph.id}" alt="${esc(ph.caption || `Photo of ${p.name}`)}" loading="lazy"></a>`).join("")
      + (photos.length < MAX_PHOTOS ? `<a href="#" class="thumb add" data-action="add-photo" data-person="${p.id}" title="Add a photo">＋<span>photo</span></a>` : "");

    const notices = [];
    if (p.next_birthday_days != null && p.next_birthday_days <= 14) notices.push(`<li>${esc(dname(p))}'s birthday is ${p.next_birthday_days === 0 ? "today!" : `on ${md(p.next_birthday)} (${until(p.next_birthday_days)})`}</li>`);
    if (p.overdue) notices.push(`<li>It's been a while — ${p.last_contact ? `last conversation ${ago(p.days_since_contact)}` : "no conversations logged yet"}.</li>`);

    app().innerHTML = `
      ${path(`<a href="#/people">People</a>`, esc(p.name))}
      <div class="cols two">
        <div class="col person-side">
          <div>
            ${photo(p, 180)}
            <p class="side-name">${esc(p.name)} (${p.memory_count})${p.nickname ? `<small>“${esc(p.nickname)}”</small>` : ""}</p>
            <div class="thumbs">${thumbs}</div>
            <p class="st thumbs-note">Photos ${photos.length}/${MAX_PHOTOS}</p>
          </div>
          <div class="col">
            ${box("Menu", `<ul class="actions">
              <li><a href="#" data-action="log-chat" data-person="${p.id}">Log a conversation</a></li>
              <li><a href="#" data-action="new-memory" data-person="${p.id}">Add a note</a></li>
              <li><a href="#" data-action="new-date" data-person="${p.id}">Add a date</a></li>
              <li><a href="#" data-action="new-rel" data-person="${p.id}">Add a connection</a></li>
              <li><a href="#" data-action="add-photo" data-person="${p.id}">Add a photo</a></li>
              <li><a href="#" data-action="edit-person" data-id="${p.id}">Edit profile</a></li>
              <li><a href="#" data-action="delete-person" data-id="${p.id}">Delete this person</a></li></ul>`)}
            ${box("Connections", rels ? `<div class="pgrid">${rels}</div>` : empty("None yet."), { n: p.relationships.length, foot: `<a class="more" href="#/web">Relationship chart</a>` })}
          </div>
        </div>
        <div class="col">
          ${notices.length ? `<ul class="notice">${notices.join("")}</ul>` : ""}
          ${box("Profile", `<table class="ptable">${rows}</table>`, { right: `<a href="#" data-action="edit-person">edit</a>` })}
          ${box("Notes", notesBody, { n: p.memories.length })}
          ${box("Conversations", chats ? `<ul class="diary">${chats}</ul>` : empty("No conversations logged yet."), { n: p.interactions.length, right: `<a href="#" data-action="log-chat" data-person="${p.id}">+ log</a>` })}
          ${box("Dates", dates ? `<ul class="dl">${dates}</ul>` : empty("Anniversaries, exams, trips…"), { right: `<a href="#" data-action="new-date" data-person="${p.id}">+ add</a>` })}
          ${relList ? box("Connection details", `<ul class="blist">${relList}</ul>`) : ""}
        </div>
      </div>`;
  }

  // ---------- Relationship chart (人物相関図) ----------
  let webStop = null;
  async function viewWeb() {
    const g = await api("GET", "/api/relationships");
    const head = `${path("Relationship chart")}${pagehead("Relationship chart", "who is who to whom")}`;
    if (!g.people.length) {
      app().innerHTML = `${head}${box("Chart", empty("Add people and link them to see the chart."))}`;
      return;
    }
    let showMe = true;
    try { showMe = localStorage.getItem("mannele.web.me") !== "0"; } catch (_) { /* ignore */ }
    app().innerHTML = `
      ${head}
      <p class="st">Drag people to rearrange, scroll to zoom, click a portrait to open the profile. An arrow from A to B reads “A is B's …”.</p>
      <div class="chart-wrap">
        <div class="chart-tools">
          <label class="check"><input type="checkbox" id="web-me" ${showMe ? "checked" : ""}> Put me in the middle</label>
          <span style="flex:1"></span>
          <span class="legend">${Object.values(REL_GROUPS).map((gr) => `<span><i style="background:${gr.color}"></i>${gr.label}</span>`).join("")}</span>
          <button class="btn" data-action="web-shuffle">Rearrange</button>
        </div>
        <svg id="web-svg" xmlns="http://www.w3.org/2000/svg" aria-label="Relationship chart"></svg>
      </div>`;
    $("#web-me").addEventListener("change", (e) => {
      try { localStorage.setItem("mannele.web.me", e.target.checked ? "1" : "0"); } catch (_) { /* ignore */ }
      viewWeb();
    });
    drawWeb(g, showMe);
  }

  function drawWeb(g, showMe) {
    const svg = $("#web-svg");
    const NS = "http://www.w3.org/2000/svg";
    const nodes = g.people.map((p, i) => {
      const ang = (i / g.people.length) * Math.PI * 2;
      const r = 130 + g.people.length * 12;
      return { ...p, x: Math.cos(ang) * r + (Math.random() - .5) * 20, y: Math.sin(ang) * r + (Math.random() - .5) * 20, vx: 0, vy: 0 };
    });
    const byId = new Map(nodes.map((n) => [n.id, n]));
    const links = g.relationships.filter((r) => byId.has(r.a_id) && byId.has(r.b_id))
      .map((r) => ({ s: byId.get(r.a_id), t: byId.get(r.b_id), rel: r }));
    let me = null;
    if (showMe) {
      me = { id: "me", x: 0, y: 0, vx: 0, vy: 0, fixed: true };
      nodes.forEach((n) => links.push({ s: me, t: n, me: true }));
    }
    const all = me ? nodes.concat([me]) : nodes;
    let dragging = null;

    function tick(alpha) {
      for (let i = 0; i < all.length; i++) {
        for (let j = i + 1; j < all.length; j++) {
          const a = all[i], b = all[j];
          let dx = b.x - a.x, dy = b.y - a.y;
          const d2 = dx * dx + dy * dy || 1;
          const f = (18000 / d2) * alpha;
          const d = Math.sqrt(d2);
          dx /= d; dy /= d;
          a.vx -= dx * f; a.vy -= dy * f; b.vx += dx * f; b.vy += dy * f;
        }
      }
      for (const l of links) {
        const dx = l.t.x - l.s.x, dy = l.t.y - l.s.y;
        const d = Math.sqrt(dx * dx + dy * dy) || 1;
        const want = l.me ? 250 : 185;
        const k = (l.me ? 0.012 : 0.05) * (d - want) * alpha;
        const fx = (dx / d) * k, fy = (dy / d) * k;
        l.s.vx += fx; l.s.vy += fy; l.t.vx -= fx; l.t.vy -= fy;
      }
      for (const n of all) {
        n.vx -= n.x * 0.004 * alpha; n.vy -= n.y * 0.004 * alpha;
        if (n.fixed || n === dragging) { n.vx = n.vy = 0; continue; }
        n.vx *= 0.82; n.vy *= 0.82;
        n.x += Math.max(-30, Math.min(30, n.vx)); n.y += Math.max(-30, Math.min(30, n.vy));
      }
    }
    for (let i = 0; i < 400; i++) tick(1);

    const xs = all.map((n) => n.x), ys = all.map((n) => n.y);
    const padding = 110;
    const vb = { x: Math.min(...xs) - padding, y: Math.min(...ys) - padding, w: Math.max(...xs) - Math.min(...xs) + padding * 2, h: Math.max(...ys) - Math.min(...ys) + padding * 2 };
    const rect = svg.getBoundingClientRect();
    const aspect = rect.width / Math.max(1, rect.height);
    if (vb.w / vb.h < aspect) { const nw = vb.h * aspect; vb.x -= (nw - vb.w) / 2; vb.w = nw; }
    else { const nh = vb.w / aspect; vb.y -= (nh - vb.h) / 2; vb.h = nh; }
    const setVB = () => svg.setAttribute("viewBox", `${vb.x} ${vb.y} ${vb.w} ${vb.h}`);
    setVB();

    const defs = document.createElementNS(NS, "defs");
    defs.innerHTML = Object.entries(REL_GROUPS).map(([k, gr]) =>
      `<marker id="arrow-${k}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 Z" fill="${gr.color}"/></marker>`).join("");
    const edgeLayer = document.createElementNS(NS, "g");
    const labelLayer = document.createElementNS(NS, "g");
    const nodeLayer = document.createElementNS(NS, "g");
    svg.replaceChildren(defs, edgeLayer, labelLayer, nodeLayer);

    const edgeEls = links.map((l) => {
      const line = document.createElementNS(NS, "line");
      let lab = null;
      if (l.me) {
        line.setAttribute("stroke", "#e0a060");
        line.setAttribute("stroke-width", "1.2");
        line.setAttribute("stroke-dasharray", "2 4");
        line.setAttribute("opacity", ".6");
      } else {
        const rk = REL[l.rel.kind] || REL.friend;
        const grp = REL_GROUPS[rk.group];
        line.setAttribute("stroke", grp.color);
        line.setAttribute("stroke-width", "3");
        line.setAttribute("marker-end", `url(#arrow-${rk.group})`);
        if (rk.inv === l.rel.kind) line.setAttribute("marker-start", `url(#arrow-${rk.group})`);
        lab = document.createElementNS(NS, "g");
        const w = rk.label.length * 7 + 14;
        lab.innerHTML = `<title>${esc(dname(l.s))} is ${esc(dname(l.t))}'s ${esc(rk.label)}</title><rect x="${-w / 2}" y="-10" width="${w}" height="20" rx="10" fill="${grp.color}" stroke="#fff" stroke-width="1.5"/><text class="lbl" text-anchor="middle" y="4">${esc(rk.label)}</text>`;
        labelLayer.appendChild(lab);
      }
      edgeLayer.appendChild(line);
      return { line, lab, l };
    });

    const nodeEls = all.map((n) => {
      const el = document.createElementNS(NS, "g");
      el.setAttribute("class", "node");
      if (n.id === "me") {
        el.innerHTML = `<circle r="30" fill="#f08a1c" stroke="#fff" stroke-width="3"/><text text-anchor="middle" y="5" style="font-size:14px;font-weight:bold;fill:#fff">YOU</text>`;
      } else {
        const col = (CIRCLES[n.circle] || CIRCLES.other).color;
        const nm = dname(n);
        const w = Math.max(70, nm.length * 7.8 + 22);
        el.innerHTML = `<rect x="-36" y="-36" width="72" height="72" fill="#fff" stroke="#c9c9c9"/>
          <g transform="translate(-33 -33)">${Avatar.render(parseAv(n.avatar), n.id + ":" + n.name, { size: 66 })}</g>
          <rect class="plate" x="${-w / 2}" y="38" width="${w}" height="20" stroke="${col}" stroke-width="1"/>
          <rect x="${-w / 2}" y="38" width="6" height="20" fill="${col}"/>
          <text class="plate-text" text-anchor="middle" x="3" y="52">${esc(nm)}${n.favorite ? " ♥" : ""}</text>`;
        el.setAttribute("tabindex", "0");
        el.setAttribute("role", "link");
        el.setAttribute("aria-label", nm);
        el.addEventListener("keydown", (e) => { if (e.key === "Enter") location.hash = `#/person/${n.id}`; });
      }
      el.__node = n;
      nodeLayer.appendChild(el);
      return { el, n };
    });

    function paint() {
      for (const { line, lab, l } of edgeEls) {
        const dx = l.t.x - l.s.x, dy = l.t.y - l.s.y;
        const d = Math.sqrt(dx * dx + dy * dy) || 1;
        const ux = dx / d, uy = dy / d;
        const inset = Math.min(42 / Math.max(Math.abs(ux), Math.abs(uy), 0.01), d / 2 - 2);
        const s0 = l.me ? 32 : inset;
        line.setAttribute("x1", l.s.x + ux * s0); line.setAttribute("y1", l.s.y + uy * s0);
        line.setAttribute("x2", l.t.x - ux * inset); line.setAttribute("y2", l.t.y - uy * inset);
        if (lab) lab.setAttribute("transform", `translate(${(l.s.x + l.t.x) / 2} ${(l.s.y + l.t.y) / 2})`);
      }
      for (const { el, n } of nodeEls) el.setAttribute("transform", `translate(${n.x} ${n.y})`);
    }
    paint();

    let heat = 0, raf = null;
    function warm(amount = 60) {
      heat = Math.max(heat, amount);
      if (!raf) raf = requestAnimationFrame(loop);
    }
    function loop() {
      tick(0.6);
      paint();
      heat--;
      raf = heat > 0 ? requestAnimationFrame(loop) : null;
    }
    webStop = () => { if (raf) cancelAnimationFrame(raf); raf = null; };

    const toSvg = (e) => {
      const pt = svg.createSVGPoint();
      pt.x = e.clientX; pt.y = e.clientY;
      return pt.matrixTransform(svg.getScreenCTM().inverse());
    };

    let panning = null, moved = 0, downNode = null;
    svg.addEventListener("pointerdown", (e) => {
      const node = e.target.closest(".node");
      moved = 0;
      svg.setPointerCapture(e.pointerId);
      if (node && node.__node.id !== "me") {
        downNode = node.__node;
        dragging = downNode;
      } else {
        panning = { x: e.clientX, y: e.clientY, vx: vb.x, vy: vb.y };
        svg.style.cursor = "grabbing";
      }
    });
    svg.addEventListener("pointermove", (e) => {
      if (dragging) {
        const pt = toSvg(e);
        moved += Math.abs(e.movementX) + Math.abs(e.movementY);
        dragging.x = pt.x; dragging.y = pt.y;
        warm(40);
        paint();
      } else if (panning) {
        const scale = vb.w / svg.getBoundingClientRect().width;
        vb.x = panning.vx - (e.clientX - panning.x) * scale;
        vb.y = panning.vy - (e.clientY - panning.y) * scale;
        setVB();
      }
    });
    const up = () => {
      if (downNode && moved < 6) location.hash = `#/person/${downNode.id}`;
      dragging = null; downNode = null; panning = null;
      svg.style.cursor = "";
      warm(60);
    };
    svg.addEventListener("pointerup", up);
    svg.addEventListener("pointercancel", up);
    svg.addEventListener("wheel", (e) => {
      e.preventDefault();
      const pt = toSvg(e);
      const f = e.deltaY > 0 ? 1.1 : 1 / 1.1;
      const nw = Math.max(200, Math.min(6000, vb.w * f));
      const k = nw / vb.w;
      vb.x = pt.x - (pt.x - vb.x) * k; vb.y = pt.y - (pt.y - vb.y) * k;
      vb.w = nw; vb.h *= k;
      setVB();
    }, { passive: false });

    actions["web-shuffle"] = () => {
      nodes.forEach((n) => { n.x += (Math.random() - .5) * 300; n.y += (Math.random() - .5) * 300; });
      warm(160);
    };
  }

  // ---------- Calendar (month grid, Sun red / Sat blue) ----------
  async function viewCalendar() {
    const events = await api("GET", "/api/upcoming?days=366");
    const t = toDate(state.today);
    const off = Math.max(0, Math.min(11, state.calOffset || 0));
    const y = new Date(t.getFullYear(), t.getMonth() + off, 1).getFullYear();
    const m = new Date(t.getFullYear(), t.getMonth() + off, 1).getMonth();
    const byIso = {};
    events.forEach((e) => { (byIso[e.date] = byIso[e.date] || []).push(e); });

    const start = new Date(y, m, 1 - new Date(y, m, 1).getDay());
    let body = "";
    for (let w = 0; w < 6; w++) {
      let row = "";
      for (let i = 0; i < 7; i++) {
        const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + w * 7 + i);
        const iso = isoOf(d);
        const evs = (byIso[iso] || []).map((e) => `<a class="e ${e.type === "birthday" ? "b" : ""}" href="#/person/${e.person_id}">${e.type === "birthday" ? "★" : "・"}${e.type === "birthday" ? esc(e.person_name) : esc(e.label)}</a>`).join("");
        const cls = [i === 0 ? "su" : i === 6 ? "sa" : "", d.getMonth() !== m ? "out" : "", iso === state.today ? "today" : ""].join(" ");
        row += `<td class="${cls}"><span class="dn">${d.getDate()}</span>${evs}</td>`;
      }
      body += `<tr>${row}</tr>`;
      if (new Date(start.getFullYear(), start.getMonth(), start.getDate() + (w + 1) * 7).getMonth() !== m && w >= 3) break;
    }

    const list = events.map((e) => `<li><span class="d">${md(e.date)}</span><span class="t"><a href="#/person/${e.person_id}">${eventText(e, e.type === "birthday")}</a>${e.type !== "birthday" ? ` <span class="who">(${esc(e.person_name)})</span>` : ""}</span></li>`).join("");

    app().innerHTML = `
      ${path("Calendar")}
      ${pagehead("Calendar", "birthdays, anniversaries and events")}
      <div class="cols two-r">
        <div class="col">
          <div class="calnav">
            <button class="btn" data-action="cal-move" data-v="-1" ${off === 0 ? "disabled" : ""}>« Prev</button>
            <span>${y}/${pad(m + 1)}</span>
            <button class="btn" data-action="cal-move" data-v="1" ${off === 11 ? "disabled" : ""}>Next »</button>
          </div>
          <table class="bigcal"><tr>${WD.map((w, i) => `<th class="${i === 0 ? "su" : i === 6 ? "sa" : ""}">${w}</th>`).join("")}</tr>${body}</table>
          <p class="st">★ = birthday. Dates repeat every year unless marked as one-off.</p>
        </div>
        <div class="col">
          ${box("Next 12 months", list ? `<ul class="dl">${list}</ul>` : empty("No dates yet."), { n: events.length })}
        </div>
      </div>`;
  }

  // ---------- Search ----------
  async function viewSearch(q) {
    const r = await api("GET", `/api/search?q=${encodeURIComponent(q)}`);
    $("#search-input").value = q;
    const rx = new RegExp(esc(q).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
    const hl = (s) => esc(s).replace(rx, (x) => `<mark>${x}</mark>`);
    const people = r.people.map((p) => `<a href="#/person/${p.id}">${photo(p, 50)}${hl(p.name)}${p.nickname ? `<span class="meta">${hl(p.nickname)}</span>` : ""}</a>`).join("");
    const mems = r.memories.map((m) => `<li>${cat(m.kind)}<span class="t"><a href="#/person/${m.person_id}">${hl(m.text)}</a> <span class="st">(${esc(m.nickname || m.name)})</span>${m.detail ? `<div class="detail">${hl(m.detail)}</div>` : ""}</span></li>`).join("");
    const chats = r.interactions.map((i) => `<li><span class="d">${ymd(i.date)}</span><span class="t"><a href="#/person/${i.person_id}">${hl(i.topics)}</a> <span class="who">(${esc(i.nickname || i.name)})</span>${i.follow_up ? `<br><span class="st">next time: ${hl(i.follow_up)}</span>` : ""}</span></li>`).join("");
    const total = r.people.length + r.memories.length + r.interactions.length;
    app().innerHTML = `
      ${path("Search results")}
      ${pagehead(`Search results for “${esc(q)}”`, `${total} hit${total === 1 ? "" : "s"}`)}
      <div class="col">
        ${!total ? box("No results", empty("Nothing matched. Try another word.")) : ""}
        ${people ? box("People", `<div class="pgrid wide">${people}</div>`, { n: r.people.length }) : ""}
        ${mems ? box("Notes", `<ul class="notes">${mems}</ul>`, { n: r.memories.length }) : ""}
        ${chats ? box("Conversations", `<ul class="dl">${chats}</ul>`, { n: r.interactions.length }) : ""}
      </div>`;
  }

  // ---------- Settings ----------
  async function viewSettings() {
    let theme = "auto";
    try { theme = localStorage.getItem("mannele.theme") || "auto"; } catch (_) { /* ignore */ }
    app().innerHTML = `
      ${path("Settings")}
      ${pagehead("Settings")}
      <table class="ftable">
        ${frow("Display", `<span class="radios" id="theme">
            <label><input type="radio" name="theme" value="auto"> Follow device</label>
            <label><input type="radio" name="theme" value="light"> Light</label>
            <label><input type="radio" name="theme" value="dark"> Dark</label></span>`)}
        ${frow("Backup", `<p>All data is kept in one SQLite file on this machine. Download a backup every now and then.</p>
            <button class="btn orange" data-action="export">Download backup (JSON)</button>
            <label class="btn" style="cursor:pointer">Restore from file...<input type="file" id="import-file" accept="application/json,.json" hidden></label>
            <label class="check" style="display:flex;margin-top:6px"><input type="checkbox" id="import-replace"> Replace all current data when restoring (otherwise merge)</label>`)}
        ${frow("Example data", `<p>Adds a few example people so you can try things out.</p><button class="btn" data-action="seed-demo">Load example people</button>`)}
        <tr id="session-row" hidden><th>Session</th><td><p>This notebook is password-protected.</p><button class="btn" data-action="logout">Log out</button></td></tr>
      </table>`;
    const r = $(`#theme input[value="${theme}"]`);
    if (r) r.checked = true;
    $("#theme").addEventListener("change", (e) => {
      try { localStorage.setItem("mannele.theme", e.target.value); } catch (_) { /* ignore */ }
      applyTheme();
    });
    $("#import-file").addEventListener("change", importFile);
    const s = await api("GET", "/api/session");
    $("#session-row").hidden = !s.auth;
  }

  async function importFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      const replace = $("#import-replace").checked;
      if (replace && !(await confirmBox("Replace all data?", "Every current person, note and conversation will be deleted before the backup is restored.", "Replace"))) return;
      const r = await api("POST", "/api/import", { data, replace });
      toast(`Restored ${r.people_imported} people.`);
    } catch (err) {
      toast(err.message || "Couldn't read that file", true);
    } finally {
      e.target.value = "";
    }
  }

  // ---------- Login ----------
  let authEnabled = false;
  function setChrome(on) {
    $("#hd").hidden = !on;
    $("#ft").hidden = !on;
    $("#logout-item").hidden = !(on && authEnabled);
  }
  function viewLogin() {
    setChrome(false);
    app().innerHTML = `
      <div class="center">${box("Log in", `
        <span class="logo-word">Mannele</span>
        <form data-form="login">
          <table class="ftable">${frow("Password", `<input type="password" name="password" aria-label="Password" autofocus required autocomplete="current-password" style="width:100%">`)}</table>
          <div class="submit-row"><button class="btn orange big" type="submit">Log in</button></div>
        </form>`)}</div>`;
    setTimeout(() => { const i = $("input[name=password]"); if (i) i.focus(); }, 30);
  }

  // ------------------------------------------------------------------
  // forms
  // ------------------------------------------------------------------
  function personForm(p) {
    p = p || {};
    const av = Avatar.normalize(parseAv(p.avatar), p.id ? p.id + ":" + p.name : Math.random());
    let birthday = p.birthday || "", unknownYear = false;
    if (birthday.startsWith("--")) { unknownYear = true; birthday = "2000" + birthday.slice(1); }
    const circles = Object.entries(CIRCLES).map(([k, c]) => `<label><input type="radio" name="circle" value="${k}" ${(p.circle || "friends") === k ? "checked" : ""}> ${c.label}</label>`).join("");
    const freq = [[0, "No reminder"], [7, "Every week"], [14, "Every two weeks"], [30, "Every month"], [60, "Every two months"], [90, "Every three months"], [180, "Twice a year"], [365, "Once a year"]];
    const curFreq = p.checkin_days ?? 30;
    if (!freq.some(([v]) => v === curFreq)) freq.push([curFreq, `Every ${curFreq} days`]);

    openModal(p.id ? `Edit profile: ${esc(p.name)}` : "Add a person", `
      <form data-form="person" data-id="${p.id || ""}">
        <input type="hidden" name="avatar">
        <table class="ftable">
          ${frow("Portrait", `<div class="maker"><div><span class="photo s76" id="av-preview"></span><button type="button" class="btn" data-action="av-random" style="margin-top:4px;font-size:11px">Random</button></div><div class="opts" id="av-opts"></div></div>`)}
          ${frow("Name", `<input id="f-name" type="text" name="name" required maxlength="120" value="${esc(p.name)}" autofocus>`, true)}
          ${frow("Nickname", `<input type="text" name="nickname" maxlength="120" value="${esc(p.nickname)}">`, false, "What you call them. Shown instead of the full name in lists.")}
          ${frow("Pronouns", `<input type="text" name="pronouns" maxlength="40" value="${esc(p.pronouns)}" list="pronoun-list" class="short" style="width:160px">
            <datalist id="pronoun-list"><option value="she/her"><option value="he/him"><option value="they/them"><option value="she/they"><option value="he/they"></datalist>`)}
          ${frow("Group", `<span class="radios">${circles}</span>`)}
          ${frow("Birthday", `<input type="date" name="birthday" value="${esc(birthday)}"> <label class="check"><input type="checkbox" name="unknown_year" ${unknownYear ? "checked" : ""}> year unknown</label>`)}
          ${frow("Check-in", `<select name="checkin_days" id="f-freq" class="short">${freq.map(([v, l]) => `<option value="${v}">${l}</option>`).join("")}</select>`, false, "You'll be reminded on the home page when it's been longer than this.")}
          ${frow("How we met", `<input type="text" name="how_met" maxlength="2000" value="${esc(p.how_met)}">`)}
          ${frow("About", `<textarea name="notes" maxlength="10000">${esc(p.notes)}</textarea>`)}
          ${frow("Favourite", `<label class="check"><input type="checkbox" name="favorite" ${p.favorite ? "checked" : ""}> Show first in lists ♥</label>`)}
        </table>
        ${submitRow(p.id ? "Save" : "Register")}
      </form>`, { wide: true });
    $("#f-freq").value = String(curFreq);
    setupMaker(av);
  }

  function setupMaker(av) {
    const O = Avatar.OPTIONS, L = Avatar.LABELS;
    const swatches = (key, colors) => colors.map((c) =>
      `<button type="button" class="swatch ${av[key] === c ? "on" : ""}" style="background:${c}" data-action="av-set" data-k="${key}" data-v="${c}" aria-label="${key} ${c}"></button>`).join("");
    const select = (key, label) => `<label class="orow"><span>${label}</span><select data-av="${key}">${O[key].map((v) => `<option value="${v}" ${av[key] === v ? "selected" : ""}>${L[key][v]}</option>`).join("")}</select></label>`;
    const paint = () => {
      $("#av-preview").innerHTML = Avatar.render(av, "x");
      $("input[name=avatar]").value = JSON.stringify(av);
      $("#av-opts").innerHTML = `
        <div class="orow"><span>Hair</span>${swatches("hair", O.hair)}</div>
        <div class="orow"><span>Skin</span>${swatches("skin", O.skin)}</div>
        <div class="orow"><span>Eyes</span>${swatches("eye", O.eye)}</div>
        <div class="orow"><span>Background</span>${swatches("bg", O.bg)}</div>
        ${select("style", "Hairstyle")}${select("eyes", "Expression")}${select("mouth", "Mouth")}${select("acc", "Accessory")}`;
      $$("#av-opts select").forEach((s) => s.addEventListener("change", () => { av[s.dataset.av] = s.value; paint(); }));
    };
    actions["av-set"] = (el) => { av[el.dataset.k] = el.dataset.v; paint(); };
    actions["av-random"] = () => { Object.assign(av, Avatar.randomFor(Math.random())); paint(); };
    paint();
  }

  function memoryForm(m, personId) {
    m = m || { kind: "note", status: "open" };
    const statuses = { open: "Open", resolved: "Resolved", given: "Given", archived: "Archived" };
    openModal(m.id ? "Edit note" : "Add a note", `
      <form data-form="memory" data-id="${m.id || ""}" data-person="${personId || ""}">
        <table class="ftable">
          ${frow("Category", `<select id="m-kind" name="kind">${KIND_ORDER.map((k) => `<option value="${k}">${MEMORY_KINDS[k].label} — ${MEMORY_KINDS[k].hint}</option>`).join("")}</select>`)}
          ${frow("Note", `<input type="text" name="text" required maxlength="1000" value="${esc(m.text)}" autofocus>`, true)}
          ${frow("Details", `<textarea name="detail" maxlength="5000">${esc(m.detail)}</textarea>`, false, "Context, sizes, links, who said what.")}
          ${frow("Status", `<span class="radios">${Object.entries(statuses).map(([k, v]) => `<label><input type="radio" name="status" value="${k}" ${m.status === k ? "checked" : ""}> ${v}</label>`).join("")}</span>`)}
          ${frow("Pin", `<label class="check"><input type="checkbox" name="pinned" ${m.pinned ? "checked" : ""}> Keep at the top</label>`)}
        </table>
        ${submitRow()}
      </form>`);
    $("#m-kind").value = m.kind;
  }

  function chatForm(i, personId, people) {
    i = i || { date: state.today, mode: "chat", mood: "" };
    openModal(i.id ? "Edit conversation" : "Log a conversation", `
      <form data-form="chat" data-id="${i.id || ""}" data-person="${personId || ""}">
        <table class="ftable">
          ${people ? frow("Person", `<select id="c-person" name="person_id" required>${people.map((p) => `<option value="${p.id}">${esc(p.name)}</option>`).join("")}</select>`, true) : ""}
          ${frow("Date", `<input type="date" name="date" value="${esc(i.date)}" required>`, true)}
          ${frow("Type", `<span class="radios">${Object.entries(MODES).map(([k, v]) => `<label><input type="radio" name="mode" value="${k}" ${(i.mode || "chat") === k ? "checked" : ""}> ${v}</label>`).join("")}</span>`)}
          ${frow("Mood", `<span class="radios"><label><input type="radio" name="mood" value="" ${!i.mood ? "checked" : ""}> -</label>${MOODS.map((mo) => `<label><input type="radio" name="mood" value="${mo}" ${i.mood === mo ? "checked" : ""}> ${mo}</label>`).join("")}</span>`, false, "How they seemed.")}
          ${frow("Topics", `<textarea name="topics" maxlength="5000" autofocus>${esc(i.topics)}</textarea>`, false, "What you talked about. Future you will thank you.")}
          ${frow("Ask next time", `<input type="text" name="follow_up" maxlength="2000" value="${esc(i.follow_up)}">`, false, "Shown on the home page until your next conversation.")}
        </table>
        ${submitRow()}
      </form>`, { wide: true });
    if (personId && $("#c-person")) $("#c-person").value = personId;
  }

  function dateForm(d, personId) {
    d = d || { yearly: 1 };
    openModal(d.id ? "Edit date" : "Add a date", `
      <form data-form="date" data-id="${d.id || ""}" data-person="${personId || ""}">
        <table class="ftable">
          ${frow("Title", `<input type="text" name="label" required maxlength="200" value="${esc(d.label)}" autofocus>`, true, "e.g. wedding anniversary, exam, operation, first day at work")}
          ${frow("Date", `<input type="date" name="date" required value="${esc(String(d.date || "").startsWith("--") ? "2000" + d.date.slice(1) : d.date)}">`, true)}
          ${frow("Repeat", `<label class="check"><input type="checkbox" name="yearly" ${d.yearly ? "checked" : ""}> Every year</label>`)}
          ${frow("Notes", `<input type="text" name="notes" maxlength="2000" value="${esc(d.notes)}">`)}
        </table>
        ${submitRow()}
      </form>`);
  }

  async function relForm(personId, rel) {
    const everyone = await getPeople();
    const people = everyone.filter((p) => p.id !== personId);
    const me = everyone.find((p) => p.id === personId);
    if (!people.length) return toast("Add another person first.", true);
    let otherId = "", kind = "friend";
    if (rel) {
      const role = relRole(rel, personId);
      otherId = role.otherId; kind = role.kind;
    }
    const kinds = Object.entries(REL).map(([k, v]) => `<option value="${k}">${esc(v.label)}</option>`).join("");
    openModal(rel ? "Edit connection" : `Add a connection for ${esc(dname(me))}`, `
      <form data-form="rel" data-id="${rel ? rel.id : ""}" data-person="${personId}">
        <table class="ftable">
          ${frow("Person", `<select id="r-other" name="other" required>${people.map((p) => `<option value="${p.id}">${esc(p.name)}${p.nickname ? ` (${esc(p.nickname)})` : ""}</option>`).join("")}</select>`, true)}
          ${frow("Relationship", `is ${esc(dname(me))}'s <select id="r-kind" name="kind" class="short" style="width:auto">${kinds}</select>`, true)}
          ${frow("Notes", `<input type="text" name="notes" maxlength="2000" value="${esc(rel ? rel.notes : "")}">`)}
        </table>
        ${submitRow()}
      </form>`);
    if (otherId) $("#r-other").value = otherId;
    $("#r-kind").value = kind;
  }

  async function quickJot() {
    const people = await getPeople();
    if (!people.length) return personForm();
    const cur = currentPersonId();
    const opts = people.slice().sort((a, b) => a.name.localeCompare(b.name))
      .map((p) => `<option value="${p.id}">${esc(p.name)}</option>`).join("");
    openModal("Jot down", `
      <form data-form="jot">
        <table class="ftable">
          ${frow("Person", `<select id="j-person" name="person_id">${opts}</select>`)}
          ${frow("Category", `<select id="j-kind" name="kind"><option value="__chat">Conversation (today)</option>${KIND_ORDER.map((k) => `<option value="${k}">${MEMORY_KINDS[k].label}</option>`).join("")}</select>`)}
          ${frow("Note", `<textarea name="text" required maxlength="1000" autofocus></textarea>`, true)}
        </table>
        ${submitRow()}
      </form>`);
    if (cur) $("#j-person").value = cur;
    $("#j-kind").value = "interest";
  }

  const MAX_PHOTOS = 3;

  /** Shrink a picked image in the browser (max 1600px, JPEG) so uploads stay small. GIFs are kept as-is. */
  async function prepareImage(file) {
    if (!file || !/^image\//.test(file.type)) throw new Error("Please choose an image file.");
    if (file.type === "image/gif" && file.size < 6e6) {
      return await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(file); });
    }
    let bmp;
    try { bmp = await createImageBitmap(file, { imageOrientation: "from-image" }); }
    catch (_) { throw new Error("This image format can't be read by your browser. Try JPEG or PNG."); }
    const k = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.round(bmp.width * k));
    c.height = Math.max(1, Math.round(bmp.height * k));
    const ctx = c.getContext("2d");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.drawImage(bmp, 0, 0, c.width, c.height);
    return c.toDataURL("image/jpeg", 0.86);
  }

  function photoForm(personId) {
    const p = state.current && state.current.id === personId ? state.current : null;
    if (p && (p.photos || []).length >= MAX_PHOTOS) return toast(`Up to ${MAX_PHOTOS} photos per person. Delete one first.`, true);
    openModal(`Add a photo${p ? ` of ${esc(p.name)}` : ""}`, `
      <form data-form="photo" data-person="${personId}">
        <table class="ftable">
          ${frow("Photo", `<input type="file" name="file" id="ph-file" accept="image/*" required><div id="ph-preview" class="ph-preview"></div>`, true, "JPEG, PNG, GIF or WebP. Large photos are resized before saving.")}
          ${frow("Caption", `<input type="text" name="caption" maxlength="200">`, false, "e.g. “Summer trip, 2024”")}
        </table>
        <p class="st">The drawn portrait stays the main picture; photos are shown under it on the profile page.</p>
        ${submitRow("Upload")}
      </form>`);
    const form = $("form[data-form=photo]");
    $("#ph-file").addEventListener("change", async (e) => {
      form._data = null;
      $("#ph-preview").innerHTML = "";
      try {
        form._data = await prepareImage(e.target.files[0]);
        $("#ph-preview").innerHTML = `<img src="${form._data}" alt="Preview">`;
      } catch (err) { toast(err.message, true); e.target.value = ""; }
    });
  }

  function photoViewer(i) {
    const p = state.current;
    const list = p.photos || [];
    if (!list.length) return;
    i = (i + list.length) % list.length;
    const ph = list[i];
    openModal(`${esc(p.name)} — photo ${i + 1} / ${list.length}`, `
      <div class="viewer"><img src="/api/photos/${ph.id}" alt="${esc(ph.caption || `Photo of ${p.name}`)}"></div>
      <p class="st" style="text-align:center">Added ${ymd(ph.created_at)}</p>
      <form data-form="photo-caption" data-id="${ph.id}">
        <table class="ftable">${frow("Caption", `<input type="text" name="caption" maxlength="200" value="${esc(ph.caption)}">`)}</table>
        <div class="submit-row">
          ${list.length > 1 ? `<button type="button" class="btn" data-action="view-photo" data-i="${i - 1}">« Prev</button>` : ""}
          <button type="submit" class="btn orange">Save caption</button>
          <button type="button" class="btn" data-action="delete-photo" data-id="${ph.id}">Delete photo</button>
          ${list.length > 1 ? `<button type="button" class="btn" data-action="view-photo" data-i="${i + 1}">Next »</button>` : ""}
        </div>
      </form>`, { wide: true });
  }

  const formValues = (form) => {
    const out = {};
    new FormData(form).forEach((v, k) => { if (typeof v === "string") out[k] = v.trim(); });
    $$("input[type=checkbox]", form).forEach((c) => { if (c.name) out[c.name] = c.checked; });
    return out;
  };

  const forms = {
    async login(form, v) {
      await api("POST", "/api/login", { password: v.password });
      await boot();
    },
    async person(form, v) {
      let bday = v.birthday || "";
      if (bday && v.unknown_year) bday = "--" + bday.slice(5);
      const body = {
        name: v.name, nickname: v.nickname, pronouns: v.pronouns, circle: v.circle,
        checkin_days: +v.checkin_days, birthday: bday, how_met: v.how_met, notes: v.notes,
        favorite: v.favorite, avatar: JSON.parse(v.avatar || "{}"),
      };
      const id = form.dataset.id;
      const p = id ? await api("PUT", `/api/people/${id}`, body) : await api("POST", "/api/people", body);
      closeModal();
      toast(id ? "Saved." : `${p.name} was added.`);
      if (!id) location.hash = `#/person/${p.id}`; else render(true);
    },
    async "quick-memory"(form, v) {
      await api("POST", `/api/people/${form.dataset.person}/memories`, { kind: v.kind, text: v.text });
      toast("Note added.");
      const kind = v.kind;
      await render(true);
      const sel = $(".quick select");
      if (sel) sel.value = kind;
      const inp = $(".quick input[name=text]");
      if (inp) inp.focus();
    },
    async memory(form, v) {
      const body = { kind: v.kind, text: v.text, detail: v.detail, status: v.status, pinned: v.pinned };
      if (form.dataset.id) await api("PUT", `/api/memories/${form.dataset.id}`, body);
      else await api("POST", `/api/people/${form.dataset.person}/memories`, body);
      closeModal(); toast("Saved."); render(true);
    },
    async chat(form, v) {
      const body = { date: v.date, mode: v.mode, mood: v.mood, topics: v.topics, follow_up: v.follow_up };
      const pid = v.person_id || form.dataset.person;
      if (form.dataset.id) await api("PUT", `/api/interactions/${form.dataset.id}`, body);
      else await api("POST", `/api/people/${pid}/interactions`, body);
      closeModal(); toast("Conversation saved."); render(true);
    },
    async date(form, v) {
      const body = { label: v.label, date: v.date, yearly: v.yearly, notes: v.notes };
      if (form.dataset.id) await api("PUT", `/api/dates/${form.dataset.id}`, body);
      else await api("POST", `/api/people/${form.dataset.person}/dates`, body);
      closeModal(); toast("Date saved."); render(true);
    },
    async rel(form, v) {
      const body = { a_id: +v.other, b_id: +form.dataset.person, kind: v.kind, notes: v.notes };
      if (form.dataset.id) await api("PUT", `/api/relationships/${form.dataset.id}`, body);
      else await api("POST", "/api/relationships", body);
      closeModal(); toast("Connection saved."); render(true);
    },
    async photo(form, v) {
      const data = form._data || await prepareImage($("#ph-file").files[0]);
      await api("POST", `/api/people/${form.dataset.person}/photos`, { data, caption: v.caption });
      closeModal(); toast("Photo added."); render(true);
    },
    async "photo-caption"(form, v) {
      await api("PUT", `/api/photos/${form.dataset.id}`, { caption: v.caption });
      closeModal(); toast("Caption saved."); render(true);
    },
    async jot(form, v) {
      if (v.kind === "__chat") {
        await api("POST", `/api/people/${v.person_id}/interactions`, { date: state.today, mode: "chat", topics: v.text });
      } else {
        await api("POST", `/api/people/${v.person_id}/memories`, { kind: v.kind, text: v.text });
      }
      closeModal(); toast("Noted."); render(true);
    },
  };

  // ------------------------------------------------------------------
  // actions (click delegation)
  // ------------------------------------------------------------------
  const findIn = (list, id) => (list || []).find((x) => String(x.id) === String(id));
  const currentPersonId = () => { const m = /^#\/person\/(\d+)/.exec(location.hash); return m ? +m[1] : null; };

  const actions = {
    "close-modal": closeModal,
    "page-top": () => window.scrollTo({ top: 0, behavior: "smooth" }),
    "new-person": () => personForm(),
    "edit-person": () => personForm(state.current),
    "delete-person": async () => {
      const p = state.current;
      if (await confirmBox(`Delete ${p.name}?`, "All of their notes, conversations, dates and connections will be permanently deleted.")) {
        await api("DELETE", `/api/people/${p.id}`);
        toast(`${p.name} was deleted.`);
        location.hash = "#/people";
      }
    },
    "quick-jot": quickJot,
    "seed-demo": async () => {
      await api("POST", "/api/demo");
      toast("Example people added.");
      if (location.hash === "#/" || location.hash === "") render(); else location.hash = "#/";
    },
    refresh: () => render(true),
    "filter-circle": (el) => { state.peopleFilter = el.dataset.v; viewPeople(); },
    "mem-filter": (el) => { state.memFilter = el.dataset.v; render(true); },
    "mem-status": async (el) => {
      await api("PUT", `/api/memories/${el.dataset.id}`, { status: el.dataset.v });
      toast(el.dataset.v === "resolved" ? "Marked as resolved." : el.dataset.v === "given" ? "Marked as given." : "Reopened.");
      render(true);
    },
    "mem-pin": async (el) => { await api("PUT", `/api/memories/${el.dataset.id}`, { pinned: el.dataset.v === "1" }); render(true); },
    "edit-memory": (el) => memoryForm(findIn(state.current.memories, el.dataset.id), state.current.id),
    "delete-memory": async (el) => {
      if (await confirmBox("Delete this note?", findIn(state.current.memories, el.dataset.id).text)) {
        await api("DELETE", `/api/memories/${el.dataset.id}`); render(true);
      }
    },
    "log-chat": async (el) => {
      const pid = el.dataset.person ? +el.dataset.person : null;
      chatForm(null, pid, pid ? null : await getPeople());
    },
    "edit-chat": (el) => chatForm(findIn(state.current.interactions, el.dataset.id), state.current.id),
    "delete-chat": async (el) => {
      if (await confirmBox("Delete this conversation?", "The topics you noted will be deleted.")) {
        await api("DELETE", `/api/interactions/${el.dataset.id}`); render(true);
      }
    },
    "new-date": (el) => dateForm(null, +el.dataset.person),
    "new-memory": (el) => memoryForm(null, +el.dataset.person),
    "add-photo": (el) => photoForm(+el.dataset.person),
    "view-photo": (el) => photoViewer(+el.dataset.i),
    "delete-photo": async (el) => {
      if (await confirmBox("Delete this photo?", "The photo file will be removed from this machine.")) {
        await api("DELETE", `/api/photos/${el.dataset.id}`); toast("Photo deleted."); render(true);
      }
    },
    "cal-move": (el) => { state.calOffset = Math.max(0, Math.min(11, (state.calOffset || 0) + +el.dataset.v)); viewCalendar(); },
    "edit-date": (el) => dateForm(findIn(state.current.dates, el.dataset.id), state.current.id),
    "delete-date": async (el) => {
      if (await confirmBox("Delete this date?", findIn(state.current.dates, el.dataset.id).label)) {
        await api("DELETE", `/api/dates/${el.dataset.id}`); render(true);
      }
    },
    "new-rel": (el) => relForm(+el.dataset.person),
    "edit-rel": (el) => relForm(state.current.id, findIn(state.current.relationships, el.dataset.id)),
    "delete-rel": async (el) => {
      if (await confirmBox("Remove this connection?", "Both people are kept; only the link is removed.", "Remove")) {
        await api("DELETE", `/api/relationships/${el.dataset.id}`); render(true);
      }
    },
    export: async () => {
      const data = await api("GET", "/api/export");
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `mannele-backup-${state.today}.json`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
      toast("Backup downloaded.");
    },
    logout: async () => { await api("POST", "/api/logout", {}); viewLogin(); },
  };

  function handleError(err) {
    if (err instanceof AuthError) { closeModal(); viewLogin(); return; }
    console.error(err);
    toast(err.message || "Something went wrong.", true);
  }

  document.addEventListener("click", async (e) => {
    const el = e.target.closest("[data-action]");
    if (!el) {
      if (e.target.id === "modal") closeModal();
      return;
    }
    const fn = actions[el.dataset.action];
    if (!fn) return;
    e.preventDefault();
    try { await fn(el, e); } catch (err) { handleError(err); }
  });

  document.addEventListener("submit", async (e) => {
    const form = e.target.closest("form[data-form]");
    if (form) {
      e.preventDefault();
      const btn = form.querySelector("[type=submit]");
      if (btn) btn.disabled = true;
      try { await forms[form.dataset.form](form, formValues(form)); } catch (err) { handleError(err); } finally { if (btn) btn.disabled = false; }
    }
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !$("#modal").hidden) closeModal();
    const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName);
    if (!typing && $("#modal").hidden && !$("#hd").hidden) {
      if (e.key === "/") { e.preventDefault(); $("#search-input").focus(); }
      else if (e.key === "n") { e.preventDefault(); quickJot().catch(handleError); }
    }
  });

  $("#search-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const q = $("#search-input").value.trim();
    if (q) location.hash = `#/search/${encodeURIComponent(q)}`;
  });

  // ------------------------------------------------------------------
  // router
  // ------------------------------------------------------------------
  let lastRoute = "";
  async function render(keepScroll) {
    if (webStop) { webStop(); webStop = null; }
    const hash = location.hash.replace(/^#\/?/, "");
    const [section, arg] = hash.split("/");
    const scroll = window.scrollY;
    if (hash !== lastRoute) {
      state.memFilter = "all";
      if (section !== "search") $("#search-input").value = "";
      keepScroll = false;
    }
    lastRoute = hash;
    $$("#nav li").forEach((li) => li.classList.toggle("active", li.dataset.nav === (section || "home") || (section === "person" && li.dataset.nav === "people")));
    if (!keepScroll) loading();
    try {
      switch (section) {
        case "": case undefined: await viewHome(); break;
        case "people": await viewPeople(arg); break;
        case "person": await viewPerson(+arg); break;
        case "web": await viewWeb(); break;
        case "calendar": await viewCalendar(); break;
        case "settings": await viewSettings(); break;
        case "search": await viewSearch(decodeURIComponent(arg || "")); break;
        default: location.hash = "#/"; return;
      }
      window.scrollTo(0, keepScroll ? scroll : 0);
    } catch (err) {
      if (err instanceof AuthError) return viewLogin();
      app().innerHTML = box("Error", `${empty(err.message || "Couldn't load this page.")}<p><a class="more" href="#/">Back to home</a></p>`);
    }
  }

  // ------------------------------------------------------------------
  // theme & boot
  // ------------------------------------------------------------------
  function applyTheme() {
    let t = "auto";
    try { t = localStorage.getItem("mannele.theme") || "auto"; } catch (_) { /* ignore */ }
    if (t === "auto") document.documentElement.removeAttribute("data-theme");
    else document.documentElement.setAttribute("data-theme", t);
  }

  function setTodayLabel() {
    const d = toDate(state.today);
    if (d) $("#today-label").textContent = `Today: ${ymd(state.today)}(${WD[d.getDay()]})`;
  }

  async function boot() {
    try {
      const meta = await api("GET", "/api/meta");
      state.today = meta.today;
      authEnabled = !!meta.auth;
    } catch (err) {
      if (err instanceof AuthError) return viewLogin();
    }
    setTodayLabel();
    setChrome(true);
    await render();
  }

  applyTheme();
  window.addEventListener("hashchange", () => render());
  boot();
})();
