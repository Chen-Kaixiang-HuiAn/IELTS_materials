/* ============================================================
   home/components/portal.js — <hub-page>
   The root-directory facade. Renders a card grid of every subsite
   (Listening / Writing / Speaking / Tutorials) from window.HUB_MODULES.
   Reuses the shared theme (window.SHARED_CSS) and the standard
   component guard (defineComponent). File is loaded from the repo
   ROOT index.html, so paths here are relative to the root.
   ============================================================ */

class HubPage extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
  }

  connectedCallback() {
    const mods = window.HUB_MODULES || [];
    const cards = mods
      .map((m) => {
        const accent = m.accent || "var(--accent)";
        const ready = m.ready !== false;
        if (ready) {
          return `
          <a class="card" href="${window.wEsc(m.href)}" style="--ca:${accent}" tabindex="0">
            <div class="icon" style="background:${accent}22;color:${accent}">${window.wEsc(
            m.icon || "•"
          )}</div>
            <div class="body">
              <div class="title">${window.wEsc(m.title || m.key)}</div>
              <div class="desc">${window.wEsc(m.desc || "")}</div>
            </div>
            <div class="go" style="color:${accent}">进入 →</div>
          </a>`;
        }
        return `
          <div class="card soon" style="--ca:${accent}" aria-disabled="true">
            <div class="icon" style="background:${accent}22;color:${accent}">${window.wEsc(
          m.icon || "•"
        )}</div>
            <div class="body">
              <div class="title">${window.wEsc(m.title || m.key)}</div>
              <div class="desc">${window.wEsc(m.desc || "")}</div>
            </div>
            <div class="badge">即将上线</div>
          </div>`;
      })
      .join("");

    this.shadowRoot.innerHTML = `
      <style>${window.SHARED_CSS}</style>
      <style>
        :host{display:block;height:100vh;height:100dvh;overflow:hidden;}
        .page{height:100vh;height:100dvh;display:flex;flex-direction:column;overflow:hidden;}
        /* 顶栏区 */
        .topbar{flex:none;padding:32px 28px 20px;max-width:1080px;width:100%;margin:0 auto;box-sizing:border-box;display:flex;align-items:flex-start;justify-content:space-between;gap:16px;}
        .brand{display:flex;align-items:center;gap:12px;margin-bottom:6px;}
        .brand h1{font-size:26px;margin:0;letter-spacing:.3px;}
        .tagline{color:var(--muted);font-size:15px;margin:0;}
        /* 右栏内容显示区（唯一可滚动） */
        .content{flex:1;min-height:0;overflow-y:auto;scrollbar-width:thin;scrollbar-color:var(--border) transparent;}
        .content::-webkit-scrollbar{width:10px;}
        .content::-webkit-scrollbar-thumb{background:var(--border);border-radius:5px;}
        .inner{max-width:1080px;margin:0 auto;padding:24px 28px 40px;box-sizing:border-box;}
        .grid{
          display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));
          gap:18px;
        }
        .card{
          display:flex;flex-direction:column;gap:14px;
          padding:22px 22px 18px;border-radius:14px;text-decoration:none;
          background:var(--panel);border:1px solid var(--border);
          transition:transform .15s,border-color .15s,background .15s;
        }
        .card:hover,.card:focus-visible{
          transform:translateY(-3px);border-color:var(--ca);
          background:var(--panel2);outline:none;
        }
        .icon{
          width:48px;height:48px;border-radius:12px;display:flex;
          align-items:center;justify-content:center;font-size:24px;
        }
        .title{font-size:18px;font-weight:700;color:var(--text);}
        .desc{font-size:13.5px;color:var(--muted);line-height:1.7;flex:1;}
        .go{font-size:13px;font-weight:600;opacity:.85;}
        .card.soon{
          cursor:not-allowed;opacity:.62;border-style:dashed;
          background:var(--panel);transform:none;
        }
        .card.soon:hover{border-color:var(--border);background:var(--panel);transform:none;}
        .badge{
          align-self:flex-start;font-size:11px;font-weight:700;color:var(--muted);
          background:var(--panel2);border:1px solid var(--border);border-radius:999px;
          padding:3px 10px;
        }
        /* 页脚区：复用标准 .foot（见 window.SHARED_CSS），此处不再重复 */
        /* ── 移动端：卡片单列、顶栏收紧、字号下调 ── */
        @media (max-width:768px){
          .topbar{padding:18px 16px 12px;flex-direction:column;align-items:stretch;gap:12px;}
          .brand{margin-bottom:0;}
          .brand h1{font-size:21px;}
          .tagline{font-size:13px;}
          .topbar theme-toggle{align-self:flex-end;}
          .inner{padding:16px 16px 32px;}
          .grid{grid-template-columns:1fr;gap:14px;}
          .card{padding:18px 16px 14px;gap:10px;}
          .title{font-size:16px;}
          .desc{font-size:13px;}
          .icon{width:42px;height:42px;font-size:20px;}
        }
      </style>
      <div class="page">
        <header class="topbar">
          <div class="brand">
            <span class="dot"></span>
            <div>
              <h1>IELTS Materials</h1>
              <p class="tagline">一套雅思备考材料 · 听力 / 写作 / 口语 / 教程 统一入口</p>
            </div>
          </div>
          <theme-toggle></theme-toggle>
        </header>
        <main class="content"><div class="inner"><div class="grid">${cards}</div></div></main>
        <footer class="foot">Built by <span class="name">Chen Kaixiang</span>, ${new Date().getFullYear()}</footer>
      </div>
    `;
  }
}

defineComponent("hub-page", HubPage);
