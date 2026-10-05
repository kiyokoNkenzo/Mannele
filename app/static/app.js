/* Mannele｜まんねれ — relationship notebook */
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
    family: { label: "Family", jp: "家族", color: "#c0703a" },
    partner: { label: "Partner", jp: "パートナー", color: "#b5546f" },
    friends: { label: "Friends", jp: "友人", color: "#3c6e47" },
    work: { label: "Work", jp: "仕事", color: "#223a5e" },
    community: { label: "Community", jp: "地域", color: "#9a7417" },
    other: { label: "Other", jp: "その他", color: "#6b6b6b" },
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
    love: { label: "Partners", color: "#b5546f" },
    family: { label: "Family", color: "#c0703a" },
    friend: { label: "Friends", color: "#3c6e47" },
    work: { label: "Work / school", color: "#223a5e" },
    pet: { label: "Pets", color: "#9a7417" },
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
  const avatar = (p, size = "sm") =>
    `<span class="av ${size}">${Avatar.render(parseAv(p.avatar), (p.id || "") + ":" + (p.name || p.nickname || ""), { title: dname(p) })}</span>`;

  const WD = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const WD_JP = ["日", "月", "火", "水", "木", "金", "土"];
  const pad = (n) => String(n).padStart(2, "0");

  function toDate(iso) {
    const m = /^(\d{4}-|--)(\d{2})-(\d{2})/.exec(iso || "");
    if (!m) return null;
    return new Date(m[1] === "--" ? 2000 : +m[1].slice(0, 4), +m[2] - 1, +m[3]);
  }
  /** 2026.10.14 — or 10.14 when the year is unknown / not wanted */
  function fmtDate(iso, withYear = true) {
    const d = toDate(iso);
    if (!d) return "";
    const md = `${pad(d.getMonth() + 1)}.${pad(d.getDate())}`;
    return withYear && !String(iso).startsWith("--") ? `${d.getFullYear()}.${md}` : md;
  }
  function daysSince(iso) {
    const a = toDate(iso), b = toDate(state.today);
    return a && b ? Math.round((b - a) / 86400000) : null;
  }
  function ago(days) {
    if (days == null) return "no record";
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

  function dblock(iso, days) {
    const d = toDate(iso);
    const cls = days === 0 ? "today" : days != null && days <= 7 ? "soon" : "";
    return `<span class="dblock ${cls}"><b>${d ? `${pad(d.getMonth() + 1)}.${pad(d.getDate())}` : "--"}</b><small>${d ? WD[d.getDay()] : ""}</small></span>`;
  }
  const ordinal = (n) => n + (["th", "st", "nd", "rd"][(n % 100 - 20) % 10] || ["th", "st", "nd", "rd"][n % 100] || "th");
  const kindTag = (k) => { const m = MEMORY_KINDS[k] || MEMORY_KINDS.note; return `<span class="tag t-${MEMORY_KINDS[k] ? k : "note"}">${m.label}</span>`; };

  function eventTitle(e, withPerson = true) {
    if (e.type === "birthday") {
      return `${withPerson ? esc(e.person_name) + "'s birthday" : "Birthday"}${e.years ? ` <span class="muted">(turning ${e.years})</span>` : ""}`;
    }
    return `${esc(e.label)}${e.years ? ` <span class="muted">(${ordinal(e.years)})</span>` : ""}${withPerson ? ` <span class="muted">— ${esc(e.person_name)}</span>` : ""}`;
  }
  const eventTag = (e) => (e.type === "birthday" ? `<span class="tag t-birthday">Birthday</span>` : `<span class="tag t-date">Event</span>`);

  function relRole(rel, viewerId) {
    // Stored meaning: a is <kind> of b. Returns the other person and their role relative to the viewer.
    if (rel.b_id === viewerId) return { otherId: rel.a_id, name: rel.a_nickname || rel.a_name, avatar: rel.a_avatar, oname: rel.a_name, kind: rel.kind };
    return { otherId: rel.b_id, name: rel.b_nickname || rel.b_name, avatar: rel.b_avatar, oname: rel.b_name, kind: (REL[rel.kind] || REL.friend).inv };
  }

  const sec = (en, jp, right = "") => `<h2 class="sec"><span>${en}</span><span class="jp">${jp}</span>${right ? `<span class="right">${right}</span>` : ""}</h2>`;
  const pageTitle = (en, jp, right = "") => `<div class="page-title"><h1><span class="jp">${jp}</span>${en}</h1>${right ? `<span class="spacer"></span>${right}` : ""}</div>`;
  const crumbs = (...parts) => `<nav class="breadcrumb" aria-label="Breadcrumb"><a href="#/">Home</a>${parts.map((p) => `<span class="sep">›</span>${p}`).join("")}</nav>`;
  const empty = (text) => `<div class="empty">${esc(text)}</div>`;

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
  function openModal(html, opts = {}) {
    lastFocus = document.activeElement;
    $("#modal-body").innerHTML = html;
    $(".modal").classList.toggle("wide", !!opts.wide);
    $("#modal").hidden = false;
    modalCleanup = opts.onClose || null;
    const first = $("#modal-body [autofocus]") || $("#modal-body input, #modal-body select, #modal-body textarea");
    if (first) setTimeout(() => first.focus(), 30);
  }
  function closeModal() {
    $("#modal").hidden = true;
    $("#modal-body").innerHTML = "";
    if (modalCleanup) modalCleanup();
    modalCleanup = null;
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }
  const modalHead = (en, jp) => `<h2 id="modal-title">${en}<span class="jp">${jp}</span></h2>`;
  const modalActions = (save = "Save") => `
    <div class="modal-actions">
      <button type="button" class="btn" data-action="close-modal">Cancel</button>
      <button type="submit" class="btn primary">${save}</button>
    </div>`;

  function confirmBox(title, text, okLabel = "Delete") {
    return new Promise((resolve) => {
      let answered = false;
      openModal(`
        ${modalHead(esc(title), "確認")}
        <p class="lead">${esc(text)}</p>
        <div class="modal-actions">
          <button class="btn" data-action="confirm-no">Cancel</button>
          <button class="btn primary" data-action="confirm-yes" autofocus>${esc(okLabel)}</button>
        </div>`, { onClose: () => { if (!answered) resolve(false); } });
      actions["confirm-yes"] = () => { answered = true; closeModal(); resolve(true); };
      actions["confirm-no"] = () => { answered = true; closeModal(); resolve(false); };
    });
  }

  // ------------------------------------------------------------------
  // views
  // ------------------------------------------------------------------
  const app = () => $("#app");
  const loading = () => { app().innerHTML = `<div class="loading">Loading…</div>`; };

  // ---------- Home ----------
  async function viewHome() {
    const d = await api("GET", "/api/dashboard");

    if (!d.counts.people) {
      app().innerHTML = `
        <div class="center-box">
          <span class="hanko">縁</span>
          <h1>Welcome to Mannele</h1>
          <p>A private notebook for the people in your life: what they're into, what they're going through, the dates that matter to them and what you last talked about. Everything stays on your own machine.</p>
          <div class="btns">
            <button class="btn primary arrow" data-action="new-person">Add the first person</button>
            <button class="btn" data-action="seed-demo">Load example people</button>
          </div>
        </div>`;
      return;
    }

    const upcoming = d.upcoming.slice(0, 8).map((e) => `
      <li><a class="item" href="#/person/${e.person_id}">${dblock(e.date, e.days)}${eventTag(e)}
        <div class="body"><div class="title">${eventTitle(e)}</div><div class="meta">${until(e.days)}</div></div></a></li>`).join("");

    const problems = d.open_problems.map((m) => `
      <li><a class="item" href="#/person/${m.person_id}"><span class="date">${fmtDate(m.created_at)}</span>${kindTag("problem")}
        <div class="body"><div class="title">${esc(m.text)}${newMark(m.created_at)}</div><div class="meta">${esc(m.nickname || m.name)}</div></div></a></li>`).join("");

    const followups = d.follow_ups.map((i) => `
      <li><a class="item" href="#/person/${i.person_id}"><span class="date">${fmtDate(i.date)}</span>
        <div class="body"><div class="title">${esc(i.follow_up)}</div><div class="meta">${esc(i.nickname || i.name)} · from a ${esc((MODES[i.mode] || MODES.chat).toLowerCase())}</div></div></a></li>`).join("");

    const recent = d.recent.map((i) => `
      <li><a class="item" href="#/person/${i.person_id}"><span class="date">${fmtDate(i.date)}</span>
        <div class="body"><div class="title">${esc(i.topics || MODES[i.mode] || "Conversation")}</div>
        <div class="meta">${esc(i.nickname || i.name)} · ${esc(MODES[i.mode] || "Chat")}${i.mood ? " · " + esc(i.mood) : ""}</div></div></a></li>`).join("");

    const overdue = d.overdue.map((p) => `
      <li><div class="item">${avatar(p, "sm")}
        <a class="body" href="#/person/${p.id}" style="color:inherit"><div class="title">${esc(dname(p))}</div>
        <div class="meta">${p.days_since_contact == null ? "No conversations logged" : "Last talked " + ago(p.days_since_contact)}</div></a>
        <button class="btn sm" data-action="log-chat" data-person="${p.id}">Log</button></div></li>`).join("");

    const gifts = d.gift_ideas.map((m) => `
      <li><a class="item" href="#/person/${m.person_id}">
        <div class="body"><div class="title">${esc(m.text)}</div><div class="meta">for ${esc(m.nickname || m.name)}</div></div></a></li>`).join("");

    app().innerHTML = `
      ${pageTitle("Home", "ホーム", `<span class="muted num">Updated ${fmtDate(state.today)}</span>`)}
      <div class="stats">
        <div class="stat"><small>People ・ 人</small><b>${d.counts.people}</b></div>
        <div class="stat"><small>Notes ・ 覚え書き</small><b>${d.counts.memories}</b></div>
        <div class="stat"><small>Conversations ・ 会話</small><b>${d.counts.interactions}</b></div>
        <div class="stat"><small>Connections ・ 相関</small><b>${d.counts.relationships}</b></div>
      </div>
      <div class="layout">
        <div class="stack">
          <section class="panel">${sec("Upcoming", "近日の予定", `<a class="more" href="#/calendar">All dates</a>`)}
            ${upcoming ? `<ul class="list">${upcoming}</ul>` : empty("Nothing in the next few weeks.")}</section>
          <section class="panel">${sec("Check in on", "気がかり", `<span class="count">${d.open_problems.length} open</span>`)}
            ${problems ? `<ul class="list">${problems}</ul>` : empty("No open worries recorded.")}</section>
          <section class="panel">${sec("Ask next time", "次に聞くこと")}
            ${followups ? `<ul class="list">${followups}</ul>` : empty("No pending follow-ups.")}</section>
          <section class="panel">${sec("Recent conversations", "最近の会話")}
            ${recent ? `<ul class="list">${recent}</ul>` : empty("No conversations logged yet.")}</section>
        </div>
        <aside class="stack">
          <section class="panel">${sec("Been a while", "ご無沙汰")}
            ${overdue ? `<ul class="list">${overdue}</ul>` : empty("You're up to date with everyone.")}</section>
          <section class="panel">${sec("Gift ideas", "贈り物メモ", `<button class="btn text" data-action="refresh">Shuffle</button>`)}
            ${gifts ? `<ul class="list">${gifts}</ul>` : empty("No gift ideas saved.")}</section>
        </aside>
      </div>`;
  }

  // ---------- People ----------
  async function viewPeople() {
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

    const tabs = [`<button class="tab ${state.peopleFilter === "all" ? "on" : ""}" data-action="filter-circle" data-v="all">All<span class="n">${people.length}</span></button>`]
      .concat(Object.entries(CIRCLES).filter(([k]) => counts[k]).map(([k, c]) =>
        `<button class="tab ${state.peopleFilter === k ? "on" : ""}" data-action="filter-circle" data-v="${k}">${c.label}<span class="n">${counts[k]}</span></button>`)).join("");

    const cards = list.map((p) => {
      const c = CIRCLES[p.circle] || CIRCLES.other;
      const flags = [];
      if (p.next_birthday_days != null && p.next_birthday_days <= 30) flags.push(`<span class="tag t-birthday">Birthday ${until(p.next_birthday_days)}</span>`);
      if (p.open_problems) flags.push(`<span class="tag t-problem">Worries ${p.open_problems}</span>`);
      if (p.gift_ideas) flags.push(`<span class="tag t-gift">Gift ideas ${p.gift_ideas}</span>`);
      if (p.overdue) flags.push(`<span class="tag t-interest">Check in</span>`);
      return `
        <a class="card-person" href="#/person/${p.id}">
          ${avatar(p, "md")}
          <div class="body">
            <div class="ruby">${esc(p.nickname)}</div>
            <div class="name">${esc(p.name)}${p.favorite ? `<span class="fav" title="Favourite">★</span>` : ""}</div>
            <div class="line">${c.label}${p.pronouns ? " ・ " + esc(p.pronouns) : ""} ・ ${p.last_contact ? "talked " + ago(p.days_since_contact) : "no conversations yet"}</div>
            ${flags.length ? `<div class="flags">${flags.join("")}</div>` : ""}
          </div>
        </a>`;
    }).join("");

    app().innerHTML = `
      ${crumbs("People")}
      ${pageTitle("People", "人々", `<button class="btn primary" data-action="new-person">＋ Add person</button>`)}
      <div class="filters">
        <div class="tabs">${tabs}</div>
        <select id="people-sort" aria-label="Sort people">
          <option value="name">Sort: favourites, name</option>
          <option value="contact">Sort: longest since contact</option>
          <option value="birthday">Sort: next birthday</option>
          <option value="recent">Sort: recently added</option>
        </select>
      </div>
      ${cards ? `<div class="directory">${cards}</div>` : `<div class="panel">${empty("Nobody in this group yet.")}</div>`}`;
    const sortSel = $("#people-sort");
    sortSel.value = state.peopleSort;
    sortSel.addEventListener("change", () => { state.peopleSort = sortSel.value; viewPeople(); });
  }

  // ---------- Person ----------
  async function viewPerson(id) {
    const p = await api("GET", `/api/people/${id}`);
    state.current = p;
    const c = CIRCLES[p.circle] || CIRCLES.other;

    const nb = toDate(p.next_birthday);
    const bday = p.birthday
      ? `${fmtDate(p.birthday)} <span class="muted">— ${until(p.next_birthday_days)}${nb ? ` (${WD[nb.getDay()]})` : ""}${p.turning ? `, turning ${p.turning}` : ""}</span>`
      : `<span class="muted">—</span>`;
    const freq = p.checkin_days ? `Every ${p.checkin_days} days` : "No reminder";

    // notes
    const mems = p.memories.filter((m) => state.memFilter === "all" || m.kind === state.memFilter);
    const kindCounts = {};
    p.memories.forEach((m) => { kindCounts[m.kind] = (kindCounts[m.kind] || 0) + 1; });
    const tabs = [`<button class="tab ${state.memFilter === "all" ? "on" : ""}" data-action="mem-filter" data-v="all">All<span class="n">${p.memories.length}</span></button>`]
      .concat(KIND_ORDER.filter((k) => kindCounts[k]).map((k) =>
        `<button class="tab ${state.memFilter === k ? "on" : ""}" data-action="mem-filter" data-v="${k}">${MEMORY_KINDS[k].label}<span class="n">${kindCounts[k]}</span></button>`)).join("");

    const memItem = (m) => {
      const done = m.status === "resolved" || m.status === "given" || m.status === "archived";
      let toggle = "";
      if (m.kind === "problem") toggle = `<button class="icon-btn" data-action="mem-status" data-id="${m.id}" data-v="${done ? "open" : "resolved"}">${done ? "Reopen" : "Resolved"}</button>`;
      else if (m.kind === "gift") toggle = `<button class="icon-btn" data-action="mem-status" data-id="${m.id}" data-v="${done ? "open" : "given"}">${done ? "Not given" : "Given"}</button>`;
      const status = m.status === "resolved" ? " ・ resolved" : m.status === "given" ? " ・ given" : m.status === "archived" ? " ・ archived" : "";
      return `
        <div class="mem ${done ? "done" : ""} ${m.pinned ? "pinned" : ""}">
          ${kindTag(m.kind)}
          <div class="body">
            <div class="text">${m.pinned ? `<span class="pin">PIN</span>` : ""}${esc(m.text)}${newMark(m.created_at)}</div>
            ${m.detail ? `<div class="detail">${esc(m.detail)}</div>` : ""}
            <div class="meta num">${fmtDate(m.created_at)}${status}</div>
          </div>
          <div class="tools">
            ${toggle}
            <button class="icon-btn" data-action="mem-pin" data-id="${m.id}" data-v="${m.pinned ? 0 : 1}">${m.pinned ? "Unpin" : "Pin"}</button>
            <button class="icon-btn" data-action="edit-memory" data-id="${m.id}">Edit</button>
            <button class="icon-btn" data-action="delete-memory" data-id="${m.id}">Delete</button>
          </div>
        </div>`;
    };
    const memHtml = mems.length ? `<div style="border-top:1px solid var(--line-soft)">${mems.map(memItem).join("")}</div>`
      : empty(p.memories.length ? "Nothing in this category." : `Nothing noted about ${dname(p)} yet.`);

    const kindOptions = KIND_ORDER.map((k) => `<option value="${k}">${MEMORY_KINDS[k].label}</option>`).join("");

    // conversations
    const chats = p.interactions.map((i) => `<li>
        <div class="date">${fmtDate(i.date)}<small>${esc(MODES[i.mode] || "Chat")}${i.mood ? " ・ " + esc(i.mood) : ""}</small></div>
        <div>
          <div class="topics">${i.topics ? esc(i.topics) : `<span class="muted">${esc(MODES[i.mode] || "Chat")}</span>`}${newMark(i.created_at)}</div>
          ${i.follow_up ? `<div class="follow">${esc(i.follow_up)}</div>` : ""}
        </div>
        <div class="tools">
          <button class="icon-btn" data-action="edit-chat" data-id="${i.id}">Edit</button>
          <button class="icon-btn" data-action="delete-chat" data-id="${i.id}">Delete</button>
        </div>
      </li>`).join("");

    // dates
    const dates = p.upcoming.map((e) => `
      <li><div class="item">${dblock(e.date, e.days)}
        <div class="body"><div class="title">${eventTitle(e, false)}</div>
        <div class="meta">${until(e.days)}${e.notes ? " ・ " + esc(e.notes) : ""}</div></div>
        ${e.id ? `<span class="tools"><button class="icon-btn" data-action="edit-date" data-id="${e.id}">Edit</button><button class="icon-btn" data-action="delete-date" data-id="${e.id}">Delete</button></span>` : ""}
      </div></li>`).join("");
    const pastDates = p.dates.filter((d) => !p.upcoming.some((e) => e.id === d.id)).map((d) => `
      <li><div class="item"><span class="dblock"><b>Past</b><small>&nbsp;</small></span>
        <div class="body"><div class="title">${esc(d.label)}</div><div class="meta num">${fmtDate(d.date)}</div></div>
        <span class="tools"><button class="icon-btn" data-action="edit-date" data-id="${d.id}">Edit</button><button class="icon-btn" data-action="delete-date" data-id="${d.id}">Delete</button></span>
      </div></li>`).join("");

    // connections
    const rels = p.relationships.map((r) => {
      const role = relRole(r, p.id);
      const lbl = (REL[role.kind] || REL.friend).label;
      return `<li><div class="item">
        <a href="#/person/${role.otherId}">${avatar({ id: role.otherId, name: role.oname, avatar: role.avatar }, "sm")}</a>
        <a class="body" href="#/person/${role.otherId}" style="color:inherit"><div class="title">${esc(role.name)}</div>
        <div class="meta">${esc(dname(p))}'s ${esc(lbl)}${r.notes ? " ・ " + esc(r.notes) : ""}</div></a>
        <span class="tools"><button class="icon-btn" data-action="edit-rel" data-id="${r.id}">Edit</button><button class="icon-btn" data-action="delete-rel" data-id="${r.id}">Delete</button></span>
      </div></li>`;
    }).join("");

    app().innerHTML = `
      ${crumbs(`<a href="#/people">People</a>`, esc(p.name))}
      <section class="profile">
        ${avatar(p, "lg")}
        <div>
          <div class="ruby">${esc(p.nickname)}</div>
          <h1>${esc(p.name)}${p.favorite ? `<span class="fav" title="Favourite">★</span>` : ""}</h1>
          <dl class="spec">
            <dt>Group</dt><dd>${c.label} <span class="muted">${c.jp}</span></dd>
            ${p.pronouns ? `<dt>Pronouns</dt><dd>${esc(p.pronouns)}</dd>` : ""}
            <dt>Birthday</dt><dd class="num">${bday}</dd>
            <dt>Last contact</dt><dd class="num">${p.last_contact ? `${fmtDate(p.last_contact)} <span class="muted">— ${ago(p.days_since_contact)}</span>` : `<span class="muted">No conversations logged</span>`}${p.overdue ? ` <span class="tag t-problem">Check in</span>` : ""}</dd>
            <dt>Reminder</dt><dd>${freq}</dd>
            ${p.how_met ? `<dt>How we met</dt><dd>${esc(p.how_met)}</dd>` : ""}
          </dl>
        </div>
        <div class="actions">
          <button class="btn primary" data-action="log-chat" data-person="${p.id}">Log a conversation</button>
          <button class="btn" data-action="edit-person" data-id="${p.id}">Edit profile</button>
          <button class="btn text" data-action="delete-person" data-id="${p.id}">Delete this person</button>
        </div>
      </section>

      <div class="layout">
        <div class="stack">
          <section class="panel">
            ${sec("Notes", "覚え書き", `<span class="count">${p.memories.length} items</span>`)}
            <form class="quick-add" data-form="quick-memory" data-person="${p.id}">
              <select name="kind" aria-label="Category">${kindOptions}</select>
              <input type="text" name="text" placeholder="What did ${esc(dname(p))} mention?" aria-label="Note" maxlength="1000" required>
              <button class="btn navy" type="submit">Add</button>
            </form>
            <div class="tabs">${tabs}</div>
            ${memHtml}
          </section>
          <section class="panel">
            ${sec("Conversations", "会話の記録", `<button class="btn sm" data-action="log-chat" data-person="${p.id}">＋ Log</button>`)}
            ${chats ? `<ul class="log">${chats}</ul>` : empty("No conversations logged yet.")}
          </section>
        </div>
        <aside class="stack">
          <section class="panel">
            ${sec("Dates", "記念日", `<button class="btn sm" data-action="new-date" data-person="${p.id}">＋ Add</button>`)}
            ${dates || pastDates ? `<ul class="list">${dates}${pastDates}</ul>` : empty("Anniversaries, exams, trips…")}
          </section>
          <section class="panel">
            ${sec("Connections", "相関", `<button class="btn sm" data-action="new-rel" data-person="${p.id}">＋ Link</button>`)}
            ${rels ? `<ul class="list">${rels}</ul>` : empty("No connections yet.")}
          </section>
          <section class="panel">
            ${sec("Profile notes", "備考")}
            ${p.notes ? `<div style="white-space:pre-wrap;overflow-wrap:anywhere">${esc(p.notes)}</div>` : empty("No notes.")}
            <p class="muted num" style="font-size:11.5px;margin:12px 0 0">Registered ${fmtDate(p.created_at)}</p>
          </section>
        </aside>
      </div>`;
  }

  // ---------- Connections chart (相関図) ----------
  let webStop = null;
  async function viewWeb() {
    const g = await api("GET", "/api/relationships");
    const head = `${crumbs("Connections")}${pageTitle("Connections", "相関図")}`;
    if (!g.people.length) {
      app().innerHTML = `${head}<div class="panel">${empty("Add people and link them to see the chart.")}</div>`;
      return;
    }
    let showMe = true;
    try { showMe = localStorage.getItem("mannele.web.me") !== "0"; } catch (_) { /* ignore */ }
    app().innerHTML = `
      ${head}
      <p class="lead-text">Drag to rearrange, scroll to zoom, click a person to open their page. An arrow from A to B reads “A is B's …”.</p>
      <section class="panel flush">
        <div class="web-tools">
          <label class="check"><input type="checkbox" id="web-me" ${showMe ? "checked" : ""}> Show me in the centre</label>
          <span style="flex:1"></span>
          <div class="legend">${Object.values(REL_GROUPS).map((gr) => `<span><i style="background:${gr.color}"></i>${gr.label}</span>`).join("")}</div>
          <button class="btn sm" data-action="web-shuffle">Rearrange</button>
        </div>
        <svg id="web-svg" xmlns="http://www.w3.org/2000/svg" aria-label="Relationship chart"></svg>
      </section>`;
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
      const r = 120 + g.people.length * 12;
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
          const f = (16000 / d2) * alpha;
          const d = Math.sqrt(d2);
          dx /= d; dy /= d;
          a.vx -= dx * f; a.vy -= dy * f; b.vx += dx * f; b.vy += dy * f;
        }
      }
      for (const l of links) {
        const dx = l.t.x - l.s.x, dy = l.t.y - l.s.y;
        const d = Math.sqrt(dx * dx + dy * dy) || 1;
        const want = l.me ? 240 : 170;
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
    const padding = 100;
    const vb = { x: Math.min(...xs) - padding, y: Math.min(...ys) - padding, w: Math.max(...xs) - Math.min(...xs) + padding * 2, h: Math.max(...ys) - Math.min(...ys) + padding * 2 };
    const rect = svg.getBoundingClientRect();
    const aspect = rect.width / Math.max(1, rect.height);
    if (vb.w / vb.h < aspect) { const nw = vb.h * aspect; vb.x -= (nw - vb.w) / 2; vb.w = nw; }
    else { const nh = vb.w / aspect; vb.y -= (nh - vb.h) / 2; vb.h = nh; }
    const setVB = () => svg.setAttribute("viewBox", `${vb.x} ${vb.y} ${vb.w} ${vb.h}`);
    setVB();

    const defs = document.createElementNS(NS, "defs");
    defs.innerHTML = Object.entries(REL_GROUPS).map(([k, gr]) =>
      `<marker id="arrow-${k}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 Z" fill="${gr.color}"/></marker>`).join("");
    const edgeLayer = document.createElementNS(NS, "g");
    const labelLayer = document.createElementNS(NS, "g");
    const nodeLayer = document.createElementNS(NS, "g");
    svg.replaceChildren(defs, edgeLayer, labelLayer, nodeLayer);

    const edgeEls = links.map((l) => {
      const line = document.createElementNS(NS, "line");
      let lab = null;
      if (l.me) {
        line.setAttribute("stroke", (CIRCLES[l.t.circle] || CIRCLES.other).color);
        line.setAttribute("stroke-width", "1");
        line.setAttribute("stroke-dasharray", "3 4");
        line.setAttribute("opacity", ".45");
      } else {
        const rk = REL[l.rel.kind] || REL.friend;
        const grp = REL_GROUPS[rk.group];
        line.setAttribute("stroke", grp.color);
        line.setAttribute("stroke-width", "1.8");
        line.setAttribute("marker-end", `url(#arrow-${rk.group})`);
        if (rk.inv === l.rel.kind) line.setAttribute("marker-start", `url(#arrow-${rk.group})`);
        lab = document.createElementNS(NS, "g");
        const w = rk.label.length * 6.6 + 16;
        lab.innerHTML = `<title>${esc(dname(l.s))} is ${esc(dname(l.t))}'s ${esc(rk.label)}</title><rect class="edge-pill" x="${-w / 2}" y="-10" width="${w}" height="20" stroke="${grp.color}"/><text class="edge-label" text-anchor="middle" y="4">${esc(rk.label)}</text>`;
        labelLayer.appendChild(lab);
      }
      edgeLayer.appendChild(line);
      return { line, lab, l };
    });

    const nodeEls = all.map((n) => {
      const el = document.createElementNS(NS, "g");
      el.setAttribute("class", "node");
      if (n.id === "me") {
        el.innerHTML = `<rect x="-30" y="-30" width="60" height="60" fill="#b7282e"/><rect x="-26" y="-26" width="52" height="52" fill="none" stroke="#fff" stroke-width="1.5"/>
          <text text-anchor="middle" y="7" style="font-size:20px;fill:#fff;font-family:var(--serif)">自分</text>`;
      } else {
        const col = (CIRCLES[n.circle] || CIRCLES.other).color;
        const nm = dname(n);
        const w = Math.max(64, nm.length * 7.6 + 16);
        el.innerHTML = `<rect x="-33" y="-33" width="66" height="66" fill="var(--paper)" stroke="${col}" stroke-width="2"/>
          <g transform="translate(-30 -30)">${Avatar.render(parseAv(n.avatar), n.id + ":" + n.name, { size: 60 })}</g>
          <rect class="name-box" x="${-w / 2}" y="37" width="${w}" height="20"/>
          <text class="node-name" text-anchor="middle" y="51">${esc(nm)}${n.favorite ? " ★" : ""}</text>`;
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
        // stop lines at the square frames so arrowheads stay visible
        const inset = Math.min(38 / Math.max(Math.abs(ux), Math.abs(uy), 0.01), d / 2 - 2);
        const s0 = l.me ? 0 : inset;
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

  // ---------- Calendar ----------
  async function viewCalendar() {
    const events = await api("GET", "/api/upcoming?days=366");
    const months = new Map();
    events.forEach((e) => {
      const d = toDate(e.date);
      const key = `${d.getFullYear()}.${pad(d.getMonth() + 1)}`;
      if (!months.has(key)) months.set(key, { label: d.toLocaleDateString("en", { month: "long", year: "numeric" }), list: [] });
      months.get(key).list.push(e);
    });
    const html = Array.from(months.entries()).map(([key, m]) => `
      <section class="panel">${sec(esc(m.label), `${key.slice(0, 4)}年${+key.slice(5)}月`, `<span class="count">${m.list.length}</span>`)}
        <ul class="list">${m.list.map((e) => `
          <li><a class="item" href="#/person/${e.person_id}">${dblock(e.date, e.days)}${eventTag(e)}
            ${avatar({ id: e.person_id, name: e.person_name, avatar: e.avatar }, "xs")}
            <div class="body"><div class="title">${eventTitle(e)}</div><div class="meta">${until(e.days)}${e.notes ? " ・ " + esc(e.notes) : ""}</div></div></a></li>`).join("")}
        </ul></section>`).join("");
    app().innerHTML = `
      ${crumbs("Dates")}
      ${pageTitle("Dates", "暦 ・ 今後一年")}
      <div class="stack">${html || `<div class="panel">${empty("No dates yet. Add birthdays and other dates on each person's page.")}</div>`}</div>`;
  }

  // ---------- Search ----------
  async function viewSearch(q) {
    const r = await api("GET", `/api/search?q=${encodeURIComponent(q)}`);
    $("#search-input").value = q;
    const rx = new RegExp(esc(q).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
    const hl = (s) => esc(s).replace(rx, (m) => `<mark>${m}</mark>`);
    const people = r.people.map((p) => `<li><a class="item" href="#/person/${p.id}">${avatar(p, "sm")}<div class="body"><div class="title">${hl(p.name)}</div><div class="meta">${hl(p.nickname)}</div></div></a></li>`).join("");
    const mems = r.memories.map((m) => `<li><a class="item" href="#/person/${m.person_id}">${kindTag(m.kind)}<div class="body"><div class="title">${hl(m.text)}</div><div class="meta">${esc(m.nickname || m.name)}${m.detail ? " ・ " + hl(m.detail) : ""}</div></div></a></li>`).join("");
    const chats = r.interactions.map((i) => `<li><a class="item" href="#/person/${i.person_id}"><span class="date">${fmtDate(i.date)}</span><div class="body"><div class="title">${hl(i.topics)}</div><div class="meta">${esc(i.nickname || i.name)}${i.follow_up ? " ・ next time: " + hl(i.follow_up) : ""}</div></div></a></li>`).join("");
    const total = r.people.length + r.memories.length + r.interactions.length;
    app().innerHTML = `
      ${crumbs("Search")}
      ${pageTitle(`“${esc(q)}”`, "検索結果", `<span class="muted">${total} result${total === 1 ? "" : "s"}</span>`)}
      ${!total ? `<div class="panel">${empty("No matches. Try a different word.")}</div>` : `
      <div class="stack">
        ${people ? `<section class="panel">${sec("People", "人々")}<ul class="list">${people}</ul></section>` : ""}
        ${mems ? `<section class="panel">${sec("Notes", "覚え書き")}<ul class="list">${mems}</ul></section>` : ""}
        ${chats ? `<section class="panel">${sec("Conversations", "会話")}<ul class="list">${chats}</ul></section>` : ""}
      </div>`}`;
  }

  // ---------- Settings ----------
  async function viewSettings() {
    let theme = "auto";
    try { theme = localStorage.getItem("mannele.theme") || "auto"; } catch (_) { /* ignore */ }
    app().innerHTML = `
      ${crumbs("Settings")}
      ${pageTitle("Settings", "設定")}
      <table class="settings-table">
        <tr><th>Appearance<small>表示</small></th><td>
          <div class="segmented" id="theme">
            <button data-v="auto">Follow device</button><button data-v="light">Light</button><button data-v="dark">Dark</button>
          </div></td></tr>
        <tr><th>Backup<small>バックアップ</small></th><td>
          <p>All data is stored in a single SQLite file on your machine. Download a backup from time to time.</p>
          <div class="btns">
            <button class="btn navy" data-action="export">Download backup (JSON)</button>
            <label class="btn" style="cursor:pointer">Restore from file…<input type="file" id="import-file" accept="application/json,.json" hidden></label>
          </div>
          <label class="check" style="margin-top:10px"><input type="checkbox" id="import-replace"> Replace all current data when restoring (otherwise merge)</label>
        </td></tr>
        <tr><th>Example data<small>サンプル</small></th><td>
          <p>Add a few example people to try things out.</p>
          <button class="btn" data-action="seed-demo">Load example people</button>
        </td></tr>
        <tr id="session-row" hidden><th>Session<small>ログイン</small></th><td>
          <p>This notebook is password-protected.</p>
          <button class="btn" data-action="logout">Log out</button>
        </td></tr>
      </table>`;
    const seg = $("#theme");
    const mark = (v) => $$("button", seg).forEach((b) => b.classList.toggle("on", b.dataset.v === v));
    mark(theme);
    seg.addEventListener("click", (e) => {
      const b = e.target.closest("button");
      if (!b) return;
      try { localStorage.setItem("mannele.theme", b.dataset.v); } catch (_) { /* ignore */ }
      mark(b.dataset.v);
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
  function setChrome(on) {
    $("#topbar").hidden = !on;
    $("#footer").hidden = !on;
  }
  function viewLogin() {
    setChrome(false);
    app().innerHTML = `
      <div class="center-box">
        <span class="hanko">縁</span>
        <h1>Mannele <span class="muted" style="font-size:13px;font-weight:400">ログイン</span></h1>
        <p>Enter the password to open the notebook.</p>
        <form data-form="login">
          <input type="password" name="password" placeholder="Password" aria-label="Password" autofocus required autocomplete="current-password">
          <button class="btn primary" type="submit">Log in</button>
        </form>
      </div>`;
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
    const circles = Object.entries(CIRCLES).map(([k, c]) => `<option value="${k}">${c.label}（${c.jp}）</option>`).join("");
    const freq = [[0, "No reminder"], [7, "Every week"], [14, "Every two weeks"], [30, "Every month"], [60, "Every two months"], [90, "Every three months"], [180, "Twice a year"], [365, "Once a year"]];
    const curFreq = p.checkin_days ?? 30;
    if (!freq.some(([v]) => v === curFreq)) freq.push([curFreq, `Every ${curFreq} days`]);

    openModal(`
      ${modalHead(p.id ? `Edit ${esc(dname(p))}` : "Add a person", p.id ? "編集" : "新規登録")}
      <p class="lead">${p.id ? "Update the profile details." : "Only the name is required. You can fill in the rest later."}</p>
      <form data-form="person" data-id="${p.id || ""}">
        <div class="maker">
          <div class="preview"><span class="av lg" id="av-preview"></span>
            <button type="button" class="btn sm" data-action="av-random">Randomise</button></div>
          <div class="opts" id="av-opts"></div>
        </div>
        <input type="hidden" name="avatar">
        <div class="row2">
          <div class="field"><label for="f-name">Name<span class="req">Required</span></label><input id="f-name" type="text" name="name" required maxlength="120" value="${esc(p.name)}" autofocus></div>
          <div class="field"><label for="f-nick">Nickname</label><input id="f-nick" type="text" name="nickname" maxlength="120" value="${esc(p.nickname)}" placeholder="What you call them"></div>
        </div>
        <div class="row3">
          <div class="field"><label for="f-pron">Pronouns</label><input id="f-pron" type="text" name="pronouns" maxlength="40" value="${esc(p.pronouns)}" list="pronoun-list">
            <datalist id="pronoun-list"><option value="she/her"><option value="he/him"><option value="they/them"><option value="she/they"><option value="he/they"></datalist></div>
          <div class="field"><label for="f-circle">Group</label><select id="f-circle" name="circle">${circles}</select></div>
          <div class="field"><label for="f-freq">Check-in reminder</label><select id="f-freq" name="checkin_days">${freq.map(([v, l]) => `<option value="${v}">${l}</option>`).join("")}</select></div>
        </div>
        <div class="row2">
          <div class="field"><label for="f-bday">Birthday</label><input id="f-bday" type="date" name="birthday" value="${esc(birthday)}"></div>
          <div class="field"><span class="label">&nbsp;</span><label class="check"><input type="checkbox" name="unknown_year" ${unknownYear ? "checked" : ""}> Year unknown</label></div>
        </div>
        <div class="field"><label for="f-met">How you met</label><input id="f-met" type="text" name="how_met" maxlength="2000" value="${esc(p.how_met)}"></div>
        <div class="field"><label for="f-notes">Notes</label><textarea id="f-notes" name="notes" maxlength="10000">${esc(p.notes)}</textarea></div>
        <label class="check"><input type="checkbox" name="favorite" ${p.favorite ? "checked" : ""}> Mark as favourite ★</label>
        ${modalActions(p.id ? "Save" : "Register")}
      </form>`, { wide: true });
    $("#f-circle").value = p.circle || "friends";
    $("#f-freq").value = String(curFreq);
    setupMaker(av);
  }

  function setupMaker(av) {
    const O = Avatar.OPTIONS, L = Avatar.LABELS;
    const swatches = (key, colors) => colors.map((c) =>
      `<button type="button" class="swatch ${av[key] === c ? "on" : ""}" style="background:${c}" data-action="av-set" data-k="${key}" data-v="${c}" aria-label="${key} ${c}"></button>`).join("");
    const select = (key, label) => `<label class="opt-row"><span>${label}</span><select data-av="${key}">${O[key].map((v) => `<option value="${v}" ${av[key] === v ? "selected" : ""}>${L[key][v]}</option>`).join("")}</select></label>`;
    const paint = () => {
      $("#av-preview").innerHTML = Avatar.render(av, "x");
      $("input[name=avatar]").value = JSON.stringify(av);
      $("#av-opts").innerHTML = `
        <div class="opt-row"><span>Hair</span>${swatches("hair", O.hair)}</div>
        <div class="opt-row"><span>Skin</span>${swatches("skin", O.skin)}</div>
        <div class="opt-row"><span>Eyes</span>${swatches("eye", O.eye)}</div>
        <div class="opt-row"><span>Background</span>${swatches("bg", O.bg)}</div>
        <div class="opt-row" style="gap:12px">${select("style", "Hairstyle")}${select("eyes", "Expression")}</div>
        <div class="opt-row" style="gap:12px">${select("mouth", "Mouth")}${select("acc", "Accessory")}</div>`;
      $$("#av-opts select").forEach((s) => s.addEventListener("change", () => { av[s.dataset.av] = s.value; paint(); }));
    };
    actions["av-set"] = (el) => { av[el.dataset.k] = el.dataset.v; paint(); };
    actions["av-random"] = () => { Object.assign(av, Avatar.randomFor(Math.random())); paint(); };
    paint();
  }

  function memoryForm(m, personId) {
    m = m || { kind: "note", status: "open" };
    const statuses = { open: "Open / current", resolved: "Resolved", given: "Given", archived: "Archived" };
    openModal(`
      ${modalHead(m.id ? "Edit note" : "Add a note", "覚え書き")}
      <form data-form="memory" data-id="${m.id || ""}" data-person="${personId || ""}" style="margin-top:16px">
        <div class="field"><label for="m-kind">Category</label>
          <select id="m-kind" name="kind">${KIND_ORDER.map((k) => `<option value="${k}">${MEMORY_KINDS[k].label}（${MEMORY_KINDS[k].jp}） — ${MEMORY_KINDS[k].hint}</option>`).join("")}</select></div>
        <div class="field"><label for="m-text">Note<span class="req">Required</span></label><input id="m-text" type="text" name="text" required maxlength="1000" value="${esc(m.text)}" autofocus></div>
        <div class="field"><label for="m-detail">Details</label><textarea id="m-detail" name="detail" maxlength="5000" placeholder="Context, links, sizes…">${esc(m.detail)}</textarea></div>
        <div class="field"><label for="m-status">Status</label><select id="m-status" name="status">${Object.entries(statuses).map(([k, v]) => `<option value="${k}">${v}</option>`).join("")}</select></div>
        <label class="check"><input type="checkbox" name="pinned" ${m.pinned ? "checked" : ""}> Pin to top</label>
        ${modalActions()}
      </form>`);
    $("#m-kind").value = m.kind;
    $("#m-status").value = m.status;
  }

  function chatForm(i, personId, people) {
    i = i || { date: state.today, mode: "chat", mood: "" };
    const personPicker = people ? `
      <div class="field"><label for="c-person">Person<span class="req">Required</span></label>
        <select id="c-person" name="person_id" required>${people.map((p) => `<option value="${p.id}">${esc(p.name)}</option>`).join("")}</select></div>` : "";
    openModal(`
      ${modalHead(i.id ? "Edit conversation" : "Log a conversation", "会話の記録")}
      <p class="lead">Write down what you talked about so you remember next time.</p>
      <form data-form="chat" data-id="${i.id || ""}" data-person="${personId || ""}">
        ${personPicker}
        <div class="row2">
          <div class="field"><label for="c-date">Date<span class="req">Required</span></label><input id="c-date" type="date" name="date" value="${esc(i.date)}" required></div>
          <div class="field"><label for="c-mode">Type</label><select id="c-mode" name="mode">${Object.entries(MODES).map(([k, v]) => `<option value="${k}">${v}</option>`).join("")}</select></div>
        </div>
        <div class="field"><span class="label">How they seemed</span>
          <div class="segmented">${MOODS.map((mo) => `<button type="button" class="${i.mood === mo ? "on" : ""}" data-action="pick-mood" data-v="${mo}">${mo}</button>`).join("")}</div>
          <input type="hidden" name="mood" value="${esc(i.mood)}"></div>
        <div class="field"><label for="c-topics">Topics</label><textarea id="c-topics" name="topics" maxlength="5000" placeholder="New job, the cat's vet visit, plans for the holidays…" autofocus>${esc(i.topics)}</textarea></div>
        <div class="field"><label for="c-follow">Ask about next time</label><input id="c-follow" type="text" name="follow_up" maxlength="2000" value="${esc(i.follow_up)}" placeholder="How the interview went"></div>
        ${modalActions()}
      </form>`);
    $("#c-mode").value = i.mode || "chat";
    if (personId && $("#c-person")) $("#c-person").value = personId;
  }

  function dateForm(d, personId) {
    d = d || { yearly: 1 };
    openModal(`
      ${modalHead(d.id ? "Edit date" : "Add a date", "記念日")}
      <p class="lead">Anniversaries, exams, operations, trips, first days at work…</p>
      <form data-form="date" data-id="${d.id || ""}" data-person="${personId || ""}">
        <div class="field"><label for="d-label">Title<span class="req">Required</span></label><input id="d-label" type="text" name="label" required maxlength="200" value="${esc(d.label)}" placeholder="Wedding anniversary" autofocus></div>
        <div class="row2">
          <div class="field"><label for="d-date">Date<span class="req">Required</span></label><input id="d-date" type="date" name="date" required value="${esc(String(d.date || "").startsWith("--") ? "2000" + d.date.slice(1) : d.date)}"></div>
          <div class="field"><span class="label">&nbsp;</span><label class="check"><input type="checkbox" name="yearly" ${d.yearly ? "checked" : ""}> Repeats every year</label></div>
        </div>
        <div class="field"><label for="d-notes">Notes</label><input id="d-notes" type="text" name="notes" maxlength="2000" value="${esc(d.notes)}"></div>
        ${modalActions()}
      </form>`);
  }

  async function relForm(personId, rel) {
    const everyone = await getPeople();
    const people = everyone.filter((p) => p.id !== personId);
    const me = everyone.find((p) => p.id === personId);
    if (!people.length) return toast("Add another person first.");
    let otherId = "", kind = "friend";
    if (rel) {
      const role = relRole(rel, personId);
      otherId = role.otherId; kind = role.kind;
    }
    const kinds = Object.entries(REL).map(([k, v]) => `<option value="${k}">${esc(v.label)}</option>`).join("");
    openModal(`
      ${modalHead(rel ? "Edit connection" : "Add a connection", "相関")}
      <p class="lead">Who is connected to ${esc(dname(me))}?</p>
      <form data-form="rel" data-id="${rel ? rel.id : ""}" data-person="${personId}">
        <div class="row2">
          <div class="field"><label for="r-other">Person</label>
            <select id="r-other" name="other" required>${people.map((p) => `<option value="${p.id}">${esc(p.name)}${p.nickname ? ` (${esc(p.nickname)})` : ""}</option>`).join("")}</select></div>
          <div class="field"><label for="r-kind">is ${esc(dname(me))}'s…</label><select id="r-kind" name="kind">${kinds}</select></div>
        </div>
        <div class="field"><label for="r-notes">Notes</label><input id="r-notes" type="text" name="notes" maxlength="2000" value="${esc(rel ? rel.notes : "")}"></div>
        ${modalActions()}
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
    openModal(`
      ${modalHead("Jot down", "メモ")}
      <p class="lead">A quick note before you forget.</p>
      <form data-form="jot">
        <div class="row2">
          <div class="field"><label for="j-person">Person</label><select id="j-person" name="person_id">${opts}</select></div>
          <div class="field"><label for="j-kind">Category</label><select id="j-kind" name="kind">
            <option value="__chat">Conversation (today)</option>
            ${KIND_ORDER.map((k) => `<option value="${k}">${MEMORY_KINDS[k].label}（${MEMORY_KINDS[k].jp}）</option>`).join("")}
          </select></div>
        </div>
        <div class="field"><label for="j-text">Note<span class="req">Required</span></label><textarea id="j-text" name="text" required maxlength="1000" autofocus placeholder="Training for a half-marathon in the spring"></textarea></div>
        ${modalActions()}
      </form>`);
    if (cur) $("#j-person").value = cur;
    $("#j-kind").value = "interest";
  }

  const formValues = (form) => {
    const out = {};
    new FormData(form).forEach((v, k) => { out[k] = typeof v === "string" ? v.trim() : v; });
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
      const sel = $(".quick-add select");
      if (sel) sel.value = kind;
      const inp = $(".quick-add input[name=text]");
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
    "pick-mood": (el) => {
      const input = $("input[name=mood]");
      const on = !el.classList.contains("on");
      $$("[data-action=pick-mood]").forEach((b) => b.classList.remove("on"));
      if (on) el.classList.add("on");
      input.value = on ? el.dataset.v : "";
    },
    "new-date": (el) => dateForm(null, +el.dataset.person),
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
    if (!typing && $("#modal").hidden && !$("#topbar").hidden) {
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
    $$("#nav a").forEach((a) => a.classList.toggle("active", a.dataset.nav === (section || "home") || (section === "person" && a.dataset.nav === "people")));
    if (!keepScroll) loading();
    try {
      switch (section) {
        case "": case undefined: await viewHome(); break;
        case "people": await viewPeople(); break;
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
      app().innerHTML = `<div class="panel">${empty(err.message || "Couldn't load this page.")}<a class="btn arrow" href="#/">Back to home</a></div>`;
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
    if (d) $("#today-label").textContent = `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日（${WD_JP[d.getDay()]}）`;
  }

  async function boot() {
    try {
      const meta = await api("GET", "/api/meta");
      state.today = meta.today;
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
