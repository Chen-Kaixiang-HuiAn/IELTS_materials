/* ============================================================
   writing-app.js
   - Registers <writing-app>, the controller for the Writing page.
   - Owns the layout (topbar + sidebar + viewer) and wires the
     sidebar (<standard-nav>) to the reader (<writing-reader>).
   - Reuses window.SHARED_CSS for the layout + the standard left-nav
     provided by UI/common/components/standard-nav.js.
   ============================================================ */

// Build the left-nav tree from the writing library. A single section
// "范文" lists every essay as a leaf; the leaf index matches the
// manifest order, so this.lib[index] is the selected essay.
function buildWritingTree(lib) {
  return [
    {
      label: "范文",
      open: 1,
      children: (lib || []).map((e) => ({
        label: e.title,
        data: { file: e.file, title: e.title, date: e.date },
      })),
    },
  ];
}

class WritingApp extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this.idx = -1;
  }

  connectedCallback() {
    this.lib = window.WRITING_LIBRARY || [];
    // All chrome + nav styling comes from window.SHARED_CSS (the standard).
    this.shadowRoot.innerHTML = `
      <style>${window.SHARED_CSS}</style>
      <div class="app">
        <header class="topbar">
          <div class="brand"><button class="menu-btn" id="menu" title="目录" aria-label="目录">☰</button><span class="dot"></span> IELTS Writing</div>
          <div class="topright">
            <div class="hint">← → 切换范文 · 滚轮阅读</div>
            <theme-toggle></theme-toggle>
          </div>
        </header>
        <div class="body">
          <div class="backdrop" id="backdrop"></div>
          <aside class="sidebar"><standard-nav id="nav"></standard-nav></aside>
          <main class="main">
            <div class="vbar">
              <div class="ttl" id="ttl">范文精读</div>
              <div class="nav">
                <button id="prev">← 上一篇</button>
                <button id="next">下一篇 →</button>
              </div>
            </div>
            <writing-reader id="reader"></writing-reader>
          </main>
        </div>
        <footer class="foot">Built by <span class="name">Chen Kaixiang</span>, ${new Date().getFullYear()}</footer>
      </div>
    `;

    this.navEl = this.shadowRoot.querySelector("#nav");
    this.readerEl = this.shadowRoot.querySelector("#reader");
    this.ttlEl = this.shadowRoot.querySelector("#ttl");

    this.navEl.setTree(buildWritingTree(this.lib));

    // Mobile drawer: open/close the sidebar, close on backdrop or selection.
    this._appEl = this.shadowRoot.querySelector(".app");
    this.shadowRoot.querySelector("#menu").addEventListener("click", () =>
      this._appEl.classList.toggle("nav-open")
    );
    this.shadowRoot.querySelector("#backdrop").addEventListener("click", () =>
      this._appEl.classList.remove("nav-open")
    );

    this.navEl.addEventListener("std-nav-select", (e) => {
      this._appEl.classList.remove("nav-open");
      this.select(e.detail.index);
    });
    this.shadowRoot.querySelector("#prev").addEventListener("click", () => this.step(-1));
    this.shadowRoot.querySelector("#next").addEventListener("click", () => this.step(1));

    document.addEventListener("keydown", (e) => this.onKey(e));

    // Land on the first essay so the page isn't empty on load.
    if (this.lib.length) this.select(0);
  }

  select(i) {
    const e = this.lib[i];
    if (!e) return;
    this.idx = i;
    this.ttlEl.textContent = e.title;
    this.readerEl.loadEssay(e);
    this.navEl.setActive(i);
  }

  step(dir) {
    const n = this.idx + dir;
    if (n >= 0 && n < this.lib.length) this.select(n);
  }

  onKey(e) {
    if (e.target && /INPUT|TEXTAREA/.test(e.target.tagName)) return;
    if (e.key === "ArrowLeft") { e.preventDefault(); this.step(-1); }
    else if (e.key === "ArrowRight") { e.preventDefault(); this.step(1); }
  }
}

defineComponent("writing-app", WritingApp);
