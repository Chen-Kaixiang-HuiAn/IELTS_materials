/* ============================================================
   standard-nav.js — <standard-nav>
   THE shared left-nav for every subsite (Listening / Writing /
   Tutorials). Replaces the old per-type nav components so all pages
   share ONE identical left-nav style (the page standard).

   Data model — a recursive tree of nodes. A node is either:
     • group : { label, children:[node...], open?:0|1 }
     • leaf  : { label, badge?:string, data?:any }
   The top-level array is the list of sections. Every leaf is assigned
   a global `__idx` (for prev/next) and a `__path` (label trail, for
   breadcrumbs) during setTree().

   Visuals come from window.SHARED_CSS (.nav-tree / .nav-group* /
   .nav-leaf* / .caret) — see UI/common/page-standard.js.

   API
     nav.setTree(nodes)        build/rebuild the tree
     nav.setActive(index)      highlight a leaf + expand its ancestors
     nav.addEventListener('std-nav-select', e =>
        e.detail = { index, node })   // node carries .data and .__path
   ============================================================ */

class StandardNav extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._tree = [];
    this._leaves = [];
    this._active = -1;
  }

  connectedCallback() {
    if (this._tree.length) this.render();
  }

  // Assign each leaf a global index + path; store a flat lookup.
  _indexLeaves() {
    this._leaves = [];
    let i = 0;
    const walk = (nodes, path) => {
      (nodes || []).forEach((n) => {
        const p = path.concat(n.label || "");
        if (n.children && n.children.length) {
          walk(n.children, p);
        } else {
          n.__idx = i++;
          n.__path = p;
          this._leaves.push(n);
        }
      });
    };
    walk(this._tree, []);
  }

  setTree(nodes) {
    this._tree = nodes || [];
    this._indexLeaves();
    this.render();
  }

  _leafByIndex(i) {
    return this._leaves[i];
  }

  // Public: get a leaf node (carries .data and .__path) by global index.
  getLeaf(i) {
    return this._leaves[i];
  }

  render() {
    const esc = window.wEsc;
    const html = [`<style>${window.SHARED_CSS}</style><div class="nav-tree">`];

    const walk = (nodes, depth) => {
      (nodes || []).forEach((n) => {
        const isGroup = n.children && n.children.length;
        if (isGroup) {
          const open = n.open === 0 || n.open === "0" ? "0" : "1";
          html.push(
            '<div class="nav-group" data-open="' + open + '">' +
              '<div class="nav-group-head' + (depth > 0 ? " sub" : "") + '">' +
                '<span class="caret">▾</span><span class="lbl">' + esc(n.label || "") + "</span>" +
              "</div>" +
              '<div class="nav-group-body">'
          );
          walk(n.children, depth + 1);
          html.push("</div></div>");
        } else {
          const idx = n.__idx != null ? n.__idx : "";
          const on = this._active === idx ? " on" : "";
          const badge =
            n.badge != null && n.badge !== ""
              ? '<span class="badge">' + esc(String(n.badge)) + "</span>"
              : "";
          html.push(
            '<button class="nav-leaf' + on + '" data-i="' + idx + '">' +
              badge +
              '<span class="label">' + esc(n.label || "") + "</span>" +
            "</button>"
          );
        }
      });
    };
    walk(this._tree, 0);

    html.push("</div>");
    this.shadowRoot.innerHTML = html.join("");

    // collapse / expand on group-header click
    this.shadowRoot.querySelectorAll(".nav-group-head").forEach((h) => {
      h.addEventListener("click", () => {
        const g = h.parentElement;
        const cur = g.getAttribute("data-open") === "1" ? "0" : "1";
        g.setAttribute("data-open", cur);
      });
    });
    // leaf click → select
    this.shadowRoot.querySelectorAll(".nav-leaf").forEach((b) => {
      b.addEventListener("click", () => {
        const i = parseInt(b.getAttribute("data-i"), 10);
        this.dispatchEvent(
          new CustomEvent("std-nav-select", {
            bubbles: true,
            composed: true,
            detail: { index: i, node: this._leafByIndex(i) },
          })
        );
      });
    });
  }

  setActive(i) {
    this._active = i;
    this.shadowRoot.querySelectorAll(".nav-leaf").forEach((b) => {
      const on = parseInt(b.getAttribute("data-i"), 10) === i;
      b.classList.toggle("on", on);
      if (on) {
        // expand every ancestor group so the active leaf is visible
        let p = b.parentElement;
        while (p && p !== this.shadowRoot) {
          if (p.classList && p.classList.contains("nav-group")) {
            p.setAttribute("data-open", "1");
          }
          p = p.parentElement;
        }
        b.scrollIntoView({ block: "nearest" });
      }
    });
  }
}

defineComponent("standard-nav", StandardNav);
