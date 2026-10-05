/* Chibi avatar generator — pure SVG, no external assets. */
(function () {
  "use strict";

  const OPTIONS = {
    hair: ["#3b3b58", "#5a3d2b", "#a0643c", "#f2c46d", "#f4a7c4", "#8e6cd8", "#6cc3b5", "#7fb4f0", "#e35d6a", "#d9d9e3", "#2f2f2f", "#ff9a5c"],
    skin: ["#ffe7d6", "#ffe3d3", "#f6d2b8", "#e8b896", "#d9a982", "#b67d58", "#8a5a3c", "#f3d5c0"],
    bg: ["#ffe9f3", "#efe6ff", "#e3f7f2", "#e6f0ff", "#fff4dc", "#ffe8dc", "#f0f0f0", "#e9ffe0"],
    style: ["short", "bob", "long", "twintails", "bun", "spiky", "ponytail", "fluffy"],
    eyes: ["sparkle", "happy", "sleepy", "wink", "round", "starry"],
    mouth: ["smile", "cat", "open", "tiny"],
    acc: ["none", "catears", "bunny", "bow", "flower", "glasses", "headphones", "halo", "star"],
    eye: ["#5b3a7a", "#2e6db0", "#3b8a62", "#a0522d", "#c2185b", "#333344"],
  };

  const LABELS = {
    style: { short: "Short", bob: "Bob", long: "Long", twintails: "Twintails", bun: "Bun", spiky: "Spiky", ponytail: "Ponytail", fluffy: "Fluffy" },
    eyes: { sparkle: "Sparkly", happy: "Happy ^^", sleepy: "Sleepy", wink: "Wink", round: "Round", starry: "Starry" },
    mouth: { smile: "Smile", cat: "Cat :3", open: "Open", tiny: "Tiny" },
    acc: { none: "None", catears: "Cat ears", bunny: "Bunny ears", bow: "Bow", flower: "Flower", glasses: "Glasses", headphones: "Headphones", halo: "Halo", star: "Star clip" },
  };

  function hash(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }

  function randomFor(seed) {
    let s = hash(String(seed || Math.random())) || 1;
    const rnd = () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return (s >>> 0) / 4294967296; };
    const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
    return {
      hair: pick(OPTIONS.hair), skin: pick(OPTIONS.skin.slice(0, 6)), bg: pick(OPTIONS.bg),
      style: pick(OPTIONS.style), eyes: pick(["sparkle", "sparkle", "happy", "round", "starry"]),
      mouth: pick(OPTIONS.mouth), acc: pick(["none", "none", "catears", "bow", "flower", "glasses", "star"]),
      eye: pick(OPTIONS.eye),
    };
  }

  function shade(hex, amt) {
    const m = /^#?([0-9a-f]{6})$/i.exec(hex || "");
    if (!m) return hex;
    const n = parseInt(m[1], 16);
    const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) =>
      Math.max(0, Math.min(255, Math.round(amt < 0 ? v * (1 + amt) : v + (255 - v) * amt))));
    return "#" + c.map((v) => v.toString(16).padStart(2, "0")).join("");
  }

  const safeColor = (c, fallback) => (/^#[0-9a-f]{6}$/i.test(c || "") ? c : fallback);

  function normalize(a, seed) {
    const base = randomFor(seed);
    a = a && typeof a === "object" ? a : {};
    const out = {};
    for (const k of Object.keys(base)) {
      const v = a[k];
      if (["hair", "skin", "bg", "eye"].includes(k)) out[k] = safeColor(v, base[k]);
      else out[k] = OPTIONS[k].includes(v) ? v : base[k];
    }
    return out;
  }

  function backHair(a, h, hd) {
    const st = `fill="${h}" stroke="${hd}" stroke-width="1.5"`;
    switch (a.style) {
      case "long":
        return `<path ${st} d="M22 48 Q18 20 50 16 Q82 20 78 48 L82 92 Q66 98 50 92 Q34 98 18 92 Z"/>`;
      case "bob":
        return `<path ${st} d="M20 50 Q18 18 50 15 Q82 18 80 50 L80 74 Q72 80 64 74 L36 74 Q28 80 20 74 Z"/>`;
      case "twintails":
        return `<path ${st} d="M24 40 Q8 50 10 74 Q12 90 20 94 Q22 78 28 60 Z"/>` +
          `<path ${st} d="M76 40 Q92 50 90 74 Q88 90 80 94 Q78 78 72 60 Z"/>` +
          `<path ${st} d="M23 50 Q20 18 50 15 Q80 18 77 50 Z"/>`;
      case "bun":
        return `<circle ${st} cx="50" cy="14" r="11"/><path ${st} d="M23 50 Q20 20 50 17 Q80 20 77 50 Z"/>`;
      case "ponytail":
        return `<path ${st} d="M70 26 Q96 30 90 66 Q86 80 80 86 Q82 64 72 44 Z"/><path ${st} d="M23 50 Q20 18 50 15 Q80 18 77 50 Z"/>`;
      case "fluffy":
        return `<path ${st} d="M18 56 Q8 40 18 30 Q18 12 36 12 Q50 2 64 12 Q82 12 82 30 Q92 40 82 56 Q86 70 76 72 L24 72 Q14 70 18 56 Z"/>`;
      default:
        return `<path ${st} d="M23 50 Q20 18 50 15 Q80 18 77 50 Z"/>`;
    }
  }

  function bangs(a, h, hd) {
    const st = `fill="${h}" stroke="${hd}" stroke-width="1.5" stroke-linejoin="round"`;
    if (a.style === "spiky") {
      return `<path ${st} d="M22 52 L20 34 L28 38 L26 20 L36 30 L40 12 L48 26 L56 10 L60 26 L70 16 L70 32 L80 28 L76 40 L80 52 Q72 38 64 40 L58 32 L52 42 L44 32 L38 42 Q28 38 22 52 Z"/>`;
    }
    if (a.style === "short") {
      return `<path ${st} d="M23 50 Q20 20 50 18 Q80 20 77 50 Q74 36 64 34 Q56 40 46 34 Q34 38 30 34 Q24 40 23 50 Z"/>`;
    }
    return `<path ${st} d="M23 52 Q20 20 50 18 Q80 20 77 52 Q72 38 64 38 Q60 30 54 38 Q48 30 42 40 Q36 32 32 40 Q26 40 23 52 Z"/>` +
      `<path fill="none" stroke="#ffffff" stroke-opacity=".55" stroke-width="2.2" stroke-linecap="round" d="M34 25 Q42 21 50 22"/>`;
  }

  function eye(x, y, kind, ec, wink) {
    if (kind === "happy" || wink) {
      return `<path d="M${x - 5} ${y + 1} Q${x} ${y - 6} ${x + 5} ${y + 1}" fill="none" stroke="#3a2a40" stroke-width="2.4" stroke-linecap="round"/>`;
    }
    if (kind === "sleepy") {
      return `<path d="M${x - 5} ${y} Q${x} ${y + 4} ${x + 5} ${y}" fill="none" stroke="#3a2a40" stroke-width="2.4" stroke-linecap="round"/>` +
        `<path d="M${x + 4} ${y - 1} l2.5 -1.8" stroke="#3a2a40" stroke-width="1.6" stroke-linecap="round"/>`;
    }
    if (kind === "round") {
      return `<circle cx="${x}" cy="${y}" r="4.2" fill="#2d2133"/><circle cx="${x + 1.4}" cy="${y - 1.4}" r="1.4" fill="#fff"/>`;
    }
    const lash = `<path d="M${x - 6.5} ${y - 6} Q${x} ${y - 10.5} ${x + 6.5} ${y - 6}" fill="none" stroke="#2d2133" stroke-width="2.4" stroke-linecap="round"/>`;
    const iris = `<ellipse cx="${x}" cy="${y}" rx="5.2" ry="7" fill="${ec}"/>` +
      `<ellipse cx="${x}" cy="${y + 2.4}" rx="4" ry="4" fill="${shade(ec, 0.35)}" opacity=".8"/>` +
      `<ellipse cx="${x}" cy="${y - 1}" rx="2.6" ry="3.4" fill="#1c1424" opacity=".85"/>`;
    const shine = kind === "starry"
      ? `<path d="M${x + 1.8} ${y - 5.2} l1 2.2 2.2 1 -2.2 1 -1 2.2 -1 -2.2 -2.2 -1 2.2 -1 Z" fill="#fff"/>`
      : `<circle cx="${x + 1.8}" cy="${y - 3}" r="2" fill="#fff"/><circle cx="${x - 1.8}" cy="${y + 3}" r="1" fill="#fff" opacity=".9"/>`;
    return iris + shine + lash;
  }

  function mouth(kind) {
    switch (kind) {
      case "cat": return `<path d="M44 66 Q47 69 50 66 Q53 69 56 66" fill="none" stroke="#7a3b4a" stroke-width="1.8" stroke-linecap="round"/>`;
      case "open": return `<path d="M45 65 Q50 72 55 65 Z" fill="#c9506b" stroke="#7a3b4a" stroke-width="1.2" stroke-linejoin="round"/>`;
      case "tiny": return `<path d="M48 66.5 Q50 68 52 66.5" fill="none" stroke="#7a3b4a" stroke-width="1.8" stroke-linecap="round"/>`;
      default: return `<path d="M45 65.5 Q50 70 55 65.5" fill="none" stroke="#7a3b4a" stroke-width="1.8" stroke-linecap="round"/>`;
    }
  }

  function accessoryBack(a, h, hd) {
    if (a.acc === "catears") {
      return `<path d="M24 34 L22 10 L42 22 Z" fill="${h}" stroke="${hd}" stroke-width="1.5" stroke-linejoin="round"/>` +
        `<path d="M27 29 L26 16 L37 23 Z" fill="#ffb7cf"/>` +
        `<path d="M76 34 L78 10 L58 22 Z" fill="${h}" stroke="${hd}" stroke-width="1.5" stroke-linejoin="round"/>` +
        `<path d="M73 29 L74 16 L63 23 Z" fill="#ffb7cf"/>`;
    }
    if (a.acc === "bunny") {
      return `<ellipse cx="38" cy="15" rx="6" ry="13" transform="rotate(-12 38 15)" fill="#fff" stroke="#e7cfe0" stroke-width="1.5"/>` +
        `<ellipse cx="38" cy="15" rx="2.8" ry="9" transform="rotate(-12 38 15)" fill="#ffc2d8"/>` +
        `<ellipse cx="62" cy="15" rx="6" ry="13" transform="rotate(12 62 15)" fill="#fff" stroke="#e7cfe0" stroke-width="1.5"/>` +
        `<ellipse cx="62" cy="15" rx="2.8" ry="9" transform="rotate(12 62 15)" fill="#ffc2d8"/>`;
    }
    if (a.acc === "halo") {
      return `<ellipse cx="50" cy="8" rx="16" ry="4.5" fill="none" stroke="#ffd966" stroke-width="3"/>`;
    }
    return "";
  }

  function accessoryFront(a) {
    switch (a.acc) {
      case "bow":
        return `<g transform="translate(70 26) rotate(18)"><path d="M0 0 L-11 -7 L-11 7 Z M0 0 L11 -7 L11 7 Z" fill="#ff7fae" stroke="#e05a8e" stroke-width="1.2" stroke-linejoin="round"/><circle r="3" fill="#ffb3cf" stroke="#e05a8e" stroke-width="1"/></g>`;
      case "flower":
        return `<g transform="translate(28 28)">${[0, 72, 144, 216, 288].map((r) => `<ellipse cx="0" cy="-5" rx="3.6" ry="5" fill="#ffc2d8" stroke="#ff8fb8" stroke-width=".8" transform="rotate(${r})"/>`).join("")}<circle r="2.4" fill="#ffe69a"/></g>`;
      case "glasses":
        return `<g fill="none" stroke="#5b4a6b" stroke-width="1.8"><circle cx="39" cy="56" r="8"/><circle cx="61" cy="56" r="8"/><path d="M47 55 Q50 53 53 55"/></g>` +
          `<path d="M34 51 l3 -2" stroke="#fff" stroke-width="1.5" stroke-linecap="round" opacity=".8"/>`;
      case "headphones":
        return `<path d="M20 52 Q18 14 50 12 Q82 14 80 52" fill="none" stroke="#7a6fd8" stroke-width="4"/>` +
          `<rect x="14" y="44" width="10" height="16" rx="5" fill="#b9a4ff" stroke="#7a6fd8" stroke-width="1.5"/>` +
          `<rect x="76" y="44" width="10" height="16" rx="5" fill="#b9a4ff" stroke="#7a6fd8" stroke-width="1.5"/>`;
      case "star":
        return `<path transform="translate(72 30) scale(.9)" d="M0 -8 L2.4 -2.5 L8 -2.5 L3.5 1.2 L5 7 L0 3.6 L-5 7 L-3.5 1.2 L-8 -2.5 L-2.4 -2.5 Z" fill="#ffe08a" stroke="#f0b93a" stroke-width="1.2" stroke-linejoin="round"/>`;
      default:
        return "";
    }
  }

  let clipCounter = 0;

  /** Render an avatar as an SVG string. `a` is the stored avatar object; `seed` is used to fill gaps. */
  function render(a, seed, opts) {
    a = normalize(a, seed);
    opts = opts || {};
    const h = a.hair, hd = shade(h, -0.28), skin = a.skin, sd = shade(skin, -0.18);
    const shirt = shade(a.bg, -0.18);
    const size = opts.size ? ` width="${opts.size}" height="${opts.size}"` : "";
    const title = opts.title ? `<title>${String(opts.title).replace(/[<&>"]/g, "")}</title>` : "";
    const winkRight = a.eyes === "wink";
    const clip = "avc" + (++clipCounter);
    return `<svg class="avatar-svg" viewBox="0 0 100 100"${size} xmlns="http://www.w3.org/2000/svg" role="img">${title}` +
      `<clipPath id="${clip}"><circle cx="50" cy="50" r="50"/></clipPath><g clip-path="url(#${clip})">` +
      `<circle cx="50" cy="50" r="50" fill="${a.bg}"/>` +
      accessoryBack(a, h, hd) +
      backHair(a, h, hd) +
      `<path d="M26 100 Q28 80 50 80 Q72 80 74 100 Z" fill="${shirt}"/>` +
      `<path d="M44 74 L44 82 Q50 86 56 82 L56 74 Z" fill="${sd}"/>` +
      `<ellipse cx="50" cy="52" rx="26" ry="25" fill="${skin}" stroke="${sd}" stroke-width="1"/>` +
      `<ellipse cx="35" cy="64" rx="5" ry="3" fill="#ff8fb0" opacity=".45"/>` +
      `<ellipse cx="65" cy="64" rx="5" ry="3" fill="#ff8fb0" opacity=".45"/>` +
      eye(39, 56, a.eyes, a.eye, false) + eye(61, 56, a.eyes, a.eye, winkRight) +
      mouth(a.mouth) +
      bangs(a, h, hd) +
      accessoryFront(a) +
      `</g></svg>`;
  }

  window.Avatar = { render, normalize, randomFor, OPTIONS, LABELS, shade };
})();
