/* ============================================================
   shared.js — UI-wide base styles and theme tokens.
   Defines window.SHARED_CSS (injected into every component shadow
   root) and the theme system (window.setTheme / getTheme / initTheme).

   Theme strategy: colour tokens live on :root[data-theme=...] as CSS
   custom properties. Because custom properties inherit ACROSS shadow
   boundaries, every component's `var(--bg)` etc. resolves to the page
   theme automatically — no per-component theme code needed. Switching
   the theme is just flipping document.documentElement.dataset.theme.
   ============================================================ */

// Dark theme is the default. Light is an opt-in override.
// Accent: blue-violet gradient mix (no green).
const THEME_DARK = `
  --bg:#0f1419; --panel:#161c24; --panel2:#1d2530; --border:#2a323d;
  --text:#e6edf3; --muted:#8b97a5;
  --accent:#7b8cff; --accent2:#9b6cff;
  --accent-grad:linear-gradient(135deg,#5b6cff 0%,#9b6cff 100%);
  --on-accent:#ffffff;
  --hover:#222c38; --active:#2a2350; --danger:#e57373;
`;
const THEME_LIGHT = `
  --bg:#f4f6f9; --panel:#ffffff; --panel2:#eef1f5; --border:#d7dde5;
  --text:#1c2530; --muted:#5b6776;
  --accent:#5b54e6; --accent2:#7b3ff2;
  --accent-grad:linear-gradient(135deg,#5b6cff 0%,#9b6cff 100%);
  --on-accent:#ffffff;
  --hover:#e4e9ef; --active:#e7e2fb; --danger:#c0392b;
`;

// Injected once into <head>; defines tokens per theme on :root.
function injectThemeStyle() {
  if (typeof document === "undefined") return;
  if (document.getElementById("ielts-theme")) return;
  const style = document.createElement("style");
  style.id = "ielts-theme";
  style.textContent =
    `:root[data-theme="dark"]{${THEME_DARK}}\n` +
    `:root[data-theme="light"]{${THEME_LIGHT}}\n` +
    `:root{color-scheme:dark;}\n` +
    `:root[data-theme="light"]{color-scheme:light;}`;
  document.head.appendChild(style);
}

