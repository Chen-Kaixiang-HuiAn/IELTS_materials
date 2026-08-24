/* ============================================================
   common/components/theme-toggle.js — <theme-toggle>
   A small button that flips the page between dark and light theme.
   It reads window.getTheme() for the current state and calls
   window.toggleTheme() on click. The actual recolouring is handled
   globally by shared.js (tokens on :root[data-theme]), so this
   component only needs to show the right icon/label and react.
   ============================================================ */

class ThemeToggle extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
  }

  connectedCallback() {
    this.shadowRoot.innerHTML = `
      <style>${window.SHARED_CSS}</style>
      <style>
        :host{display:inline-block;}
        button{
          display:inline-flex;align-items:center;gap:6px;
          padding:6px 12px;font-size:13px;line-height:1;white-space:nowrap;
        }
        .ico{font-size:15px;line-height:1;}
      </style>
      <button type="button" title="切换明暗主题" aria-label="切换明暗主题">
        <span class="ico"></span><span class="lbl"></span>
      </button>
    `;
    this.btn = this.shadowRoot.querySelector("button");
    this.ico = this.shadowRoot.querySelector(".ico");
    this.lbl = this.shadowRoot.querySelector(".lbl");
    this.btn.addEventListener("click", () => window.toggleTheme());
    this._render();
    this._onChange = () => this._render();
    window.addEventListener("themechange", this._onChange);
  }

  disconnectedCallback() {
    if (this._onChange) window.removeEventListener("themechange", this._onChange);
  }

  _render() {
    const dark = window.getTheme() === "dark";
    this.ico.textContent = dark ? "🌙" : "☀️";
    this.lbl.textContent = dark ? "暗色" : "亮色";
  }
}

defineComponent("theme-toggle", ThemeToggle);
