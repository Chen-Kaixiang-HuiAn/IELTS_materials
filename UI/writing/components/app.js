/* ============================================================
   writing-app.js
   - Registers <writing-app>, the controller for the Writing page.
   - Owns the layout (topbar + sidebar + viewer) and wires the
     sidebar (<writing-essay-list>) to the reader (<writing-reader>).
   - Reuses window.SHARED_CSS for the theme; the essay markdown
     renderer and styles live in writing-reader.js.
   ============================================================ */

class WritingApp extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this.idx = -1;
  }

  connectedCallback() {
    this.lib = window.WRITING_LIBRARY || [];

    this.shadowRoot.innerHTML = `
      <style>${window.SHARED_CSS}</style>
      <style>
        .app{display:flex;flex-direction:column;height:100vh;height:100dvh;overflow:hidden;background:var(--bg);}
        .topbar{
          flex:none;display:flex;align-items:center;justify-content:space-between;
          padding:14px 20px;border-bottom:1px solid var(--border);background:var(--panel);
        }
        .brand{font-weight:700;font-size:16px;letter-spacing:.3px;}
        .brand .dot{color:var(--accent);}
        .menu-btn{display:none;flex:none;width:38px;height:34px;font-size:17px;margin-right:10px;}
        .topright{display:flex;flex-direction:column;align-items:flex-end;gap:8px;}
        .hint{color:var(--muted);font-size:12px;}
        .body{flex:1;display:flex;min-height:0;position:relative;}
        .sidebar{width:300px;flex:none;border-right:1px solid var(--border);background:var(--panel);overflow-y:auto;scrollbar-width:thin;scrollbar-color:var(--border) transparent;}
        .sidebar::-webkit-scrollbar{width:8px;}
        .sidebar::-webkit-scrollbar-thumb{background:var(--border);border-radius:4px;}
        .main{flex:1;display:flex;flex-direction:column;min-width:0;overflow:hidden;}
        .backdrop{display:none;position:absolute;inset:0;background:rgba(0,0,0,.45);z-index:5;}
        .vbar{
          display:flex;align-items:center;justify-content:space-between;
          padding:12px 20px;border-bottom:1px solid var(--border);background:var(--panel);gap:12px;
        }
        .vbar .ttl{font-weight:600;font-size:15px;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
        .nav{display:flex;gap:8px;flex:none;}
        .nav button{padding:6px 12px;font-size:13px;}
        .foot{
          border-top:1px solid var(--border);background:var(--panel);
          color:var(--muted);font-size:12.5px;text-align:center;padding:14px 20px;
        }
        .foot .name{color:var(--text);font-weight:600;}
        /* ── 移动端：左栏改为抽屉 ── */
        @media (max-width:768px){
          .menu-btn{display:inline-flex;align-items:center;justify-content:center;}
          .hint{display:none;}
          .body{position:relative;}
          .sidebar{
            position:absolute;top:0;left:0;bottom:0;z-index:10;
            width:82%;max-width:340px;
            transform:translateX(-100%);
            transition:transform .22s ease;
            box-shadow:4px 0 24px rgba(0,0,0,.4);
          }
          .app.nav-open .sidebar{transform:none;}
          .app.nav-open .backdrop{display:block;}
        }
      </style>
      <div class="app">
        <header class="topbar">
          <div class="brand"><button class="menu-btn" id="menu" title="目录" aria-label="目录">☰</button><span class="dot">●</span> IELTS Writing</div>
          <div class="topright">
            <div class="hint">← → 切换范文 · 滚轮阅读</div>
            <theme-toggle></theme-toggle>
          </div>
        </header>
        <div class="body">
          <div class="backdrop" id="backdrop"></div>
          <aside class="sidebar"><writing-essay-list></writing-essay-list></aside>
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

    this.listEl = this.shadowRoot.querySelector("writing-essay-list");
    this.readerEl = this.shadowRoot.querySelector("#reader");
    this.ttlEl = this.shadowRoot.querySelector("#ttl");

    // Mobile drawer: open/close the sidebar, close on backdrop or selection.
    this._appEl = this.shadowRoot.querySelector(".app");
    this.shadowRoot.querySelector("#menu").addEventListener("click", () =>
      this._appEl.classList.toggle("nav-open")
    );
    this.shadowRoot.querySelector("#backdrop").addEventListener("click", () =>
      this._appEl.classList.remove("nav-open")
    );

    this.listEl.addEventListener("essay-select", (e) => {
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
    this.listEl.setActive(i);
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
