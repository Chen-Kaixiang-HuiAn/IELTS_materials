/* ============================================================
   track-list.js — <track-list>
   Collapsible Cambridge 14–21 → Test → Section tree.
   Emits "track-select" {index, file, title} on click.
   ============================================================ */

function esc(s) {
  return String(s).replace(/[&<>"]/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])
  );
}

class TrackList extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this.activeIndex = -1;
    this.flat = [];
  }

  connectedCallback() {
    this.render();
  }

  render() {
    const lib = window.AUDIO_LIBRARY || [];
    this.flat = window.buildAudioFlat(lib);

    const flatByFile = {};
    this.flat.forEach((t) => (flatByFile[t.file] = t.index));

    const bookHtml = lib
      .map((book, bi) => {
        const testHtml = (book.tests || [])
          .map((test, ti) => {
            const secHtml = (test.sections || [])
              .map((sec) => {
                const idx = flatByFile[sec.file];
                return `<div class="sec" data-idx="${idx}" data-file="${esc(
                  sec.file
                )}" data-title="${esc(sec.title)}">
                  <span class="sec-no">S${sec.section}</span>
                  <span class="sec-name">${esc(sec.title)}</span>
                </div>`;
              })
              .join("");
            return `<div class="test" data-open="0">
                <div class="test-head"><span class="caret">▸</span>${esc(
                  test.title
                )}</div>
                <div class="test-body">${secHtml}</div>
              </div>`;
          })
          .join("");
        return `<div class="book" data-open="1">
            <div class="book-head"><span class="caret">▾</span>${esc(
              book.title
            )}</div>
            <div class="book-body">${testHtml}</div>
          </div>`;
      })
      .join("");

    this.shadowRoot.innerHTML = `
      <style>${window.SHARED_CSS}</style>
      <style>
        :host{display:block;padding:8px 6px 24px;}
        .book-head,.test-head{
          display:flex;align-items:center;gap:6px;padding:8px 10px;
          cursor:pointer;border-radius:8px;user-select:none;font-weight:600;
        }
        .book-head{font-size:14px;}
        .test-head{font-size:13px;color:var(--muted);font-weight:600;padding-left:18px;}
        .caret{display:inline-block;width:12px;color:var(--accent);transition:transform .15s;}
        .book[data-open="0"] > .book-head .caret,
        .test[data-open="0"] > .test-head .caret{transform:rotate(-90deg);}
        .book-body,.test-body{overflow:hidden;}
        .book[data-open="0"] > .book-body,
        .test[data-open="0"] > .test-body{display:none;}
        .sec{
          display:flex;align-items:center;gap:8px;padding:7px 10px 7px 40px;
          border-radius:8px;cursor:pointer;color:var(--text);font-size:13px;
        }
        .sec:hover{background:var(--hover);}
        .sec.active{background:var(--active);color:#fff;}
        .sec.active .sec-no{background:var(--accent);color:#06211e;}
        .sec-no{
          flex:none;font-size:11px;font-weight:700;color:var(--accent);
          background:var(--panel2);border-radius:6px;padding:2px 6px;min-width:30px;text-align:center;
        }
        .sec-name{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
      </style>
      ${bookHtml}
    `;

    // Toggle expand/collapse
    this.shadowRoot.querySelectorAll(".book-head").forEach((h) => {
      h.addEventListener("click", () =>
        this._toggle(h.parentElement, "book")
      );
    });
    this.shadowRoot.querySelectorAll(".test-head").forEach((h) => {
      h.addEventListener("click", () =>
        this._toggle(h.parentElement, "test")
      );
    });

    // Section click → play
    this.shadowRoot.querySelectorAll(".sec").forEach((el) => {
      el.addEventListener("click", () => {
        const idx = parseInt(el.getAttribute("data-idx"), 10);
        this.dispatchEvent(
          new CustomEvent("track-select", {
            bubbles: true,
            composed: true,
            detail: {
              index: idx,
              file: el.getAttribute("data-file"),
              title: el.getAttribute("data-title"),
            },
          })
        );
      });
    });
  }

  _toggle(node, kind) {
    const open = node.getAttribute("data-open") === "1" ? "0" : "1";
    node.setAttribute("data-open", open);
  }

  setActive(index) {
    if (this.activeIndex >= 0) {
      const prev = this.shadowRoot.querySelector(
        '.sec[data-idx="' + this.activeIndex + '"]'
      );
      if (prev) prev.classList.remove("active");
    }
    this.activeIndex = index;
    const cur = this.shadowRoot.querySelector(
      '.sec[data-idx="' + index + '"]'
    );
    if (cur) {
      cur.classList.add("active");
      // ensure ancestors expanded
      let p = cur.parentElement; // .test-body
      while (p && p !== this.shadowRoot) {
        if (p.classList && p.classList.contains("test"))
          p.setAttribute("data-open", "1");
        if (p.classList && p.classList.contains("book"))
          p.setAttribute("data-open", "1");
        p = p.parentElement;
      }
      cur.scrollIntoView({ block: "nearest" });
    }
  }
}

customElements.define("track-list", TrackList);
