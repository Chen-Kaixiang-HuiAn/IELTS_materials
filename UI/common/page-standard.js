/* ============================================================
   UI/common/page-standard.js  —  THE STANDARD for every subsite page.

   Load this FIRST (right after <link> to ui-base.css) in any
   subsite index.html. It defines the shared conventions every
   page must follow so Listening / Writing / future sections look
   and behave identically.

   ── Directory layout (common + per-type) ──
   UI/ is split into a shared core ("common") and one folder per
   page type (listening/, writing/, …). The common/ folder holds
   everything identical across pages (the standard itself, the theme,
   the global base styles). Each type folder holds that page's own
   data, controller and feature components — so every page keeps the
   same skeleton but ships only its own functionality.

     UI/
       common/
         page-standard.js      ← this file (standard + defineComponent + wEsc)
         shared.js             ← theme tokens on :root[data-theme] + window.SHARED_CSS + setTheme/getTheme/initTheme
         components/
           theme-toggle.js     ← <theme-toggle> dark/light switch button (shared)
         styles/ui-base.css    ← global + host rules (listening-app / writing-app / hub-page)
       listening/              ← listening-only
         manifest.js           ← window.AUDIO_LIBRARY
         boot.js               ← entry logging (optional)
         components/
           app.js              ← <listening-app> controller
           track-list.js       ← <listening-track-list>
           player.js           ← <listening-player>
       writing/                ← writing-only
         manifest.js           ← window.WRITING_LIBRARY
         components/
           app.js              ← <writing-app>
           essay-list.js       ← <writing-essay-list>
           reader.js           ← <writing-reader>
       home/                   ← root-directory facade (hub portal)
         manifest.js           ← window.HUB_MODULES (subsite entry cards)
         components/
           portal.js           ← <hub-page> card grid
       tools/                  ← manifest generators (dev-only, not loaded by pages)

   ── Path convention (NO <base> tag anywhere) ──
   Every subsite (Listening-audios/, Writing-examples/, …) lives in
   a subfolder of the repo root. From inside that folder, reach the
   shared UI with a single "../UI/..." hop, then common/ or <type>/:
       ../UI/common/shared.js
       ../UI/common/styles/ui-base.css
       ../UI/<type>/manifest.js
       ../UI/<type>/components/*.js
   Module-local assets (e.g. Writing-examples/Task1_img/...) stay
   relative to the page and are never touched by the "../" hop.
   We deliberately avoid <base href="..">: it would rewrite the
   essay images' "./Task1_img/..." paths and break them.

   ── Script load order (identical skeleton in every page) ──
     1. UI/common/page-standard.js      (standard: defineComponent, wEsc)
     2. UI/common/shared.js             (theme: window.SHARED_CSS)
     3. UI/<type>/manifest.js           (data: window.<TYPE>_LIBRARY)
     4. UI/<type>/components/*.js        (sub-components, any order)
     5. UI/<type>/components/app.js      (the controller <type-app>)
     6. (optional) UI/<type>/boot.js     (entry logging)

   ── Page layout: four pinned regions, isolated scrolling ──
   Every subsite page is a fixed full-viewport layout (root component
   sets height:100vh;overflow:hidden via ui-base.css). Inside its shadow
   root it stacks FOUR regions and ONLY the content region scrolls:
     ① top bar   — flex:none, pinned
     ② left nav  — flex:none, its OWN overflow-y:auto (scrolls independently)
     ③ right content — flex:1;min-height:0;overflow:hidden; the inner
                       viewer/reader scrolls on its own (no page-level scroll)
     ④ footer     — flex:none, pinned at the bottom, never pushes content
   This keeps the footer from lengthening the page and stops the top
   bar / sidebar / content from scrolling each other.

   ── Footer (embedded, NOT a separate element) ──
   The "Built by Chen Kaixiang, <year>" footer is the ④ footer region
   above, rendered INSIDE the root component's shadow root as the last
   child of the top-level .app / .page container. The year comes from
   new Date().getFullYear(). It is part of the page, not a standalone tag.

   ── Mobile layout (off-canvas left nav) ──
   The fixed four-region layout is DESKTOP-first. On narrow viewports
   (≤768px) the ② left nav must NOT stay as a 300px in-flow column — it
   would crush the content. Standard mobile pattern used here:
     • The top bar shows a ☰ .menu-btn (display:none on desktop, inline
       on mobile) that toggles `.app.nav-open` on the root container.
     • `.body` is position:relative; `.sidebar` becomes position:absolute,
       full-height, width ~82% (max 340px), translated off-screen
       (translateX(-100%)) and slides in when `.app.nav-open` is set;
       a `.backdrop` (absolute, inset:0, dimmed) appears at the same time.
     • Selecting an item or tapping the backdrop removes `.nav-open`.
     • The ③④ content/footer keep their pinned behaviour; the content
       region simply gets the full width (the sidebar no longer takes flex
       space because it is absolutely positioned).
   The <hub-page> (portal) has no left nav, so on mobile it just switches
   its card grid to a single column and tightens the top bar — no drawer.
   Player / reader controls get a @media block so they wrap instead of
   overflowing. Keep the breakpoint at 768px across all pages for a
   consistent experience.

   ── Theme (dark / light toggle) ──
   Colour tokens are defined ONCE on :root[data-theme] in shared.js and
   inherit across shadow boundaries, so every component's var(--bg) etc.
   follows the page theme with zero per-component code. Every index.html
   calls window.initTheme() right after loading shared.js (applies the
   saved theme or defaults to dark, and injects the :root token styles).
   The <theme-toggle> button (UI/common/components/theme-toggle.js) flips
   the theme via window.toggleTheme(); the choice persists in localStorage
   and a "themechange" event lets any component react. Drop
   <theme-toggle></theme-toggle> into a page's top bar to expose the switch.

   ── Component registration ──
   Every component file calls defineComponent(name, Class) — a guarded
   customElements.define that silently no-ops if already defined (e.g.
   when page-standard.js is loaded twice or in a test harness).

   ── Sidebar scrollbar ──
   Sidebars hide the scrollbar (scrollbar-width:none) but keep wheel
   scrolling. Content viewers may show a thin scrollbar.
   ============================================================ */

// Guard so re-loading this file (or loading it in jsdom tests) is safe.
if (typeof window === "undefined") {
  // Running under Node (test harness): export for require().
  if (typeof module !== "undefined" && module.exports) {
    module.exports = {};
  }
}

// Shared HTML-escape helper (single source of truth).
window.wEsc = function (s) {
  return String(s).replace(/[&<>"]/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])
  );
};

// Guarded custom element registration used by every component file.
window.defineComponent = function (name, cls) {
  if (!window.customElements) return;
  if (window.customElements.get(name)) return; // already defined
  window.customElements.define(name, cls);
};