// SHARED_CSS references tokens via var(...); values are inherited from
// :root, so the same string works under both themes. Kept inside the
// shadow root so button/input defaults also resolve tokens.
window.SHARED_CSS = `
:host{
  display:block; box-sizing:border-box; color:var(--text);
  font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"PingFang SC","Microsoft YaHei",sans-serif;
}
*{box-sizing:border-box;}
button{
  font-family:inherit; color:var(--text); background:var(--panel2);
  border:1px solid var(--border); border-radius:8px; cursor:pointer;
  transition:background .15s,border-color .15s,transform .05s;
}
button:hover{background:var(--hover);}
button:active{transform:translateY(1px);}
button:focus-visible{outline:2px solid var(--accent); outline-offset:1px;}
input[type=range]{accent-color:var(--accent); cursor:pointer;}

/* ============================================================
   STANDARD PAGE CHROME + LEFT-NAV + CONTENT TYPOGRAPHY
   (the concrete code behind UI/common/page-standard.js)

   Every subsite page is built from these classes. They are injected
   wherever window.SHARED_CSS is used (every shadow root), so a single
   change here propagates to Listening / Writing / Tutorials / Hub alike.
   The four-region layout (top bar / left nav / right content / footer)
   is desktop-first; ≤768px collapses the left nav into an off-canvas
   drawer via .app.nav-open.

   ── Layout primitives ──
   .app          root: full-viewport column, only the content scrolls
   .topbar       pinned top strip with brand + right slot
   .sidebar      left nav column (scrollbar hidden, wheel still works)
   .main/.stage  right-side content column (inner .scroll scrolls)
   .footer       pinned bottom strip (Built by …)
   .menu-btn     hamburger, shown ≤768px to open the drawer
   .backdrop     dim layer behind the open drawer

   ── Standard left-nav tree (.nav-tree) ──
   <standard-nav> renders this; collapsible groups with caret, leaf
   pages with an optional badge and an accent-gradient active pill.

   ── Standard content (.essay) ──
   Markdown output typography shared by Writing-reader and Tutorials.
   ============================================================ */
/* ── four-region page skeleton ── */
.app{display:flex;flex-direction:column;height:100vh;height:100dvh;overflow:hidden;background:var(--bg);}
.topbar{
  flex:none;display:flex;align-items:center;justify-content:space-between;
  padding:14px 20px;border-bottom:1px solid var(--border);background:var(--panel);
}
.brand{font-weight:700;font-size:16px;letter-spacing:.3px;display:flex;align-items:center;gap:10px;}
.brand .dot{width:10px;height:10px;border-radius:50%;background:var(--accent-grad);flex:none;}
.brand h1{font-size:16px;margin:0;font-weight:700;letter-spacing:.3px;}
.topright{display:flex;flex-direction:column;align-items:flex-end;gap:8px;}
.hint{color:var(--muted);font-size:12px;}
.body{flex:1;display:flex;min-height:0;position:relative;}
.sidebar{
  width:300px;flex:none;border-right:1px solid var(--border);background:var(--panel);
  overflow-y:auto;scrollbar-width:none;-ms-overflow-style:none;
}
.sidebar::-webkit-scrollbar{width:0;height:0;display:none;}
.main{flex:1;display:flex;flex-direction:column;min-width:0;overflow:hidden;}
.stage{flex:1;display:flex;flex-direction:column;min-width:0;overflow:hidden;}
.backdrop{display:none;position:absolute;inset:0;background:rgba(0,0,0,.45);z-index:5;}
.menu-btn{
  display:none;flex:none;width:38px;height:34px;font-size:17px;margin-right:10px;
  border:1px solid var(--border);background:var(--panel2);color:var(--text);
  border-radius:8px;cursor:pointer;align-items:center;justify-content:center;
}
.vbar{
  display:flex;align-items:center;justify-content:space-between;gap:12px;
  padding:12px 20px;border-bottom:1px solid var(--border);background:var(--panel);flex:none;
}
.vbar .ttl{font-weight:600;font-size:15px;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.vbar .crumb{color:var(--muted);font-size:12px;margin-right:8px;}
.nav{display:flex;gap:8px;flex:none;}
.nav button{padding:6px 12px;font-size:13px;}
.foot{
  flex:none;border-top:1px solid var(--border);background:var(--panel);
  color:var(--muted);font-size:12.5px;text-align:center;padding:14px 20px;
}
.foot .name{color:var(--text);font-weight:600;}
.scroll{flex:1;min-height:0;overflow-y:auto;scrollbar-width:thin;scrollbar-color:var(--border) transparent;}
.scroll::-webkit-scrollbar{width:10px;}
.scroll::-webkit-scrollbar-thumb{background:var(--border);border-radius:5px;}
.empty{padding:60px 20px;text-align:center;color:var(--muted);}
.stage-empty{flex:1;display:flex;align-items:center;justify-content:center;color:var(--muted);font-size:15px;padding:24px;text-align:center;}

/* ── standard left-nav tree (rendered by <standard-nav>) ── */
.nav-tree{padding:8px 6px 24px;}
.nav-group[data-open="0"] > .nav-group-body{display:none;}
.nav-group-head{
  display:flex;align-items:center;gap:7px;padding:9px 12px;border-radius:8px;
  cursor:pointer;user-select:none;font-weight:600;line-height:1.3;color:var(--text);
}
.nav-group-head .lbl{font-size:14px;}
.nav-group-head.sub{color:var(--muted);padding-left:18px;}
.nav-group-head.sub .lbl{font-size:13px;}
.caret{display:inline-block;width:12px;flex:none;color:var(--accent);transition:transform .15s;font-size:11px;}
.nav-group[data-open="0"] > .nav-group-head .caret{transform:rotate(-90deg);}
.nav-group-body{padding-left:12px;overflow:hidden;}
.nav-leaf{
  display:flex;align-items:center;gap:8px;width:100%;text-align:left;
  border:none;background:none;color:var(--text);font-size:13.5px;
  padding:7px 12px;border-radius:8px;cursor:pointer;white-space:nowrap;
  overflow:hidden;text-overflow:ellipsis;
}
.nav-leaf:hover{background:var(--hover);}
.nav-leaf .badge{
  flex:none;font-size:11px;font-weight:700;color:var(--accent);
  background:var(--panel2);border-radius:6px;padding:2px 6px;min-width:26px;text-align:center;
}
.nav-leaf .label{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.nav-leaf.on{background-image:var(--accent-grad);background-color:transparent;color:var(--on-accent);font-weight:600;}
.nav-leaf.on .badge{background:rgba(255,255,255,.22);color:var(--on-accent);}

/* ── standard content typography (.essay) ── */
.essay{max-width:920px;margin:0 auto;padding:28px 36px;line-height:1.8;font-size:15px;color:var(--text);}
.essay h1{font-size:24px;margin:0 0 18px;}
.essay h2{font-size:20px;border-bottom:1px solid var(--border);padding-bottom:6px;margin:30px 0 14px;color:var(--accent);}
.essay h3{font-size:17px;margin:24px 0 10px;color:var(--text);}
.essay h4{font-size:15px;margin:18px 0 8px;color:var(--text);}
.essay p{margin:10px 0;}
.essay ul,.essay ol{margin:10px 0;padding-left:22px;}
.essay li{margin:4px 0;}
.essay blockquote{margin:12px 0;padding:10px 16px;border-left:3px solid var(--accent);background:var(--panel);color:var(--muted);border-radius:0 6px 6px 0;}
.essay code{background:var(--panel2);padding:2px 6px;border-radius:4px;font-family:ui-monospace,Menlo,Consolas,monospace;font-size:13px;color:var(--accent);}
.essay pre{background:var(--panel2);padding:14px 16px;border-radius:8px;overflow-x:auto;border:1px solid var(--border);}
.essay pre code{background:none;padding:0;color:var(--text);}
.essay table{border-collapse:collapse;width:100%;margin:14px 0;font-size:14px;}
.essay th,.essay td{border:1px solid var(--border);padding:8px 12px;text-align:left;vertical-align:top;}
.essay th{background:var(--panel2);font-weight:600;}
.essay tr:nth-child(even) td{background:rgba(255,255,255,.02);}
.essay img{max-width:100%;border:1px solid var(--border);border-radius:8px;margin:12px 0;display:block;background:#fff;}
.essay .imgwrap{display:block;background:#fff;border:1px solid var(--border);border-radius:8px;margin:12px 0;padding:10px;text-align:center;}
.essay .imgwrap img{border:none;border-radius:0;margin:0;display:inline-block;max-width:100%;background:#fff;}
.essay a{color:var(--accent);}
.essay hr{border:none;border-top:1px solid var(--border);margin:24px 0;}

/* ── mobile drawer (≤768px) ── */
@media (max-width:768px){
  .menu-btn{display:inline-flex;}
  .hint{display:none;}
  .body{position:relative;}
  .sidebar{
    position:absolute;top:0;left:0;bottom:0;z-index:10;width:82%;max-width:340px;
    transform:translateX(-100%);transition:transform .22s ease;box-shadow:4px 0 24px rgba(0,0,0,.4);
  }
  .app.nav-open .sidebar{transform:none;}
  .app.nav-open .backdrop{display:block;}
  .essay{padding:22px 18px;}
  .essay h1{font-size:20px;margin:0 0 14px;}
  .essay h2{font-size:17px;margin:24px 0 12px;}
  .essay h3{font-size:16px;}
  .essay table{font-size:13px;}
  .essay th,.essay td{padding:6px 9px;}
}
`;

window.__IELTS_THEME_KEY__ = "ielts-theme";

window.getTheme = function () {
  return (document.documentElement.dataset.theme || "dark");
};

window.setTheme = function (theme) {
  if (theme !== "light" && theme !== "dark") theme = "dark";
  document.documentElement.dataset.theme = theme;
  try { localStorage.setItem(window.__IELTS_THEME_KEY__, theme); } catch (e) {}
  window.dispatchEvent(new CustomEvent("themechange", { detail: { theme } }));
  return theme;
};

window.toggleTheme = function () {
  return window.setTheme(window.getTheme() === "dark" ? "light" : "dark");
};

// Apply the saved (or default) theme as early as possible.
window.initTheme = function () {
  injectThemeStyle();
  let saved = "dark";
  try { saved = localStorage.getItem(window.__IELTS_THEME_KEY__) || "dark"; } catch (e) {}
  if (saved !== "light" && saved !== "dark") saved = "dark";
  document.documentElement.dataset.theme = saved;
};
