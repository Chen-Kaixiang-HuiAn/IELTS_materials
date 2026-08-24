/* ============================================================
   tutorials-app.js — <tutorials-app>

   Controller for the Tutorials subsite. Layout follows the page
   standard (four pinned regions from window.SHARED_CSS); the left
   nav is the shared <standard-nav> (UI/common/components/standard-nav.js),
   so it is visually identical to Listening / Writing.

   The left-nav tree is built recursively from window.TUTORIALS_TREE
   (section → group → sub-group → page). Selecting a page fetches its
   .md and renders it with the bundled wRenderMarkdown (a dependency-free
   renderer, identical in spirit to the one in <writing-reader>, so
   Tutorials does NOT depend on the writing subsite). The leaf's __path
   becomes the viewer breadcrumb.
   ============================================================ */

// ── Markdown renderer (self-contained, mirrors writing-reader's) ──
const wEsc = window.wEsc;

function wInline(s) {
  s = wEsc(s);
  const codes = [];
  s = s.replace(/`([^`]+)`/g, (m, c) => {
    codes.push("<code>" + c + "</code>");
    return "�" + (codes.length - 1) + "�";
  });
  s = s.replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, '<span class="imgwrap"><img src="$2" alt="$1"></span>');
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
  s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  s = s.replace(/__([^_]+)__/g, "<strong>$1</strong>");
  s = s.replace(/\*([^*]+)\*/g, "<em>$1</em>");
  s = s.replace(/_([^_]+)_/g, "<em>$1</em>");
  s = s.replace(/�(\d+)�/g, (m, i) => codes[+i]);
  return s;
}

function wRenderMarkdown(src) {
  const lines = String(src).replace(/\r\n?/g, "\n").split("\n");
  const out = [];
  let i = 0;
  let firstH1 = true;
  let firstH1Text = "";

  const isBlank = (l) => /^\s*$/.test(l);
  const isHeading = (l) => /^#{1,6}\s+/.test(l);
  const isFence = (l) => /^```/.test(l);
  const isQuote = (l) => /^\s*>\s?/.test(l);
  const isUList = (l) => /^\s*[-*+]\s+/.test(l);
  const isOList = (l) => /^\s*\d+[.)]\s+/.test(l);
  const isHR = (l) => /^\s*([-*_])(\s*\1){2,}\s*$/.test(l);
  const isTableSep = (l) => l.includes("-") && /^\s*\|?[\s:|-]*-[\s:|-]*\|?\s*$/.test(l);
  const isTableRow = (l) => l.includes("|") && !isBlank(l);
  const isBlockStart = (l) =>
    isHeading(l) || isFence(l) || isQuote(l) || isUList(l) || isOList(l) || isHR(l);

  const splitRow = (r) => {
    let x = r.trim();
    if (x.startsWith("|")) x = x.slice(1);
    if (x.endsWith("|")) x = x.slice(0, -1);
    return x.split("|").map((c) => c.trim());
  };

  while (i < lines.length) {
    const line = lines[i];

    if (isBlank(line)) { i++; continue; }

    if (isFence(line)) {
      const buf = [];
      i++;
      while (i < lines.length && !isFence(lines[i])) { buf.push(lines[i]); i++; }
      i++;
      out.push("<pre><code>" + wEsc(buf.join("\n")) + "</code></pre>");
      continue;
    }

    const h = line.match(/^(#{1,6})\s+(.*)$/);
    if (h) {
      const lvl = h[1].length;
      const txt = h[2].trim();
      if (lvl === 1 && firstH1) {
        firstH1 = false;
        firstH1Text = txt;
        i++;
        continue;
      }
      out.push("<h" + lvl + ">" + wInline(txt) + "</h" + lvl + ">");
      i++;
      continue;
    }

    if (isHR(line)) { out.push("<hr>"); i++; continue; }

    if (isQuote(line)) {
      const buf = [];
      while (i < lines.length && isQuote(lines[i])) {
        buf.push(lines[i].replace(/^\s*>\s?/, ""));
        i++;
      }
      out.push("<blockquote>" + wInline(buf.join(" ")) + "</blockquote>");
      continue;
    }

    if (line.includes("|") && i + 1 < lines.length && isTableSep(lines[i + 1])) {
      const head = splitRow(line);
      i += 2;
      const rows = [];
      while (i < lines.length && isTableRow(lines[i])) {
        rows.push(splitRow(lines[i]));
        i++;
      }
      let t = "<table><thead><tr>" + head.map((c) => "<th>" + wInline(c) + "</th>").join("") + "</tr></thead><tbody>";
      rows.forEach((r) => {
        t += "<tr>" + r.map((c) => "<td>" + wInline(c) + "</td>").join("") + "</tr>";
      });
      t += "</tbody></table>";
      out.push(t);
      continue;
    }

    if (isUList(line)) {
      const items = [];
      while (i < lines.length && isUList(lines[i])) {
        items.push(lines[i].replace(/^\s*[-*+]\s+/, ""));
        i++;
      }
      out.push("<ul>" + items.map((it) => "<li>" + wInline(it) + "</li>").join("") + "</ul>");
      continue;
    }

    if (isOList(line)) {
      const items = [];
      while (i < lines.length && isOList(lines[i])) {
        items.push(lines[i].replace(/^\s*\d+[.)]\s+/, ""));
        i++;
      }
      out.push("<ol>" + items.map((it) => "<li>" + wInline(it) + "</li>").join("") + "</ol>");
      continue;
    }

    const para = [];
    while (i < lines.length && !isBlank(lines[i]) && !isBlockStart(lines[i])) {
      if (lines[i].includes("|") && i + 1 < lines.length && isTableSep(lines[i + 1])) break;
      para.push(lines[i]);
      i++;
    }
    if (para.length) out.push("<p>" + wInline(para.join(" ")) + "</p>");
  }

  return { html: out.join("\n"), h1: firstH1Text };
}

