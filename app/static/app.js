/* ✿ Mannele — little memory garden ✿ */
(function () {
  "use strict";

  // ------------------------------------------------------------------
  // tiny helpers
  // ------------------------------------------------------------------
  const $ = (sel, el = document) => el.querySelector(sel);
  const $$ = (sel, el = document) => Array.from(el.querySelectorAll(sel));
  const ESC = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ESC[c]);
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

  const KAO = {
    happy: ["(◕‿◕✿)", "(｡♥‿♥｡)", "ヾ(＾∇＾)", "(✿◠‿◠)", "(*^▽^*)", "(〃＾▽＾〃)", "٩(◕‿◕｡)۶"],
    sad: ["(｡•́︿•̀｡)", "( ; ω ; )", "(╥﹏╥)", "(っ˘̩╭╮˘̩)っ"],
    sleepy: ["(－_－) zzZ", "(￣o￣) zzZZ", "(-.-)Zzz"],
    love: ["(づ｡◕‿‿◕｡)づ", "♡(˘▽˘>ԅ( ˘⌣˘)", "(っ´▽`)っ♡", "(´｡• ᵕ •｡`) ♡"],
    think: ["(・・ ) ?", "(￢‿￢ )", "( ˘･з･)"],
  };

  const MEMORY_KINDS = {
    problem: { icon: "🌧️", label: "Going through", one: "Something they're going through", hint: "Ongoing worries, struggles, things to check in about" },
    interest: { icon: "🌟", label: "Interests", one: "Interest", hint: "Hobbies, obsessions, current rabbit holes" },
    like: { icon: "💖", label: "Loves", one: "Something they love", hint: "Favourite foods, colours, comfort things" },
    dislike: { icon: "🙅", label: "Not a fan", one: "Something they dislike", hint: "Allergies, pet peeves, no-gos" },
    gift: { icon: "🎁", label: "Gift ideas", one: "Gift idea", hint: "Things they mentioned wanting" },
    goal: { icon: "🌱", label: "Dreams & goals", one: "Dream or goal", hint: "What they're working towards" },
    note: { icon: "📝", label: "Little notes", one: "Note", hint: "Everything else worth remembering" },
  };
  const KIND_ORDER = ["problem", "interest", "like", "gift", "goal", "dislike", "note"];

  const MODES = {
    chat: { icon: "☕", label: "Chat" }, meet: { icon: "🌸", label: "Hung out" },
    call: { icon: "📞", label: "Call" }, video: { icon: "📹", label: "Video call" },
    text: { icon: "💬", label: "Texts" }, letter: { icon: "💌", label: "Letter" },
    event: { icon: "🎉", label: "Event" },
  };
  const MOODS = ["🥰", "😊", "✨", "😂", "😐", "🥺", "😢", "😤", "😴"];

  const CIRCLES = {
    family: { icon: "🏡", label: "Family", chip: "peach", color: "#ffb98a" },
    partner: { icon: "💞", label: "Partner", chip: "pink", color: "#ff8fb8" },
    friends: { icon: "🌼", label: "Friends", chip: "mint", color: "#74d6bb" },
    work: { icon: "💼", label: "Work", chip: "sky", color: "#8cc8ff" },
    community: { icon: "🏮", label: "Community", chip: "lemon", color: "#ffd96a" },
    other: { icon: "✨", label: "Other", chip: "", color: "#b9a4ff" },
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
    pet: { label: "pet 🐾", inv: "owner", group: "pet" },
    owner: { label: "hooman 🐾", inv: "pet", group: "pet" },
  };
  const REL_GROUPS = {
    love: { label: "Love", color: "#ff7fae" },
    family: { label: "Family", color: "#ffa66b" },
    friend: { label: "Friends", color: "#4fc9a7" },
    work: { label: "Work & school", color: "#8f7bff" },
    pet: { label: "Pets", color: "#e8b72f" },
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
    if (method !== "GET") state.people = null; // invalidate cache
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
  const avatar = (p, size = "sm", seedName) =>
    `<span class="av ${size}">${Avatar.render(parseAv(p.avatar), (p.id || "") + ":" + (seedName || p.name || p.nickname || ""), { title: dname(p) })}</span>`;

  function toDate(iso) {
    const m = /^(\d{4}-|--)(\d{2})-(\d{2})/.exec(iso || "");
    if (!m) return null;
    return new Date(m[1] === "--" ? 2000 : +m[1].slice(0, 4), +m[2] - 1, +m[3]);
  }
  function fmtDate(iso, withYear) {
    const d = toDate(iso);
    if (!d) return "";
    const noYear = String(iso).startsWith("--");
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric", ...(withYear && !noYear ? { year: "numeric" } : {}) });
  }
  function daysSince(iso) {
    const a = toDate(iso), b = toDate(state.today);
    return a && b ? Math.round((b - a) / 86400000) : null;
  }
  function ago(days) {
    if (days == null) return "never logged";
    if (days < 0) return `in ${-days} day${days === -1 ? "" : "s"}`;
    if (days === 0) return "today";
    if (days === 1) return "yesterday";
    if (days < 14) return `${days} days ago`;
    if (days < 60) return `${Math.round(days / 7)} weeks ago`;
    if (days < 365) return `${Math.round(days / 30)} months ago`;
    const y = Math.round(days / 365);
    return `${y} year${y > 1 ? "s" : ""} ago`;
  }
  function until(days) {
    if (days === 0) return "today! ✨";
    if (days === 1) return "tomorrow";
    if (days < 14) return `in ${days} days`;
    if (days < 60) return `in ${Math.round(days / 7)} weeks`;
    return `in ${Math.round(days / 30)} months`;
  }
  function bubble(iso, days) {
    const d = toDate(iso);
    const cls = days === 0 ? "today" : days <= 7 ? "soon" : "";
    return `<span class="bubble ${cls}"><small>${d ? d.toLocaleDateString(undefined, { month: "short" }) : ""}</small>${d ? d.getDate() : "?"}</span>`;
  }
  const ordinal = (n) => n + (["th", "st", "nd", "rd"][(n % 100 - 20) % 10] || ["th", "st", "nd", "rd"][n % 100] || "th");

  function eventLabel(e) {
    if (e.type === "birthday") return `🎂 ${esc(e.person_name)}'s birthday${e.years ? ` <span class="muted">(turning ${e.years})</span>` : ""}`;
    return `🗓️ ${esc(e.label)} <span class="muted">· ${esc(e.person_name)}${e.years ? ` · ${ordinal(e.years)}` : ""}</span>`;
  }

  function relRole(rel, viewerId) {
    // Returns {other, kind} where `kind` describes the other person relative to the viewer.
    // Stored meaning: a is <kind> of b.
    if (rel.b_id === viewerId) return { otherId: rel.a_id, name: rel.a_nickname || rel.a_name, avatar: rel.a_avatar, oname: rel.a_name, kind: rel.kind };
    return { otherId: rel.b_id, name: rel.b_nickname || rel.b_name, avatar: rel.b_avatar, oname: rel.b_name, kind: (REL[rel.kind] || REL.friend).inv };
  }

  const empty = (text, mood = "happy") => `<div class="empty"><span class="kao">${esc(pick(KAO[mood]))}</span>${esc(text)}</div>`;

  // ------------------------------------------------------------------
  // toasts, modal, confirm
  // ------------------------------------------------------------------
  function toast(msg, isErr) {
    const el = document.createElement("div");
    el.className = "toast" + (isErr ? " err" : "");
    el.textContent = msg;
    $("#toasts").appendChild(el);
    setTimeout(() => el.remove(), 2800);
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

  function confirmBox(title, text, okLabel = "Yes, do it") {
    return new Promise((resolve) => {
      let answered = false;
      openModal(`
        <h2 id="modal-title">${esc(title)}</h2>
        <p class="lead">${esc(text)}</p>
        <div class="modal-actions">
          <button class="btn soft" data-action="confirm-no">Never mind</button>
          <button class="btn danger" data-action="confirm-yes" autofocus>${esc(okLabel)}</button>
        </div>`, { onClose: () => { if (!answered) resolve(false); } });
      actions["confirm-yes"] = () => { answered = true; closeModal(); resolve(true); };
      actions["confirm-no"] = () => { answered = true; closeModal(); resolve(false); };
    });
  }

  // ------------------------------------------------------------------
  // views
  // ------------------------------------------------------------------
  const app = () => $("#app");
  const loading = () => { app().innerHTML = `<div class="loading"><span>✿</span> loading memories <span>✿</span></div>`; };

  function greeting() {
    const h = new Date().getHours();
    if (h < 5) return ["Still awake?", pick(KAO.sleepy)];
    if (h < 11) return ["Good morning", "☀️ " + pick(KAO.happy)];
    if (h < 17) return ["Good afternoon", pick(KAO.happy)];
    if (h < 22) return ["Good evening", "🌙 " + pick(KAO.happy)];
    return ["Cozy night", pick(KAO.sleepy)];
  }

  // ---------- Home ----------
  async function viewHome() {
    const d = await api("GET", "/api/dashboard");
    const [hello, kao] = greeting();

    if (!d.counts.people) {
      app().innerHTML = `
        <div class="card tape login" style="max-width:560px">
          <div class="mascot">${Avatar.render({ hair: "#f4a7c4", style: "twintails", eyes: "sparkle", acc: "bow", bg: "#ffe9f3", mouth: "open", skin: "#ffe7d6" }, "mascot")}</div>
          <h1>Welcome to your memory garden!</h1>
          <p>Mannele quietly remembers the little things people tell you — their interests, worries, big days and gift wishes — so you can show up for them. Everything stays on your own machine. ${esc(pick(KAO.love))}</p>
          <div class="modal-actions" style="justify-content:center">
            <button class="btn" data-action="new-person">🌱 Add your first person</button>
            <button class="btn soft" data-action="seed-demo">🌸 Plant demo friends</button>
          </div>
        </div>`;
      return;
    }

    const upcoming = d.upcoming.slice(0, 8).map((e) => `
      <li><a class="row" href="#/person/${e.person_id}">${bubble(e.date, e.days)}
        <div class="grow"><div class="title">${eventLabel(e)}</div><div class="meta">${until(e.days)}</div></div>
        ${avatar({ id: e.person_id, name: e.person_name, avatar: e.avatar }, "xs")}</a></li>`).join("");

    const problems = d.open_problems.map((m) => `
      <li><a class="row" href="#/person/${m.person_id}">${avatar({ id: m.person_id, name: m.name, nickname: m.nickname, avatar: m.avatar }, "sm")}
        <div class="grow"><div class="title">${esc(m.text)}</div><div class="meta">${esc(m.nickname || m.name)} · noted ${ago(daysSince(m.created_at))}</div></div></a></li>`).join("");

    const followups = d.follow_ups.map((i) => `
      <li><a class="row" href="#/person/${i.person_id}">${avatar({ id: i.person_id, name: i.name, nickname: i.nickname, avatar: i.avatar }, "sm")}
        <div class="grow"><div class="title">${esc(i.follow_up)}</div><div class="meta">${esc(i.nickname || i.name)} · from your ${esc((MODES[i.mode] || MODES.chat).label.toLowerCase())} ${ago(daysSince(i.date))}</div></div></a></li>`).join("");

    const overdue = d.overdue.map((p) => `
      <li><div class="row">${avatar(p, "sm")}
        <a class="grow" href="#/person/${p.id}" style="color:inherit"><div class="title">${esc(dname(p))}</div>
        <div class="meta">${p.days_since_contact == null ? "no chats logged yet" : "last talked " + ago(p.days_since_contact)}</div></a>
        <button class="btn sm soft" data-action="log-chat" data-person="${p.id}">☕ Log chat</button></div></li>`).join("");

    const gifts = d.gift_ideas.map((m) => `
      <li><a class="row" href="#/person/${m.person_id}"><span style="font-size:22px">🎁</span>
        <div class="grow"><div class="title">${esc(m.text)}</div><div class="meta">for ${esc(m.nickname || m.name)}</div></div></a></li>`).join("");

    const recent = d.recent.map((i) => `
      <li><a class="row" href="#/person/${i.person_id}">${avatar({ id: i.person_id, name: i.name, nickname: i.nickname, avatar: i.avatar }, "sm")}
        <div class="grow"><div class="title">${esc(i.topics || (MODES[i.mode] || MODES.chat).label)}</div>
        <div class="meta">${(MODES[i.mode] || MODES.chat).icon} ${esc(i.nickname || i.name)} · ${ago(daysSince(i.date))} ${esc(i.mood)}</div></div></a></li>`).join("");

    app().innerHTML = `
      <div class="page-head">
        <div><h1>${hello}! <span class="kao">${esc(kao)}</span></h1>
        <p class="subtitle">Here's who might love to hear from you.</p></div>
      </div>
      <div class="stats">
        <div class="stat"><span class="ico">🌸</span><b>${d.counts.people}</b><span>people</span></div>
        <div class="stat"><span class="ico">💭</span><b>${d.counts.memories}</b><span>memories</span></div>
        <div class="stat"><span class="ico">☕</span><b>${d.counts.interactions}</b><span>chats</span></div>
        <div class="stat"><span class="ico">🕸️</span><b>${d.counts.relationships}</b><span>connections</span></div>
      </div>
      <div class="grid dash">
        <section class="card tape"><h2>🗓️ Coming up <span class="count">${d.upcoming.length}</span>
          <a class="card-action btn ghost sm" href="#/calendar">all →</a></h2>
          ${upcoming ? `<ul class="rows">${upcoming}</ul>` : empty("No special days in the next few weeks.")}</section>
        <section class="card"><h2>🌧️ Check in on <span class="count">${d.open_problems.length}</span></h2>
          ${problems ? `<ul class="rows">${problems}</ul>` : empty("Nobody's going through anything you know of. Yay!")}</section>
        <section class="card"><h2>🔔 Remember to…</h2>
          ${followups ? `<ul class="rows">${followups}</ul>` : empty("No pending follow-ups.")}</section>
        <section class="card"><h2>💌 Missing you <span class="count">${d.overdue.length}</span></h2>
          ${overdue ? `<ul class="rows">${overdue}</ul>` : empty("You're all caught up with everyone!", "love")}</section>
        <section class="card"><h2>🎁 Gift idea jar
          <button class="card-action btn ghost sm" data-action="refresh">shake 🫙</button></h2>
          ${gifts ? `<ul class="rows">${gifts}</ul>` : empty("No gift ideas saved yet.", "think")}</section>
        <section class="card"><h2>☕ Recent chats</h2>
          ${recent ? `<ul class="rows">${recent}</ul>` : empty("Log a chat to start remembering what you talked about.")}</section>
      </div>`;
  }

  // ---------- People ----------
  async function viewPeople() {
    const people = await getPeople(true);
    const counts = {};
    people.forEach((p) => { counts[p.circle] = (counts[p.circle] || 0) + 1; });
    let list = people.filter((p) => state.peopleFilter === "all" || p.circle === state.peopleFilter);
    const sorters = {
      name: (a, b) => b.favorite - a.favorite || dname(a).localeCompare(dname(b)),
      contact: (a, b) => (b.days_since_contact ?? 1e9) - (a.days_since_contact ?? 1e9),
      birthday: (a, b) => (a.next_birthday_days ?? 1e9) - (b.next_birthday_days ?? 1e9),
      recent: (a, b) => String(b.created_at).localeCompare(String(a.created_at)),
    };
    list = list.slice().sort(sorters[state.peopleSort] || sorters.name);

    const chips = [`<button class="chip ${state.peopleFilter === "all" ? "on" : ""}" data-action="filter-circle" data-v="all">💫 Everyone (${people.length})</button>`]
      .concat(Object.entries(CIRCLES).filter(([k]) => counts[k]).map(([k, c]) =>
        `<button class="chip ${state.peopleFilter === k ? "on" : ""}" data-action="filter-circle" data-v="${k}">${c.icon} ${c.label} (${counts[k]})</button>`)).join("");

    const cards = list.map((p) => {
      const c = CIRCLES[p.circle] || CIRCLES.other;
      const bits = [];
      if (p.next_birthday_days != null && p.next_birthday_days <= 30) bits.push(`<span class="chip pink">🎂 ${until(p.next_birthday_days)}</span>`);
      if (p.open_problems) bits.push(`<span class="chip warn">🌧️ ${p.open_problems}</span>`);
      if (p.gift_ideas) bits.push(`<span class="chip lemon">🎁 ${p.gift_ideas}</span>`);
      if (p.overdue) bits.push(`<span class="chip sky">💌 say hi</span>`);
      return `
        <a class="card pcard" href="#/person/${p.id}">
          ${p.favorite ? `<span class="fav" title="Favourite">♥</span>` : ""}
          ${avatar(p, "md")}
          <div class="name">${esc(p.name)}</div>
          ${p.nickname ? `<div class="nick">“${esc(p.nickname)}”</div>` : ""}
          <div class="chips"><span class="chip ${c.chip}">${c.icon} ${c.label}</span>${p.pronouns ? `<span class="chip">${esc(p.pronouns)}</span>` : ""}</div>
          ${bits.length ? `<div class="chips">${bits.join("")}</div>` : ""}
          <div class="last">☕ ${p.last_contact ? "talked " + ago(p.days_since_contact) : "no chats yet"} · 💭 ${p.memory_count}</div>
        </a>`;
    }).join("");

    app().innerHTML = `
      <div class="page-head">
        <div><h1>Your people <span class="kao">${esc(pick(KAO.love))}</span></h1>
        <p class="subtitle">Everyone in your little garden.</p></div>
        <span class="spacer"></span>
        <select id="people-sort" aria-label="Sort people" style="width:auto">
          <option value="name">Sort: favourites & name</option>
          <option value="contact">Sort: longest since chat</option>
          <option value="birthday">Sort: next birthday</option>
          <option value="recent">Sort: recently added</option>
        </select>
        <button class="btn" data-action="new-person">＋ Add person</button>
      </div>
      <div class="chips" style="margin-bottom:18px">${chips}</div>
      ${cards ? `<div class="grid people">${cards}</div>` : `<div class="card">${empty("Nobody here yet — add someone special!")}</div>`}`;
    const sortSel = $("#people-sort");
    sortSel.value = state.peopleSort;
    sortSel.addEventListener("change", () => { state.peopleSort = sortSel.value; viewPeople(); });
  }

  // ---------- Person ----------
  async function viewPerson(id) {
    const p = await api("GET", `/api/people/${id}`);
    state.current = p;
    const c = CIRCLES[p.circle] || CIRCLES.other;

    const facts = [`<span class="chip ${c.chip}">${c.icon} ${c.label}</span>`];
    if (p.pronouns) facts.push(`<span class="chip">${esc(p.pronouns)}</span>`);
    if (p.birthday) {
      facts.push(`<span class="chip pink">🎂 ${fmtDate(p.birthday, true)} · ${until(p.next_birthday_days)}${p.turning ? ` (turning ${p.turning})` : ""}</span>`);
    }
    facts.push(`<span class="chip ${p.overdue ? "warn" : "mint"}">☕ ${p.last_contact ? "talked " + ago(p.days_since_contact) : "no chats logged"}</span>`);
    if (p.checkin_days) facts.push(`<span class="chip sky">🔔 every ${p.checkin_days} days</span>`);

    // memories
    const mems = p.memories.filter((m) => state.memFilter === "all" || m.kind === state.memFilter);
    const kindCounts = {};
    p.memories.forEach((m) => { kindCounts[m.kind] = (kindCounts[m.kind] || 0) + 1; });
    const tabs = [`<button class="chip ${state.memFilter === "all" ? "on" : ""}" data-action="mem-filter" data-v="all">All (${p.memories.length})</button>`]
      .concat(KIND_ORDER.filter((k) => kindCounts[k]).map((k) =>
        `<button class="chip ${state.memFilter === k ? "on" : ""}" data-action="mem-filter" data-v="${k}">${MEMORY_KINDS[k].icon} ${MEMORY_KINDS[k].label} (${kindCounts[k]})</button>`)).join("");

    const memItem = (m) => {
      const k = MEMORY_KINDS[m.kind] || MEMORY_KINDS.note;
      const done = m.status === "resolved" || m.status === "given" || m.status === "archived";
      let toggle = "";
      if (m.kind === "problem") toggle = `<button class="icon-btn" data-action="mem-status" data-id="${m.id}" data-v="${done ? "open" : "resolved"}" title="${done ? "Reopen" : "Mark as resolved"}">${done ? "↺" : "✓"}</button>`;
      else if (m.kind === "gift") toggle = `<button class="icon-btn" data-action="mem-status" data-id="${m.id}" data-v="${done ? "open" : "given"}" title="${done ? "Not given yet" : "Mark as given"}">${done ? "↺" : "🎀"}</button>`;
      const statusChip = m.status === "resolved" ? ` · <b>resolved ✓</b>` : m.status === "given" ? ` · <b>given 🎀</b>` : "";
      return `
        <div class="mem ${done ? "done" : ""} ${m.pinned ? "pinned" : ""}">
          <span class="ico">${k.icon}</span>
          <div class="grow">
            <div class="text">${esc(m.text)}</div>
            ${m.detail ? `<div class="detail">${esc(m.detail)}</div>` : ""}
            <div class="meta">${esc(k.one)} · ${ago(daysSince(m.created_at))}${statusChip}</div>
          </div>
          <div class="tools">
            ${toggle}
            <button class="icon-btn" data-action="mem-pin" data-id="${m.id}" data-v="${m.pinned ? 0 : 1}" title="${m.pinned ? "Unpin" : "Pin"}">${m.pinned ? "📌" : "📍"}</button>
            <button class="icon-btn" data-action="edit-memory" data-id="${m.id}" title="Edit">✎</button>
            <button class="icon-btn" data-action="delete-memory" data-id="${m.id}" title="Forget">🗑</button>
          </div>
        </div>`;
    };
    let memHtml;
    if (!mems.length) memHtml = empty(p.memories.length ? "Nothing in this little jar yet." : `What has ${dname(p)} told you lately?`, "think");
    else if (state.memFilter === "all") {
      memHtml = KIND_ORDER.filter((k) => mems.some((m) => m.kind === k)).map((k) => `
        <div class="mem-group"><h4>${MEMORY_KINDS[k].icon} ${MEMORY_KINDS[k].label}</h4>${mems.filter((m) => m.kind === k).map(memItem).join("")}</div>`).join("");
    } else memHtml = mems.map(memItem).join("");

    const kindOptions = KIND_ORDER.map((k) => `<option value="${k}">${MEMORY_KINDS[k].icon} ${MEMORY_KINDS[k].label}</option>`).join("");

    // chats
    const chats = p.interactions.map((i) => {
      const md = MODES[i.mode] || MODES.chat;
      return `<li>
        <div class="when">${md.icon} ${fmtDate(i.date, true)} · ${ago(daysSince(i.date))} ${esc(i.mood)}
          <span style="margin-left:auto"></span>
          <button class="icon-btn" data-action="edit-chat" data-id="${i.id}" title="Edit">✎</button>
          <button class="icon-btn" data-action="delete-chat" data-id="${i.id}" title="Delete">🗑</button></div>
        ${i.topics ? `<div class="topics">${esc(i.topics)}</div>` : `<div class="topics muted">${md.label}</div>`}
        ${i.follow_up ? `<div class="follow">🔔 ${esc(i.follow_up)}</div>` : ""}
      </li>`;
    }).join("");

    // dates
    const dates = p.upcoming.map((e) => `
      <li><div class="row">${bubble(e.date, e.days)}
        <div class="grow"><div class="title">${e.type === "birthday" ? "🎂 Birthday" : "🗓️ " + esc(e.label)}${e.years ? ` <span class="muted">· ${e.type === "birthday" ? "turning " + e.years : ordinal(e.years)}</span>` : ""}</div>
        <div class="meta">${until(e.days)}${e.notes ? " · " + esc(e.notes) : ""}</div></div>
        ${e.id ? `<button class="icon-btn" data-action="edit-date" data-id="${e.id}" title="Edit">✎</button><button class="icon-btn" data-action="delete-date" data-id="${e.id}" title="Delete">🗑</button>` : ""}
      </div></li>`).join("");
    const pastDates = p.dates.filter((d) => !p.upcoming.some((e) => e.id === d.id)).map((d) => `
      <li><div class="row"><span class="bubble"><small>past</small>·</span>
        <div class="grow"><div class="title">🗓️ ${esc(d.label)}</div><div class="meta">${fmtDate(d.date, true)}</div></div>
        <button class="icon-btn" data-action="edit-date" data-id="${d.id}" title="Edit">✎</button><button class="icon-btn" data-action="delete-date" data-id="${d.id}" title="Delete">🗑</button>
      </div></li>`).join("");

    // connections
    const rels = p.relationships.map((r) => {
      const role = relRole(r, p.id);
      const lbl = (REL[role.kind] || REL.friend).label;
      return `<li><div class="row">
        <a href="#/person/${role.otherId}">${avatar({ id: role.otherId, name: role.oname, avatar: role.avatar }, "sm")}</a>
        <a class="grow" href="#/person/${role.otherId}" style="color:inherit"><div class="title">${esc(role.name)}</div>
        <div class="meta">${esc(dname(p))}'s ${esc(lbl)}${r.notes ? " · " + esc(r.notes) : ""}</div></a>
        <button class="icon-btn" data-action="edit-rel" data-id="${r.id}" title="Edit">✎</button>
        <button class="icon-btn" data-action="delete-rel" data-id="${r.id}" title="Remove">🗑</button>
      </div></li>`;
    }).join("");

    app().innerHTML = `
      <section class="card hero tape">
        ${avatar(p, "lg")}
        <div>
          <h1>${esc(p.name)} ${p.favorite ? `<span style="color:var(--pink)" title="Favourite">♥</span>` : ""}
            ${p.nickname ? `<span class="nick">“${esc(p.nickname)}”</span>` : ""}</h1>
          <div class="facts">${facts.join("")}</div>
          ${p.how_met ? `<div class="about">🌱 <b>How we met:</b> ${esc(p.how_met)}</div>` : ""}
        </div>
        <div class="actions">
          <button class="btn" data-action="log-chat" data-person="${p.id}">☕ We talked!</button>
          <button class="btn soft" data-action="edit-person" data-id="${p.id}">✎ Edit</button>
          <button class="btn ghost sm" data-action="delete-person" data-id="${p.id}">Remove…</button>
        </div>
      </section>

      <div class="columns">
        <div class="stack">
          <section class="card">
            <h2>💭 Memory jar <span class="count">${p.memories.length}</span></h2>
            <form class="quick-add" data-form="quick-memory" data-person="${p.id}">
              <select name="kind" aria-label="Kind of memory" style="width:auto">${kindOptions}</select>
              <input type="text" name="text" placeholder="${esc(dname(p))} mentioned…" aria-label="Memory" maxlength="1000" required>
              <button class="btn sm" type="submit">Remember ✿</button>
            </form>
            <div class="mem-tabs">${tabs}</div>
            ${memHtml}
          </section>
          <section class="card">
            <h2>☕ What we talked about <span class="count">${p.interactions.length}</span>
              <button class="card-action btn sm soft" data-action="log-chat" data-person="${p.id}">＋ Log</button></h2>
            ${chats ? `<ul class="timeline">${chats}</ul>` : empty("No chats logged yet. Next time you catch up, jot down the topics!")}
          </section>
        </div>
        <div class="stack">
          <section class="card">
            <h2>🗓️ Special days <button class="card-action btn sm soft" data-action="new-date" data-person="${p.id}">＋ Add</button></h2>
            ${dates || pastDates ? `<ul class="rows">${dates}${pastDates}</ul>` : empty("Anniversaries, exams, trips, big moments…")}
          </section>
          <section class="card">
            <h2>🕸️ Connections <span class="count">${p.relationships.length}</span>
              <button class="card-action btn sm soft" data-action="new-rel" data-person="${p.id}">＋ Link</button></h2>
            ${rels ? `<ul class="rows">${rels}</ul>` : empty(`Who else is in ${dname(p)}'s world?`)}
          </section>
          <section class="card">
            <h2>📒 About</h2>
            ${p.notes ? `<div class="about" style="white-space:pre-wrap;overflow-wrap:anywhere">${esc(p.notes)}</div>` : empty("No notes yet. Click Edit to add some.")}
            <p class="meta muted" style="font-size:12px;margin:12px 0 0">Added ${fmtDate(p.created_at.slice(0, 10), true)}</p>
          </section>
        </div>
      </div>`;
  }

  // ---------- Web (relationship graph) ----------
  let webStop = null;
  async function viewWeb() {
    const g = await api("GET", "/api/relationships");
    if (!g.people.length) {
      app().innerHTML = `<div class="page-head"><h1>Friendship web</h1></div><div class="card">${empty("Add some people and link them together to see your web!")}</div>`;
      return;
    }
    const showMe = localStorage.getItem("mannele.web.me") !== "0";
    app().innerHTML = `
      <div class="page-head">
        <div><h1>Friendship web <span class="kao">ʕ•ᴥ•ʔ</span></h1>
        <p class="subtitle">Drag people around · scroll to zoom · click to visit.</p></div>
      </div>
      <section class="card web-wrap">
        <div class="web-tools">
          <label class="check"><input type="checkbox" id="web-me" ${showMe ? "checked" : ""}> Put me in the middle</label>
          <span class="spacer" style="flex:1"></span>
          <div class="legend">${Object.values(REL_GROUPS).map((gr) => `<span><i style="background:${gr.color}"></i>${gr.label}</span>`).join("")}</div>
          <button class="btn sm soft" data-action="web-shuffle">🔀 Shuffle</button>
        </div>
        <svg id="web-svg" xmlns="http://www.w3.org/2000/svg" aria-label="Relationship graph"></svg>
      </section>`;
    $("#web-me").addEventListener("change", (e) => {
      localStorage.setItem("mannele.web.me", e.target.checked ? "1" : "0");
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

    function tick(alpha) {
      for (let i = 0; i < all.length; i++) {
        for (let j = i + 1; j < all.length; j++) {
          const a = all[i], b = all[j];
          let dx = b.x - a.x, dy = b.y - a.y;
          let d2 = dx * dx + dy * dy || 1;
          const f = (14000 / d2) * alpha;
          const d = Math.sqrt(d2);
          dx /= d; dy /= d;
          a.vx -= dx * f; a.vy -= dy * f; b.vx += dx * f; b.vy += dy * f;
        }
      }
      for (const l of links) {
        const dx = l.t.x - l.s.x, dy = l.t.y - l.s.y;
        const d = Math.sqrt(dx * dx + dy * dy) || 1;
        const want = l.me ? 230 : 150;
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

    let dragging = null;
    for (let i = 0; i < 400; i++) tick(1);

    // initial viewBox
    const xs = all.map((n) => n.x), ys = all.map((n) => n.y);
    const pad = 90;
    const vb = { x: Math.min(...xs) - pad, y: Math.min(...ys) - pad, w: Math.max(...xs) - Math.min(...xs) + pad * 2, h: Math.max(...ys) - Math.min(...ys) + pad * 2 };
    const rect = svg.getBoundingClientRect();
    const aspect = rect.width / Math.max(1, rect.height);
    if (vb.w / vb.h < aspect) { const nw = vb.h * aspect; vb.x -= (nw - vb.w) / 2; vb.w = nw; }
    else { const nh = vb.w / aspect; vb.y -= (nh - vb.h) / 2; vb.h = nh; }
    const setVB = () => svg.setAttribute("viewBox", `${vb.x} ${vb.y} ${vb.w} ${vb.h}`);
    setVB();

    const edgeLayer = document.createElementNS(NS, "g");
    const labelLayer = document.createElementNS(NS, "g");
    const nodeLayer = document.createElementNS(NS, "g");
    svg.replaceChildren(edgeLayer, labelLayer, nodeLayer);

    const edgeEls = links.map((l) => {
      const line = document.createElementNS(NS, "line");
      if (l.me) {
        line.setAttribute("stroke", (CIRCLES[l.t.circle] || CIRCLES.other).color);
        line.setAttribute("stroke-width", "2");
        line.setAttribute("stroke-dasharray", "2 7");
        line.setAttribute("stroke-linecap", "round");
        line.setAttribute("opacity", ".55");
      } else {
        const grp = REL_GROUPS[(REL[l.rel.kind] || REL.friend).group];
        line.setAttribute("stroke", grp.color);
        line.setAttribute("stroke-width", "4");
        line.setAttribute("stroke-linecap", "round");
        line.setAttribute("opacity", ".8");
      }
      edgeLayer.appendChild(line);
      let lab = null;
      if (!l.me) {
        lab = document.createElementNS(NS, "g");
        const grp = REL_GROUPS[(REL[l.rel.kind] || REL.friend).group];
        const text = `${dname(l.s)} is ${(REL[l.rel.kind] || REL.friend).label}`;
        const short = (REL[l.rel.kind] || REL.friend).label;
        const w = short.length * 7 + 18;
        lab.innerHTML = `<title>${esc(text)} of ${esc(dname(l.t))}</title><rect class="edge-pill" x="${-w / 2}" y="-10" width="${w}" height="20" rx="10" stroke="${grp.color}"/><text class="edge-label" text-anchor="middle" y="4">${esc(short)}</text>`;
        labelLayer.appendChild(lab);
      }
      return { line, lab, l };
    });

    const nodeEls = all.map((n) => {
      const el = document.createElementNS(NS, "g");
      el.setAttribute("class", "node");
      if (n.id === "me") {
        el.innerHTML = `<circle r="34" style="fill:var(--pink-soft)" stroke="#ff8fb8" stroke-width="3" stroke-dasharray="4 4"/>
          <text text-anchor="middle" y="6" style="font-size:16px">You ✿</text>`;
      } else {
        const col = (CIRCLES[n.circle] || CIRCLES.other).color;
        el.innerHTML = `<circle r="33" fill="${col}"/><g transform="translate(-30 -30)">${Avatar.render(parseAv(n.avatar), n.id + ":" + n.name, { size: 60 })}</g>
          ${n.favorite ? `<text x="24" y="-22" style="font-size:16px;fill:#ff7fae">♥</text>` : ""}
          <text text-anchor="middle" y="52">${esc(dname(n))}</text>`;
        el.setAttribute("tabindex", "0");
        el.setAttribute("role", "link");
        el.setAttribute("aria-label", dname(n));
        el.addEventListener("keydown", (e) => { if (e.key === "Enter") location.hash = `#/person/${n.id}`; });
      }
      el.__node = n;
      nodeLayer.appendChild(el);
      return { el, n };
    });

    function paint() {
      for (const { line, lab, l } of edgeEls) {
        line.setAttribute("x1", l.s.x); line.setAttribute("y1", l.s.y);
        line.setAttribute("x2", l.t.x); line.setAttribute("y2", l.t.y);
        if (lab) lab.setAttribute("transform", `translate(${(l.s.x + l.t.x) / 2} ${(l.s.y + l.t.y) / 2})`);
      }
      for (const { el, n } of nodeEls) el.setAttribute("transform", `translate(${n.x} ${n.y})`);
    }
    paint();

    // gentle animation loop while interacting
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
      const g = e.target.closest(".node");
      moved = 0;
      svg.setPointerCapture(e.pointerId);
      if (g && g.__node.id !== "me") {
        downNode = g.__node;
        dragging = downNode;
      } else {
        panning = { x: e.clientX, y: e.clientY, vx: vb.x, vy: vb.y };
        svg.style.cursor = "grabbing";
      }
    });
    svg.addEventListener("pointermove", (e) => {
      if (dragging) {
        const p = toSvg(e);
        moved += Math.abs(e.movementX) + Math.abs(e.movementY);
        dragging.x = p.x; dragging.y = p.y;
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
      const p = toSvg(e);
      const f = e.deltaY > 0 ? 1.1 : 1 / 1.1;
      const nw = Math.max(200, Math.min(6000, vb.w * f));
      const k = nw / vb.w;
      vb.x = p.x - (p.x - vb.x) * k; vb.y = p.y - (p.y - vb.y) * k;
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
      const key = d.toLocaleDateString(undefined, { month: "long", year: "numeric" });
      if (!months.has(key)) months.set(key, []);
      months.get(key).push(e);
    });
    const html = Array.from(months.entries()).map(([m, list]) => `
      <section class="card month"><h3>${esc(m)} <span class="count">${list.length}</span></h3>
        <ul class="rows">${list.map((e) => `
          <li><a class="row" href="#/person/${e.person_id}">${bubble(e.date, e.days)}
            ${avatar({ id: e.person_id, name: e.person_name, avatar: e.avatar }, "sm")}
            <div class="grow"><div class="title">${eventLabel(e)}</div><div class="meta">${until(e.days)}${e.notes ? " · " + esc(e.notes) : ""}</div></div></a></li>`).join("")}
        </ul></section>`).join("");
    app().innerHTML = `
      <div class="page-head">
        <div><h1>Special days <span class="kao">🎀</span></h1>
        <p class="subtitle">Birthdays, anniversaries and big moments for the next year.</p></div>
      </div>
      ${html || `<div class="card">${empty("No dates yet — add birthdays and special days on each person's page.")}</div>`}`;
  }

  // ---------- Search ----------
  async function viewSearch(q) {
    const r = await api("GET", `/api/search?q=${encodeURIComponent(q)}`);
    $("#search-input").value = q;
    const rx = new RegExp(esc(q).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
    const hl = (s) => esc(s).replace(rx, (m) => `<mark>${m}</mark>`);
    const people = r.people.map((p) => `<li><a class="row" href="#/person/${p.id}">${avatar(p, "sm")}<div class="grow"><div class="title">${hl(p.name)}</div><div class="meta">${hl(p.nickname)}</div></div></a></li>`).join("");
    const mems = r.memories.map((m) => `<li><a class="row" href="#/person/${m.person_id}"><span style="font-size:20px">${(MEMORY_KINDS[m.kind] || MEMORY_KINDS.note).icon}</span><div class="grow"><div class="title">${hl(m.text)}</div><div class="meta">${esc(m.nickname || m.name)}${m.detail ? " · " + hl(m.detail) : ""}</div></div></a></li>`).join("");
    const chats = r.interactions.map((i) => `<li><a class="row" href="#/person/${i.person_id}"><span style="font-size:20px">${(MODES[i.mode] || MODES.chat).icon}</span><div class="grow"><div class="title">${hl(i.topics)}</div><div class="meta">${esc(i.nickname || i.name)} · ${fmtDate(i.date, true)}${i.follow_up ? " · 🔔 " + hl(i.follow_up) : ""}</div></div></a></li>`).join("");
    const none = !people && !mems && !chats;
    app().innerHTML = `
      <div class="page-head"><div><h1>Searching for “${esc(q)}” <span class="kao">${esc(pick(KAO.think))}</span></h1></div></div>
      ${none ? `<div class="card">${empty("Hmm, nothing matched. Try another word?", "sad")}</div>` : `
      <div class="grid dash">
        ${people ? `<section class="card"><h2>🌸 People</h2><ul class="rows">${people}</ul></section>` : ""}
        ${mems ? `<section class="card"><h2>💭 Memories</h2><ul class="rows">${mems}</ul></section>` : ""}
        ${chats ? `<section class="card"><h2>☕ Chats</h2><ul class="rows">${chats}</ul></section>` : ""}
      </div>`}`;
  }

  // ---------- Settings ----------
  async function viewSettings() {
    const theme = localStorage.getItem("mannele.theme") || "auto";
    const petals = localStorage.getItem("mannele.petals") !== "0";
    app().innerHTML = `
      <div class="page-head"><div><h1>Settings <span class="kao">(｀・ω・´)ゞ</span></h1>
        <p class="subtitle">Make the garden yours.</p></div></div>
      <div class="grid dash">
        <section class="card"><h2>🎨 Look & feel</h2>
          <div class="field"><label for="theme">Theme</label>
            <select id="theme"><option value="auto">Follow my device</option><option value="light">☀️ Sakura day</option><option value="dark">🌙 Starry night</option></select></div>
          <label class="check"><input type="checkbox" id="petals" ${petals ? "checked" : ""}> Falling sakura petals</label>
        </section>
        <section class="card"><h2>💾 Your data</h2>
          <p class="muted" style="margin-top:0">Everything lives in a single SQLite file on your machine. Download a backup now and then!</p>
          <div class="chips" style="gap:10px">
            <button class="btn lav" data-action="export">⬇ Download backup</button>
            <label class="btn soft" style="cursor:pointer">⬆ Restore backup<input type="file" id="import-file" accept="application/json,.json" hidden></label>
          </div>
          <label class="check mt"><input type="checkbox" id="import-replace"> Replace everything when restoring (otherwise merge)</label>
        </section>
        <section class="card"><h2>🌸 Demo friends</h2>
          <p class="muted" style="margin-top:0">Plant a handful of example people to see how everything looks.</p>
          <button class="btn mint" data-action="seed-demo">🌱 Plant demo friends</button>
        </section>
        <section class="card" id="session-card" hidden><h2>🔐 Session</h2>
          <p class="muted" style="margin-top:0">Your garden is protected with a password.</p>
          <button class="btn soft" data-action="logout">👋 Log out</button>
        </section>
      </div>`;
    $("#theme").value = theme;
    $("#theme").addEventListener("change", (e) => { localStorage.setItem("mannele.theme", e.target.value); applyTheme(); });
    $("#petals").addEventListener("change", (e) => { localStorage.setItem("mannele.petals", e.target.checked ? "1" : "0"); makePetals(); });
    $("#import-file").addEventListener("change", importFile);
    const s = await api("GET", "/api/session");
    $("#session-card").hidden = !s.auth;
  }

  async function importFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      const replace = $("#import-replace").checked;
      if (replace && !(await confirmBox("Replace everything?", "This deletes all current people and memories before restoring the backup.", "Replace"))) return;
      const r = await api("POST", "/api/import", { data, replace });
      toast(`Restored ${r.people_imported} people ${pick(KAO.happy)}`);
    } catch (err) {
      toast(err.message || "Couldn't read that file", true);
    } finally {
      e.target.value = "";
    }
  }

  // ---------- Login ----------
  function viewLogin() {
    $("#topbar").hidden = true;
    $("#fab").hidden = true;
    app().innerHTML = `
      <div class="card login tape">
        <div class="mascot">${Avatar.render({ hair: "#8e6cd8", style: "long", eyes: "sparkle", acc: "catears", bg: "#efe6ff", mouth: "cat", skin: "#ffe7d6" }, "guard")}</div>
        <h1>Welcome back!</h1>
        <p>Whisper the secret word to open the memory garden.</p>
        <form data-form="login">
          <input type="password" name="password" placeholder="Secret word" aria-label="Password" autofocus required autocomplete="current-password">
          <button class="btn" type="submit" style="justify-content:center">Open the garden ✿</button>
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
    const circles = Object.entries(CIRCLES).map(([k, c]) => `<option value="${k}">${c.icon} ${c.label}</option>`).join("");
    const freq = [[0, "No reminders"], [7, "Every week"], [14, "Every two weeks"], [30, "Every month"], [60, "Every two months"], [90, "Every season"], [180, "Twice a year"], [365, "Once a year"]];
    const curFreq = p.checkin_days ?? 30;
    if (!freq.some(([v]) => v === curFreq)) freq.push([curFreq, `Every ${curFreq} days`]);

    openModal(`
      <h2 id="modal-title">${p.id ? `Edit ${esc(dname(p))}` : "A new person in your garden 🌱"}</h2>
      <p class="lead">${p.id ? "Update their details." : "Start with a name — you can fill in the rest anytime."}</p>
      <form data-form="person" data-id="${p.id || ""}">
        <div class="maker">
          <div class="preview"><span class="av lg" id="av-preview"></span>
            <button type="button" class="btn sm soft" data-action="av-random">🎲 Surprise me</button></div>
          <div class="opts" id="av-opts"></div>
        </div>
        <input type="hidden" name="avatar">
        <div class="row2">
          <div class="field"><label for="f-name">Name *</label><input id="f-name" type="text" name="name" required maxlength="120" value="${esc(p.name)}" autofocus></div>
          <div class="field"><label for="f-nick">Nickname</label><input id="f-nick" type="text" name="nickname" maxlength="120" value="${esc(p.nickname)}" placeholder="what you call them"></div>
        </div>
        <div class="row3">
          <div class="field"><label for="f-pron">Pronouns</label><input id="f-pron" type="text" name="pronouns" maxlength="40" value="${esc(p.pronouns)}" placeholder="she/they…" list="pronoun-list">
            <datalist id="pronoun-list"><option value="she/her"><option value="he/him"><option value="they/them"><option value="she/they"><option value="he/they"></datalist></div>
          <div class="field"><label for="f-circle">Circle</label><select id="f-circle" name="circle">${circles}</select></div>
          <div class="field"><label for="f-freq">Check in</label><select id="f-freq" name="checkin_days">${freq.map(([v, l]) => `<option value="${v}">${l}</option>`).join("")}</select></div>
        </div>
        <div class="row2">
          <div class="field"><label for="f-bday">Birthday</label><input id="f-bday" type="date" name="birthday" value="${esc(birthday)}"></div>
          <div class="field"><span class="label">&nbsp;</span><label class="check"><input type="checkbox" name="unknown_year" ${unknownYear ? "checked" : ""}> I don't know the year</label></div>
        </div>
        <div class="field"><label for="f-met">How you met</label><input id="f-met" type="text" name="how_met" maxlength="2000" value="${esc(p.how_met)}" placeholder="That rainy day at the bookstore…"></div>
        <div class="field"><label for="f-notes">Notes</label><textarea id="f-notes" name="notes" maxlength="10000" placeholder="Anything else to remember about them">${esc(p.notes)}</textarea></div>
        <label class="check"><input type="checkbox" name="favorite" ${p.favorite ? "checked" : ""}> ♥ Favourite person</label>
        <div class="modal-actions">
          <button type="button" class="btn soft" data-action="close-modal">Cancel</button>
          <button type="submit" class="btn">${p.id ? "Save ✿" : "Add to garden ✿"}</button>
        </div>
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
        <div class="opt-row"><span>Backdrop</span>${swatches("bg", O.bg)}</div>
        <div class="opt-row" style="gap:12px">${select("style", "Hairdo")}${select("eyes", "Look")}</div>
        <div class="opt-row" style="gap:12px">${select("mouth", "Mouth")}${select("acc", "Extra")}</div>`;
      $$("#av-opts select").forEach((s) => s.addEventListener("change", () => { av[s.dataset.av] = s.value; paint(); }));
    };
    actions["av-set"] = (el) => { av[el.dataset.k] = el.dataset.v; paint(); };
    actions["av-random"] = () => { Object.assign(av, Avatar.randomFor(Math.random())); paint(); };
    paint();
  }

  function memoryForm(m, personId) {
    m = m || { kind: "note", status: "open" };
    const statuses = { open: "Open / current", resolved: "Resolved ✓", given: "Given 🎀", archived: "Archived" };
    openModal(`
      <h2 id="modal-title">${m.id ? "Edit memory" : "Remember something 💭"}</h2>
      <p class="lead">${esc(pick(KAO.happy))}</p>
      <form data-form="memory" data-id="${m.id || ""}" data-person="${personId || ""}">
        <div class="field"><label for="m-kind">What kind of thing?</label>
          <select id="m-kind" name="kind">${KIND_ORDER.map((k) => `<option value="${k}">${MEMORY_KINDS[k].icon} ${MEMORY_KINDS[k].one} — ${MEMORY_KINDS[k].hint}</option>`).join("")}</select></div>
        <div class="field"><label for="m-text">The memory *</label><input id="m-text" type="text" name="text" required maxlength="1000" value="${esc(m.text)}" autofocus></div>
        <div class="field"><label for="m-detail">Details</label><textarea id="m-detail" name="detail" maxlength="5000" placeholder="Context, links, sizes, who said what…">${esc(m.detail)}</textarea></div>
        <div class="field"><label for="m-status">Status</label><select id="m-status" name="status">${Object.entries(statuses).map(([k, v]) => `<option value="${k}">${v}</option>`).join("")}</select></div>
        <label class="check"><input type="checkbox" name="pinned" ${m.pinned ? "checked" : ""}> 📌 Pin to the top</label>
        <div class="modal-actions">
          <button type="button" class="btn soft" data-action="close-modal">Cancel</button>
          <button type="submit" class="btn">Save ✿</button>
        </div>
      </form>`);
    $("#m-kind").value = m.kind;
    $("#m-status").value = m.status;
  }

  function chatForm(i, personId, people) {
    i = i || { date: state.today, mode: "chat", mood: "" };
    const personPicker = people ? `
      <div class="field"><label for="c-person">With who?</label>
        <select id="c-person" name="person_id" required>${people.map((p) => `<option value="${p.id}">${esc(dname(p))}</option>`).join("")}</select></div>` : "";
    openModal(`
      <h2 id="modal-title">${i.id ? "Edit chat" : "We talked! ☕"}</h2>
      <p class="lead">What did you talk about? Future-you will thank you. ${esc(pick(KAO.love))}</p>
      <form data-form="chat" data-id="${i.id || ""}" data-person="${personId || ""}">
        ${personPicker}
        <div class="row2">
          <div class="field"><label for="c-date">When</label><input id="c-date" type="date" name="date" value="${esc(i.date)}" required></div>
          <div class="field"><label for="c-mode">How</label><select id="c-mode" name="mode">${Object.entries(MODES).map(([k, v]) => `<option value="${k}">${v.icon} ${v.label}</option>`).join("")}</select></div>
        </div>
        <div class="field"><span class="label">Vibe</span>
          <div class="chips">${MOODS.map((mo) => `<button type="button" class="chip ${i.mood === mo ? "on" : ""}" data-action="pick-mood" data-v="${mo}" style="font-size:18px">${mo}</button>`).join("")}</div>
          <input type="hidden" name="mood" value="${esc(i.mood)}"></div>
        <div class="field"><label for="c-topics">Topics</label><textarea id="c-topics" name="topics" maxlength="5000" placeholder="Their new job, the cat's vet visit, that drama with the neighbour…" autofocus>${esc(i.topics)}</textarea></div>
        <div class="field"><label for="c-follow">Follow up on…</label><input id="c-follow" type="text" name="follow_up" maxlength="2000" value="${esc(i.follow_up)}" placeholder="Ask how the interview went"></div>
        <div class="modal-actions">
          <button type="button" class="btn soft" data-action="close-modal">Cancel</button>
          <button type="submit" class="btn">Save ✿</button>
        </div>
      </form>`);
    $("#c-mode").value = i.mode || "chat";
    if (personId && $("#c-person")) $("#c-person").value = personId;
  }

  function dateForm(d, personId) {
    d = d || { yearly: 1 };
    openModal(`
      <h2 id="modal-title">${d.id ? "Edit special day" : "A special day 🎀"}</h2>
      <p class="lead">Anniversaries, exams, surgeries, trips, first days…</p>
      <form data-form="date" data-id="${d.id || ""}" data-person="${personId || ""}">
        <div class="field"><label for="d-label">What's happening? *</label><input id="d-label" type="text" name="label" required maxlength="200" value="${esc(d.label)}" placeholder="Wedding anniversary" autofocus></div>
        <div class="row2">
          <div class="field"><label for="d-date">Date *</label><input id="d-date" type="date" name="date" required value="${esc(String(d.date || "").startsWith("--") ? "2000" + d.date.slice(1) : d.date)}"></div>
          <div class="field"><span class="label">&nbsp;</span><label class="check"><input type="checkbox" name="yearly" ${d.yearly ? "checked" : ""}> 🔁 Every year</label></div>
        </div>
        <div class="field"><label for="d-notes">Notes</label><input id="d-notes" type="text" name="notes" maxlength="2000" value="${esc(d.notes)}" placeholder="Send flowers? Text good luck?"></div>
        <div class="modal-actions">
          <button type="button" class="btn soft" data-action="close-modal">Cancel</button>
          <button type="submit" class="btn">Save ✿</button>
        </div>
      </form>`);
  }

  async function relForm(personId, rel) {
    const people = (await getPeople()).filter((p) => p.id !== personId);
    const me = (await getPeople()).find((p) => p.id === personId);
    if (!people.length) return toast("Add another person first! " + pick(KAO.think));
    let otherId = "", kind = "friend";
    if (rel) {
      const role = relRole(rel, personId);
      otherId = role.otherId; kind = role.kind;
    }
    const kinds = Object.entries(REL).map(([k, v]) => `<option value="${k}">${esc(v.label)}</option>`).join("");
    openModal(`
      <h2 id="modal-title">${rel ? "Edit connection" : "Link someone 🕸️"}</h2>
      <p class="lead">Who's in ${esc(dname(me))}'s world?</p>
      <form data-form="rel" data-id="${rel ? rel.id : ""}" data-person="${personId}">
        <div class="field"><label for="r-other">Person</label>
          <select id="r-other" name="other" required>${people.map((p) => `<option value="${p.id}">${esc(p.name)}${p.nickname ? ` (${esc(p.nickname)})` : ""}</option>`).join("")}</select></div>
        <div class="field"><label for="r-kind">…is ${esc(dname(me))}'s</label><select id="r-kind" name="kind">${kinds}</select></div>
        <div class="field"><label for="r-notes">Notes</label><input id="r-notes" type="text" name="notes" maxlength="2000" value="${esc(rel ? rel.notes : "")}" placeholder="Since kindergarten, it's complicated, etc."></div>
        <div class="modal-actions">
          <button type="button" class="btn soft" data-action="close-modal">Cancel</button>
          <button type="submit" class="btn">Save ✿</button>
        </div>
      </form>`);
    if (otherId) $("#r-other").value = otherId;
    $("#r-kind").value = kind;
  }

  async function quickJot() {
    const people = await getPeople();
    if (!people.length) return personForm();
    const cur = currentPersonId();
    const opts = people.slice().sort((a, b) => dname(a).localeCompare(dname(b)))
      .map((p) => `<option value="${p.id}">${esc(dname(p))}</option>`).join("");
    openModal(`
      <h2 id="modal-title">Jot it down ✎</h2>
      <p class="lead">Quick! Before you forget ${esc(pick(KAO.happy))}</p>
      <form data-form="jot">
        <div class="row2">
          <div class="field"><label for="j-person">About</label><select id="j-person" name="person_id">${opts}</select></div>
          <div class="field"><label for="j-kind">Kind</label><select id="j-kind" name="kind">
            <option value="__chat">☕ We talked about…</option>
            ${KIND_ORDER.map((k) => `<option value="${k}">${MEMORY_KINDS[k].icon} ${MEMORY_KINDS[k].one}</option>`).join("")}
          </select></div>
        </div>
        <div class="field"><label for="j-text">What?</label><textarea id="j-text" name="text" required maxlength="1000" autofocus placeholder="She's training for a half-marathon in spring!"></textarea></div>
        <div class="modal-actions">
          <button type="button" class="btn soft" data-action="close-modal">Cancel</button>
          <button type="submit" class="btn">Remember ✿</button>
        </div>
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
      toast(id ? "Saved! ✿" : `Welcome, ${dname(p)}! ${pick(KAO.happy)}`);
      if (!id) location.hash = `#/person/${p.id}`; else render(true);
    },
    async "quick-memory"(form, v) {
      await api("POST", `/api/people/${form.dataset.person}/memories`, { kind: v.kind, text: v.text });
      toast("Remembered! " + pick(KAO.happy));
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
      closeModal(); toast("Saved! ✿"); render(true);
    },
    async chat(form, v) {
      const body = { date: v.date, mode: v.mode, mood: v.mood, topics: v.topics, follow_up: v.follow_up };
      const pid = v.person_id || form.dataset.person;
      if (form.dataset.id) await api("PUT", `/api/interactions/${form.dataset.id}`, body);
      else await api("POST", `/api/people/${pid}/interactions`, body);
      closeModal(); toast("Chat saved ☕ " + pick(KAO.love)); render(true);
    },
    async date(form, v) {
      const body = { label: v.label, date: v.date, yearly: v.yearly, notes: v.notes };
      if (form.dataset.id) await api("PUT", `/api/dates/${form.dataset.id}`, body);
      else await api("POST", `/api/people/${form.dataset.person}/dates`, body);
      closeModal(); toast("Marked on the calendar 🎀"); render(true);
    },
    async rel(form, v) {
      const body = { a_id: +v.other, b_id: +form.dataset.person, kind: v.kind, notes: v.notes };
      if (form.dataset.id) await api("PUT", `/api/relationships/${form.dataset.id}`, body);
      else await api("POST", "/api/relationships", body);
      closeModal(); toast("Linked! 🕸️"); render(true);
    },
    async jot(form, v) {
      if (v.kind === "__chat") {
        await api("POST", `/api/people/${v.person_id}/interactions`, { date: state.today, mode: "chat", topics: v.text });
      } else {
        await api("POST", `/api/people/${v.person_id}/memories`, { kind: v.kind, text: v.text });
      }
      closeModal(); toast("Remembered! " + pick(KAO.happy)); render(true);
    },
  };

  // ------------------------------------------------------------------
  // actions (click delegation)
  // ------------------------------------------------------------------
  const findIn = (list, id) => (list || []).find((x) => String(x.id) === String(id));
  const currentPersonId = () => { const m = /^#\/person\/(\d+)/.exec(location.hash); return m ? +m[1] : null; };

  const actions = {
    "close-modal": closeModal,
    "new-person": () => personForm(),
    "edit-person": () => personForm(state.current),
    "delete-person": async () => {
      const p = state.current;
      if (await confirmBox(`Remove ${dname(p)}?`, "All their memories, chats, dates and connections will be forgotten forever.", "Remove")) {
        await api("DELETE", `/api/people/${p.id}`);
        toast(`Goodbye, ${dname(p)} ${pick(KAO.sad)}`);
        location.hash = "#/people";
      }
    },
    "quick-jot": quickJot,
    "seed-demo": async () => { await api("POST", "/api/demo"); toast("Demo friends planted 🌸"); location.hash = "#/"; render(); },
    refresh: () => render(true),
    "filter-circle": (el) => { state.peopleFilter = el.dataset.v; viewPeople(); },
    "mem-filter": (el) => { state.memFilter = el.dataset.v; render(true); },
    "mem-status": async (el) => {
      await api("PUT", `/api/memories/${el.dataset.id}`, { status: el.dataset.v });
      if (el.dataset.v === "resolved") toast("So glad that's sorted! " + pick(KAO.happy));
      if (el.dataset.v === "given") toast("Aww, they'll love it 🎀");
      render(true);
    },
    "mem-pin": async (el) => { await api("PUT", `/api/memories/${el.dataset.id}`, { pinned: el.dataset.v === "1" }); render(true); },
    "edit-memory": (el) => memoryForm(findIn(state.current.memories, el.dataset.id), state.current.id),
    "delete-memory": async (el) => {
      if (await confirmBox("Forget this memory?", findIn(state.current.memories, el.dataset.id).text, "Forget")) {
        await api("DELETE", `/api/memories/${el.dataset.id}`); render(true);
      }
    },
    "log-chat": async (el) => {
      const pid = el.dataset.person ? +el.dataset.person : null;
      chatForm(null, pid, pid ? null : await getPeople());
    },
    "edit-chat": (el) => chatForm(findIn(state.current.interactions, el.dataset.id), state.current.id),
    "delete-chat": async (el) => {
      if (await confirmBox("Delete this chat?", "The topics you noted will be gone.", "Delete")) {
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
      if (await confirmBox("Delete this date?", findIn(state.current.dates, el.dataset.id).label, "Delete")) {
        await api("DELETE", `/api/dates/${el.dataset.id}`); render(true);
      }
    },
    "new-rel": (el) => relForm(+el.dataset.person),
    "edit-rel": (el) => relForm(state.current.id, findIn(state.current.relationships, el.dataset.id)),
    "delete-rel": async (el) => {
      if (await confirmBox("Remove this connection?", "Both people stay — only the link goes away.", "Remove")) {
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
      toast("Backup downloaded 💾");
    },
    logout: async () => { await api("POST", "/api/logout", {}); viewLogin(); },
  };

  function handleError(err) {
    if (err instanceof AuthError) { closeModal(); viewLogin(); return; }
    console.error(err);
    toast(err.message || "Something went wrong " + pick(KAO.sad), true);
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
      if (!hash.startsWith("person/") || !lastRoute.startsWith("person/")) state.memFilter = "all";
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
      if (keepScroll) window.scrollTo(0, scroll); else window.scrollTo(0, 0);
    } catch (err) {
      if (err instanceof AuthError) return viewLogin();
      app().innerHTML = `<div class="card">${empty(err.message || "Couldn't load this page.", "sad")}<div style="text-align:center"><a class="btn soft" href="#/">Go home</a></div></div>`;
    }
  }

  // ------------------------------------------------------------------
  // theme & petals
  // ------------------------------------------------------------------
  function applyTheme() {
    const t = localStorage.getItem("mannele.theme") || "auto";
    if (t === "auto") document.documentElement.removeAttribute("data-theme");
    else document.documentElement.setAttribute("data-theme", t);
  }

  function makePetals() {
    const box = $("#petals");
    box.innerHTML = "";
    if (localStorage.getItem("mannele.petals") === "0") return;
    for (let i = 0; i < 14; i++) {
      const p = document.createElement("div");
      p.className = "petal";
      const s = 8 + Math.random() * 10;
      p.style.left = `${Math.random() * 100}%`;
      p.style.width = `${s}px`;
      p.style.height = `${s * 0.8}px`;
      p.style.animationDuration = `${12 + Math.random() * 14}s`;
      p.style.animationDelay = `${-Math.random() * 20}s`;
      p.style.opacity = String(0.35 + Math.random() * 0.45);
      box.appendChild(p);
    }
  }

  // ------------------------------------------------------------------
  // boot
  // ------------------------------------------------------------------
  async function boot() {
    try {
      const meta = await api("GET", "/api/meta");
      state.today = meta.today;
    } catch (err) {
      if (err instanceof AuthError) return viewLogin();
    }
    $("#topbar").hidden = false;
    $("#fab").hidden = false;
    await render();
  }

  applyTheme();
  makePetals();
  window.addEventListener("hashchange", () => render());
  boot();
})();
