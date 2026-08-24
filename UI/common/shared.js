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
