/* ============================================================
   writing-essay-list.js — <writing-essay-list>
   Sidebar that lists every essay in window.WRITING_LIBRARY.
   Emits "essay-select" {index} when an entry is clicked, and
   exposes setActive(index) to highlight the current one.
   Follows UI/page-standard.js (defineComponent + window.wEsc).
   ============================================================ */

class WritingEssayList extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this.activeIndex = -1;
  }

  connectedCallback() {
    this.render();
  }

  render() {
    const lib = window.WRITING_LIBRARY || [];
    const items = lib
      .map(
        (e, i) => `
        <button class="ey" data-idx="${i}">
          <div class="d">${wEsc(e.date)}</div>
          <div class="t">${wEsc(e.title)}</div>
        </button>`
      )
      .join("");

    this.shadowRoot.innerHTML = `
      <style>${window.SHARED_CSS}</style>
      <style>
        :host{display:block;height:100%;overflow-y:auto;scrollbar-width:none;-ms-overflow-style:none;}
        :host::-webkit-scrollbar{width:0;height:0;display:none;}
        .ey{
          display:block;width:100%;text-align:left;background:none;border:none;
          border-bottom:1px solid var(--border);border-left:3px solid transparent;
          padding:12px 16px;color:var(--muted);cursor:pointer;border-radius:0;
          transition:background .12s,color .12s;
        }
        .ey:hover{background:var(--hover);color:var(--text);}
        .ey.active{background:var(--active);color:var(--text);border-left-color:var(--accent);}
        .ey .d{font-size:12px;opacity:.85;}
        .ey .t{font-size:13px;margin-top:3px;line-height:1.4;}
      </style>
      ${items}
    `;

    this.shadowRoot.querySelectorAll(".ey").forEach((b) => {
      b.addEventListener("click", () => {
        const idx = parseInt(b.getAttribute("data-idx"), 10);
        this.dispatchEvent(
          new CustomEvent("essay-select", {
            bubbles: true,
            composed: true,
            detail: { index: idx },
          })
        );
      });
    });
  }

  setActive(index) {
    if (this.activeIndex >= 0) {
      const prev = this.shadowRoot.querySelector('.ey[data-idx="' + this.activeIndex + '"]');
      if (prev) prev.classList.remove("active");
    }
    this.activeIndex = index;
    const cur = this.shadowRoot.querySelector('.ey[data-idx="' + index + '"]');
    if (cur) {
      cur.classList.add("active");
      cur.scrollIntoView({ block: "nearest" });
    }
  }
}

defineComponent("writing-essay-list", WritingEssayList);