// Build the <standard-nav> tree + a flat list of pages from
// window.TUTORIALS_TREE. Leaf ordering matches the flat list, and the
// badge is the global 1-based index (mirrors the old number badge).
function buildTutorialTree(sections) {
  const flat = [];
  let c = 0;
  const toNav = (n) => {
    const node = { label: n.name || n.id || "", open: 1, children: [] };
    (n.groups || []).forEach((g) => node.children.push(toNav(g)));
    (n.items || []).forEach((it) => {
      const label = it.title || it.file.split("/").pop().replace(/\.md$/, "");
      node.children.push({ label: label, badge: String(++c), data: it });
      flat.push(it);
    });
    return node;
  };
  const tree = (sections || []).map(toNav);
  return { tree, flat };
}

class TutorialsApp extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this.sections = (window.TUTORIALS_TREE && window.TUTORIALS_TREE.sections) || [];
    this.flat = [];
    this.idx = -1;
  }

  connectedCallback() {
    const { tree, flat } = buildTutorialTree(this.sections);
    this.flat = flat;

    // All chrome + nav + content styling comes from window.SHARED_CSS.
    this.shadowRoot.innerHTML = `
      <style>${window.SHARED_CSS}</style>
      <div class="app">
        <header class="topbar">
          <div class="brand"><button class="menu-btn" id="menu" title="目录" aria-label="目录">☰</button><span class="dot"></span> IELTS Tutorials</div>
          <div class="topright">
            <div class="hint">← → 切换内容 · 滚轮阅读</div>
            <theme-toggle></theme-toggle>
          </div>
        </header>
        <div class="body">
          <div class="backdrop" id="backdrop"></div>
          <aside class="sidebar"><standard-nav id="nav"></standard-nav></aside>
          <main class="main">
            <div class="vbar">
              <div class="ttl"><span class="crumb" id="crumb"></span><span id="ttl">教程</span></div>
              <div class="nav">
                <button id="prev">← 上一篇</button>
                <button id="next">下一篇 →</button>
              </div>
            </div>
            <div class="scroll" id="scroll">
              <div class="essay"><div class="empty">从左侧选择一篇教程开始阅读。</div></div>
            </div>
          </main>
        </div>
        <footer class="foot">Built by <span class="name">Chen Kaixiang</span>, ${new Date().getFullYear()}</footer>
      </div>
    `;

    this.navEl = this.shadowRoot.querySelector("#nav");
    this.scrollEl = this.shadowRoot.querySelector("#scroll");
    this.ttlEl = this.shadowRoot.querySelector("#ttl");
    this.crumbEl = this.shadowRoot.querySelector("#crumb");
    this._appEl = this.shadowRoot.querySelector(".app");

    this.navEl.setTree(tree);

    // Mobile drawer
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

    if (this.flat.length) this.select(0);
  }

  select(i) {
    const it = this.flat[i];
    if (!it) return;
    this.idx = i;
    const leaf = this.navEl.getLeaf(i);
    this.crumbEl.textContent = (leaf && leaf.__path ? leaf.__path : []).join(" · ");
    this.ttlEl.textContent = "(加载中…)";
    this.scrollEl.scrollTop = 0;
    this.navEl.setActive(i);

    fetch(it.file)
      .then((r) => {
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.text();
      })
      .then((md) => {
        const { html, h1 } = wRenderMarkdown(md);
        const title = it.title || h1 || it.file.split("/").pop().replace(/\.md$/, "");
        this.ttlEl.textContent = title;
        this.scrollEl.innerHTML = `<div class="essay">` + html + `</div>`;
      })
      .catch((err) => {
        this.ttlEl.textContent = it.title || it.file.split("/").pop();
        this.scrollEl.innerHTML =
          `<div class="essay"><div class="empty">加载失败：${wEsc(err.message)}<br>路径：${wEsc(it.file)}</div></div>`;
      });
  }

  step(dir) {
    const n = this.idx + dir;
    if (n >= 0 && n < this.flat.length) this.select(n);
  }

  onKey(e) {
    if (e.target && /INPUT|TEXTAREA/.test(e.target.tagName)) return;
    if (e.key === "ArrowLeft") { e.preventDefault(); this.step(-1); }
    else if (e.key === "ArrowRight") { e.preventDefault(); this.step(1); }
  }
}

defineComponent("tutorials-app", TutorialsApp);
