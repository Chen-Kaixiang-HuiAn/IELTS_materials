/* ============================================================
   writing-reader.js — <writing-reader>
   Renders an essay from Markdown fetched at runtime via loadEssay()
   (the manifest stores only metadata + file path, not the body).
   Holds its own tiny, dependency-free Markdown → HTML renderer
   tuned for the essay format (headings, tables, fenced code,
   blockquotes, images, lists, inline markup). No build step,
   no CDN. Requires the page to be served over http (fetch is
   blocked on file://).
   ============================================================ */

// wEsc is provided globally by UI/page-standard.js (window.wEsc).
const wEsc = window.wEsc;

// Inline-level Markdown: code spans are protected with placeholders so
// later rules don't mangle their contents.
function wInline(s) {
  s = wEsc(s);
  const codes = [];
  s = s.replace(/`([^`]+)`/g, (m, c) => {
    codes.push("<code>" + c + "</code>");
    return "" + (codes.length - 1) + "";
  });
  s = s.replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, '<span class="imgwrap"><img src="$2" alt="$1"></span>');
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
  s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  s = s.replace(/__([^_]+)__/g, "<strong>$1</strong>");
  s = s.replace(/\*([^*]+)\*/g, "<em>$1</em>");
  s = s.replace(/_([^_]+)_/g, "<em>$1</em>");
  s = s.replace(/(\d+)/g, (m, i) => codes[+i]);
  return s;
}

function wRenderMarkdown(src) {
  const lines = String(src).replace(/\r\n?/g, "\n").split("\n");
  const out = [];
  let i = 0;
  let firstH1 = true;

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

    // fenced code block
    if (isFence(line)) {
      const buf = [];
      i++;
      while (i < lines.length && !isFence(lines[i])) { buf.push(lines[i]); i++; }
      i++; // skip closing fence
      out.push("<pre><code>" + wEsc(buf.join("\n")) + "</code></pre>");
      continue;
    }

    // heading (skip the very first H1 — it is shown in the viewer header)
    const h = line.match(/^(#{1,6})\s+(.*)$/);
    if (h) {
      const lvl = h[1].length;
      const txt = h[2].trim();
      if (lvl === 1 && firstH1) { firstH1 = false; i++; continue; }
      out.push("<h" + lvl + ">" + wInline(txt) + "</h" + lvl + ">");
      i++;
      continue;
    }

    if (isHR(line)) { out.push("<hr>"); i++; continue; }

    // blockquote
    if (isQuote(line)) {
      const buf = [];
      while (i < lines.length && isQuote(lines[i])) {
        buf.push(lines[i].replace(/^\s*>\s?/, ""));
        i++;
      }
      out.push("<blockquote>" + wInline(buf.join(" ")) + "</blockquote>");
      continue;
    }

    // table: header row + separator row
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

    // unordered list
    if (isUList(line)) {
      const items = [];
      while (i < lines.length && isUList(lines[i])) {
        items.push(lines[i].replace(/^\s*[-*+]\s+/, ""));
        i++;
      }
      out.push("<ul>" + items.map((it) => "<li>" + wInline(it) + "</li>").join("") + "</ul>");
      continue;
    }

    // ordered list
    if (isOList(line)) {
      const items = [];
      while (i < lines.length && isOList(lines[i])) {
        items.push(lines[i].replace(/^\s*\d+[.)]\s+/, ""));
        i++;
      }
      out.push("<ol>" + items.map((it) => "<li>" + wInline(it) + "</li>").join("") + "</ol>");
      continue;
    }

    // paragraph (stop before a blank line, a block start, or a table header)
    const para = [];
    while (i < lines.length && !isBlank(lines[i]) && !isBlockStart(lines[i])) {
      if (lines[i].includes("|") && i + 1 < lines.length && isTableSep(lines[i + 1])) break;
      para.push(lines[i]);
      i++;
    }
    if (para.length) out.push("<p>" + wInline(para.join(" ")) + "</p>");
  }

  return out.join("\n");
}

class WritingReader extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
  }

  connectedCallback() {
    this._parts = null;      // {task1, task2} markdown chunks
    this._active = "task1";  // currently shown part
    this._file = "";
    this.shadowRoot.innerHTML = `
      <style>${window.SHARED_CSS}</style>
      <style>
        :host{display:flex;flex-direction:column;flex:1;min-height:0;}
        .switcher{display:flex;gap:8px;padding:12px 20px;border-bottom:1px solid var(--border);
          background:var(--panel);flex:none;}
        .sw-btn{appearance:none;border:1px solid var(--border);background:var(--panel2);color:var(--muted);
          font-size:13px;font-weight:600;padding:7px 16px;border-radius:8px;cursor:pointer;transition:.15s;}
        .sw-btn:hover{color:var(--text);}
        .sw-btn.on{background:var(--accent-grad);color:var(--on-accent);border-color:var(--accent);}
        .sw-sep{flex:1;}
        .src-note{font-size:12.5px;color:var(--muted);background:var(--panel);border:1px solid var(--border);
          border-radius:8px;padding:8px 14px;margin:0 0 18px;line-height:1.5;}
        .src-note b{color:var(--text);font-weight:600;}
        .loading{display:flex;align-items:center;justify-content:center;height:100%;color:var(--muted);font-size:15px;}
        .errbox{max-width:640px;margin:40px auto;padding:20px 24px;border:1px solid var(--danger);
          border-radius:10px;background:var(--panel);color:var(--text);line-height:1.8;}
        .errbox code{background:var(--panel2);padding:2px 6px;border-radius:4px;color:var(--accent);}
        .errbox small{color:var(--muted);}
        /* ── 移动端：阅读区内边距与字号收窄（.essay 已在标准里统一） ── */
        @media (max-width:768px){
          .src-note{font-size:11.5px;padding:7px 12px;margin:0 0 14px;}
        }
      </style>
      <div class="switcher">
        <button class="sw-btn" id="bt1" data-part="task1">小作文 · Task 1</button>
        <button class="sw-btn" id="bt2" data-part="task2">大作文 · Task 2</button>
        <span class="sw-sep"></span>
      </div>
      <div class="scroll" id="out"><div class="empty">← 从左侧选择一篇范文</div></div>
    `;
    this._out = this.shadowRoot.getElementById("out");
    this.shadowRoot.getElementById("bt1").addEventListener("click", () => this.showPart("task1"));
    this.shadowRoot.getElementById("bt2").addEventListener("click", () => this.showPart("task2"));
  }

  // Split a full essay's Markdown into Task 1 / Task 2 chunks using the
  // canonical "## Task 1" / "## Task 2" level-2 headings. Both headings
  // are guaranteed present in every essay (verified across the corpus).
  splitTasks(md) {
    const lines = String(md).replace(/\r\n?/g, "\n").split("\n");
    let cur = "pre";
    const buckets = { pre: [], task1: [], task2: [] };
    for (const line of lines) {
      const m = line.match(/^##\s+Task\s*([12])\b/i);
      if (m) cur = m[1] === "1" ? "task1" : "task2";
      buckets[cur].push(line);
    }
    const join = (arr) => arr.join("\n").trim();
    const pre = join(buckets.pre);
    const t1 = join(buckets.task1);
    const t2 = join(buckets.task2);
    // Front matter before "## Task 1" (e.g. the H1 title) is prepended
    // to Task 1 so the header still shows.
    return {
      task1: (pre ? pre + "\n\n" : "") + t1,
      task2: t2,
    };
  }

  // Load an essay by fetching its .md file at runtime (the manifest
  // only stores metadata + the file path, never the body).
  loadEssay(essay) {
    if (!this._out) return;
    if (!essay || !essay.file) {
      this.setEmpty();
      return;
    }
    this._file = essay.file;
    this._out.className = "scroll";
    this._out.innerHTML = '<div class="loading">加载中…</div>';
    fetch(essay.file, { cache: "no-store" })
      .then((r) => {
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.text();
      })
      .then((md) => {
        this._parts = this.splitTasks(md);
        // Default to Task 1; if it is empty for some reason, fall back.
        this._active = this._parts.task1 ? "task1" : "task2";
        this.showPart(this._active);
      })
      .catch((err) => {
        this._out.className = "scroll";
        this._out.innerHTML =
          '<div class="errbox">无法加载范文 <code>' + wEsc(essay.file) + "</code>。<br>" +
          "请通过本地服务器访问本页面（不要直接双击打开 index.html）。<br>" +
          "<small>" + wEsc(String(err)) + "</small></div>";
      });
  }

  showPart(part) {
    this._active = part;
    const bt1 = this.shadowRoot.getElementById("bt1");
    const bt2 = this.shadowRoot.getElementById("bt2");
    if (bt1) bt1.classList.toggle("on", part === "task1");
    if (bt2) bt2.classList.toggle("on", part === "task2");
    if (!this._parts) return;
    const md = this._parts[part] || "";
    if (md === "") {
      this._out.innerHTML = '<div class="empty">该篇没有 ' +
        (part === "task1" ? "Task 1" : "Task 2") + " 内容</div>";
      return;
    }
    this._out.innerHTML = '<div class="essay">' +
      '<div class="src-note">题目与范文来源自微信公众号 <b>李香农雅思</b></div>' +
      wRenderMarkdown(md) + "</div>";
    this._out.scrollTop = 0;
  }

  setEmpty() {
    this._parts = null;
    this._active = "task1";
    const bt1 = this.shadowRoot.getElementById("bt1");
    const bt2 = this.shadowRoot.getElementById("bt2");
    if (bt1) bt1.classList.remove("on");
    if (bt2) bt2.classList.remove("on");
    this._out.className = "scroll";
    this._out.innerHTML = '<div class="empty">← 从左侧选择一篇范文</div>';
  }
}

defineComponent("writing-reader", WritingReader);
