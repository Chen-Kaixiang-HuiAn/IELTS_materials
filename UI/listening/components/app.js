/* ============================================================
   listening-app.js
   - Defines window.buildAudioFlat() so all components agree on the
     track ordering. (Base theme + layout + left-nav live in
     UI/shared.js / UI/common/components/standard-nav.js.)
   - Registers <listening-app>, the controller that owns the single
     <audio> element and wires the sidebar (<standard-nav>) to the
     player (<listening-player>).
   ============================================================ */

// Playback speed options — configurable, rendered dynamically as a <select>.
window.PLAYBACK_RATES = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];

window.buildAudioFlat = function (lib) {
  const flat = [];
  (lib || []).forEach((book) => {
    (book.tests || []).forEach((test) => {
      (test.sections || []).forEach((sec) => {
        flat.push({
          index: flat.length,
          file: sec.file,
          title: sec.title,
          section: sec.section,
          testTitle: test.title,
          bookTitle: book.title,
        });
      });
    });
  });
  return flat;
};

// Build the left-nav tree from the audio library. Top-level groups are
// books; each book contains tests (collapsed by default, matching the
// old behaviour); each test contains sections shown as leaves with an
// "S{n}" badge. Leaf ordering matches window.buildAudioFlat, so the
// nav index lines up with this.flat.
function buildListeningTree(lib) {
  return (lib || []).map((book) => ({
    label: book.title,
    open: 1,
    children: (book.tests || []).map((test) => ({
      label: test.title,
      open: 0,
      children: (test.sections || []).map((sec) => ({
        label: sec.title,
        badge: "S" + sec.section,
        data: {
          file: sec.file,
          title: sec.title,
          section: sec.section,
          testTitle: test.title,
          bookTitle: book.title,
        },
      })),
    })),
  }));
}

function fmtTime(sec) {
  if (!isFinite(sec) || sec < 0) sec = 0;
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return m + ":" + (s < 10 ? "0" : "") + s;
}

class ListeningApp extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this.audio = new Audio();
    this.audio.preload = "metadata";
    this.flat = [];
    this.idx = -1;
    this.abA = null;
    this.abB = null;
    this.loopSingle = false;
    this.rate = parseFloat(localStorage.getItem("il_rate") || "1") || 1;
    this.volume = parseFloat(localStorage.getItem("il_vol") || "1");
    if (isNaN(this.volume)) this.volume = 1;
    this.showLyrics = true;
    this._raf = null;          // requestAnimationFrame 跟随句柄
    this._userScrollUntil = 0; // 用户手动滚动后暂缓自动滚动的截止时间
    this._activeWord = -1;
    this._anchorPx = 24;       // 活动行距面板顶部（播放器下沿）的留白
  }

  connectedCallback() {
    this.flat = window.buildAudioFlat(window.AUDIO_LIBRARY || []);
    // All chrome + nav styling comes from window.SHARED_CSS (the standard).
    this.shadowRoot.innerHTML = `
      <style>${window.SHARED_CSS}</style>
      <style>
        .stage{display:flex;flex-direction:column;overflow:hidden;}
        .lyrics-panel{flex:1;min-height:0;overflow:auto;padding:20px 24px 40px;scroll-behavior:smooth;}
        .lyrics{max-width:880px;margin:0 auto;}
        .lyrics .line{margin:0 0 10px;line-height:1.78;font-size:15.5px;color:var(--text);
          padding:6px 10px;border-radius:8px;cursor:pointer;transition:background .15s;}
        .lyrics .line:hover{background:var(--panel2);}
        .lyrics .line.active{background:var(--active);}
        .lyrics .line.active .spk{color:var(--accent);}
        .lyrics .line-done{color:var(--accent);opacity:.92;}
        .lyrics .spk{font-weight:700;color:var(--accent);margin-right:7px;}
        .lyrics .w{transition:color .18s, background .18s;border-radius:4px;padding:0 1px;}
        .lyrics .w-done{color:var(--accent);}                 /* 已唱：颜色滚动的“已过点” */
        .lyrics .w-on{color:var(--on-accent);background:var(--accent);box-shadow:0 1px 5px rgba(0,0,0,.22);} /* 当前词 */
        .lyrics .note{color:var(--muted);font-size:13px;text-align:center;padding:34px 0;cursor:default;}
        .lyrics-panel[hidden]{display:none;}
        @media (max-width:768px){
          .lyrics-panel{padding:16px 16px 32px;}
          .lyrics .line{font-size:14.5px;}
        }
      </style>
      <div class="app">
        <header class="topbar">
          <div class="brand"><button class="menu-btn" id="menu" title="目录" aria-label="目录">☰</button><span class="dot"></span> IELTS Listening</div>
          <div class="topright">
            <div class="hint">空格 播放/暂停 · ← → 快退快进 · ↑ ↓ 音量</div>
            <theme-toggle></theme-toggle>
          </div>
        </header>
        <div class="body">
          <div class="backdrop" id="backdrop"></div>
          <aside class="sidebar"><standard-nav id="nav"></standard-nav></aside>
        <main class="stage">
          <listening-player id="player"></listening-player>
          <div class="lyrics-panel" id="lyricsPanel">
            <div class="lyrics" id="lyrics"></div>
          </div>
        </main>
        </div>
        <footer class="foot">Built by <span class="name">Chen Kaixiang</span>, ${new Date().getFullYear()}</footer>
      </div>
    `;

    this.navEl = this.shadowRoot.querySelector("#nav");
    this.player = this.shadowRoot.querySelector("#player");
    this.lyricsPanelEl = this.shadowRoot.querySelector("#lyricsPanel");
    this.lyricsEl = this.shadowRoot.querySelector("#lyrics");
    this._lines = [];
    this._activeLine = -1;
    this.lyricsEl.addEventListener("click", (e) => {
      const p = e.target.closest(".line");
      if (!p) return;
      let t = p.dataset.start != null ? parseFloat(p.dataset.start) : null;
      if (t == null) { const ws = p.querySelector(".w[data-t]"); if (ws) t = parseFloat(ws.dataset.t); }
      if (t != null && isFinite(t)) { this.audio.currentTime = t; if (this.audio.paused) this.togglePlay(); }
    });
    this.lyricsEl.innerHTML = '<div class="note">← 从左侧选择一段音频开始练习</div>';

    // 用户手动滚动歌词时，暂停自动跟随 5 秒，避免“抢滚”
    const markUserScroll = () => { this._userScrollUntil = Date.now() + 5000; };
    this.lyricsPanelEl.addEventListener("wheel", markUserScroll, { passive: true });
    this.lyricsPanelEl.addEventListener("touchmove", markUserScroll, { passive: true });

    this.navEl.setTree(buildListeningTree(window.AUDIO_LIBRARY || []));

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
      this.playIndex(e.detail.index);
    });
    this.player.addEventListener("toggle", () => this.togglePlay());
    this.player.addEventListener("seek", (e) => this.seekTo(e.detail.ratio));
    this.player.addEventListener("rate", (e) => this.setRate(e.detail.value));
    this.player.addEventListener("volume", (e) => this.setVolume(e.detail.value));
    this.player.addEventListener("next", () => this.step(1));
    this.player.addEventListener("prev", () => this.step(-1));
    this.player.addEventListener("ab-a", () => this.setAB("A"));
    this.player.addEventListener("ab-b", () => this.setAB("B"));
    this.player.addEventListener("ab-clear", () => this.clearAB());
    this.player.addEventListener("loop", () => this.toggleLoop());
    this.player.addEventListener("lyrics-toggle", () => this.toggleLyrics());

    this.audio.addEventListener("timeupdate", () => this.onTime());
    this.audio.addEventListener("loadedmetadata", () => this.pushState());
    this.audio.addEventListener("play", () => { this._startFollow(); this.pushState(); });
    this.audio.addEventListener("pause", () => { this._stopFollow(); this.updateLyricActive(this.audio.currentTime || 0, true); this.pushState(); });
    this.audio.addEventListener("ended", () => this.onEnded());
    this.audio.addEventListener("error", () =>
      this.pushState({ error: "无法加载该音频文件" })
    );

    this.audio.playbackRate = this.rate;
    this.audio.volume = this.volume;

    document.addEventListener("keydown", (e) => this.onKey(e));
    this.pushState();
  }

  playIndex(i) {
    const t = this.flat[i];
    if (!t) return;
    this.idx = i;
    this.abA = null;
    this.abB = null;
    this._stopFollow();
    this._userScrollUntil = 0;
    this.audio.src = t.file;
    this.audio.currentTime = 0;
    this.navEl.setActive(i);
    const p = this.audio.play();
    if (p && p.catch) p.catch(() => {});
    this.loadLyric(t);
    this._startFollow();
    this.pushState();
  }


  togglePlay() {
    if (this.idx < 0) {
      if (this.flat.length) this.playIndex(0);
      return;
    }
    if (this.audio.paused) {
      const p = this.audio.play();
      if (p && p.catch) p.catch(() => {});
    } else {
      this.audio.pause();
    }
  }

  seekTo(ratio) {
    if (!isFinite(this.audio.duration)) return;
    this.audio.currentTime = Math.max(0, Math.min(1, ratio)) * this.audio.duration;
    this.updateLyricActive(this.audio.currentTime || 0, true);
    this.pushState();
  }

  step(dir) {
    const next = this.idx + dir;
    if (next >= 0 && next < this.flat.length) this.playIndex(next);
  }

  setRate(v) {
    this.rate = v;
    this.audio.playbackRate = v;
    localStorage.setItem("il_rate", String(v));
    this.pushState();
  }

  setVolume(v) {
    this.volume = v;
    this.audio.volume = v;
    localStorage.setItem("il_vol", String(v));
    this.pushState();
  }

  setAB(which) {
    const t = this.audio.currentTime;
    if (which === "A") {
      this.abA = t;
      if (this.abB !== null && this.abB <= t) this.abB = null;
    } else {
      if (this.abA === null) return;
      if (t <= this.abA) return;
      this.abB = t;
    }
    this.pushState();
  }

  clearAB() {
    this.abA = null;
    this.abB = null;
    this.pushState();
  }

  toggleLoop() {
    this.loopSingle = !this.loopSingle;
    this.pushState();
  }

  onTime() {
    if (this.abA !== null && this.abB !== null && this.audio.currentTime >= this.abB) {
      this.audio.currentTime = this.abA;
    }
    this.updateLyricActive(this.audio.currentTime || 0);
    this.pushState();
  }

  onEnded() {
    this._stopFollow();
    if (this.abA !== null && this.abB !== null) {
      this.audio.currentTime = this.abA;
      const p = this.audio.play();
      if (p && p.catch) p.catch(() => {});
      return;
    }
    this.step(1);
  }

  onKey(e) {
    if (e.target && /INPUT|TEXTAREA/.test(e.target.tagName)) return;
    switch (e.key) {
      case " ":
        e.preventDefault();
        this.togglePlay();
        break;
      case "ArrowRight":
        e.preventDefault();
        this.seekTo((this.audio.currentTime + 5) / (this.audio.duration || 1));
        break;
      case "ArrowLeft":
        e.preventDefault();
        this.seekTo((this.audio.currentTime - 5) / (this.audio.duration || 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        this.setVolume(Math.min(1, this.volume + 0.05));
        break;
      case "ArrowDown":
        e.preventDefault();
        this.setVolume(Math.max(0, this.volume - 0.05));
        break;
    }
  }

  pushState(extra) {
    if (!this.player) return;
    const t = this.flat[this.idx];
    this.player.setState(
      Object.assign(
        {
          hasTrack: this.idx >= 0,
          title: t ? t.title : "",
          sub: t ? t.bookTitle + " · " + t.testTitle : "",
          currentTime: this.audio.currentTime || 0,
          duration: this.audio.duration || 0,
          playing: !this.audio.paused,
          rate: this.rate,
          volume: this.volume,
          abA: this.abA,
          abB: this.abB,
          loop: this.loopSingle,
          lyrics: this.showLyrics,
        },
        extra || {}
      )
    );
  }

  // ── Lyrics (per-section transcript, time-coded LRC) ──
  lyricPathFor(t) {
    const m = (t && t.title || "").match(/IELTS(\d+)-Test (\d+)-Section (\d+)/);
    if (!m) return null;
    const base = "transcripts/lyrics/Cam" + m[1] + "/Test" + m[2] + "/Section" + m[3];
    const txtBase = "transcripts/audioscripts/Cam" + m[1] + "/Test" + m[2] + "/Section" + m[3];
    return { lrc: base + ".lrc", txt: txtBase + ".txt" };
  }

  lrcTime(str) {
    const m = String(str).match(/(\d+):(\d+)(?:[.:](\d+))?/);
    if (!m) return null;
    return (+m[1]) * 60 + (+m[2]) + (m[3] ? +("0." + m[3]) : 0);
  }

  async loadLyric(t) {
    this._lines = [];
    this._activeLine = -1;
    if (!this.lyricsEl) return;
    const paths = this.lyricPathFor(t);
    let text = null, isLrc = false;
    if (paths) {
      for (const p of [paths.lrc, paths.txt]) {
        try {
          const res = await fetch(p);
          if (res.ok) { text = await res.text(); isLrc = (p === paths.lrc); break; }
        } catch (e) {}
      }
    }
    if (text == null) {
      this.lyricsEl.innerHTML = '<div class="note">该段暂无字幕</div>';
      this.showLyricsPanel(this.showLyrics);
      return;
    }
    this._lines = this.parseLrc(text, isLrc);
    this.lyricsEl.innerHTML = this._lines.map((l) => l.html).join("");
    if (this.lyricsPanelEl) this.lyricsPanelEl.scrollTop = 0;
    this.showLyricsPanel(this.showLyrics);
    this.updateLyricActive(this.audio.currentTime || 0, true);
  }

  // Parse LRC (or plain .txt fallback). Returns [{start, speaker, words:[{t,w}], html}]
  parseLrc(text, isLrc) {
    if (!isLrc) {
      const spk = /^([A-Z][A-Z .'’\-]*?):\s?(.*)$/;
      return (text || "").split(/\r?\n/).map((s) => s.trim()).filter(Boolean).map((line) => {
        const m = line.match(spk);
        const speaker = m ? m[1] : null;
        const body = m ? m[2] : line;
        return { start: null, speaker, words: [{ t: null, w: body }], html: this.lineHtml(speaker, [{ t: null, w: body }], null) };
      });
    }
    const out = [];
    const lineRe = /^\[(\d+:\d+(?:[.:]\d+)?)\]\s?(.*)$/;
    for (const raw of (text || "").split(/\r?\n/)) {
      const line = raw.trim();
      if (!line) continue;
      const lm = line.match(lineRe);
      let start = null, content = line;
      if (lm) { start = this.lrcTime(lm[1]); content = lm[2]; }
      let speaker = null;
      const sm = content.match(/^([A-Z][A-Z .'’\-]*?):\s?(.*)$/);
      if (sm) { speaker = sm[1]; content = sm[2]; }
      const words = [];
      const parts = content.split(/(<\d+:\d+(?:[.:]\d+)?>[^<]*)/g).filter((s) => s !== "");
      for (const part of parts) {
        const wm = part.match(/^<(\d+:\d+(?:[.:]\d+)?)>(.*)$/);
        if (wm) {
          const t = this.lrcTime(wm[1]);
          const w = wm[2].trim();
          if (w !== "") words.push({ t, w });
        } else {
          const w = part.trim();
          if (w !== "") words.push({ t: null, w });
        }
      }
      if (words.length === 0 && content.trim() !== "") words.push({ t: null, w: content.trim() });
      out.push({ start, speaker, words, html: this.lineHtml(speaker, words, start) });
    }
    return out;
  }

  lineHtml(speaker, words, start) {
    const st = start != null ? ' data-start="' + start.toFixed(2) + '"' : "";
    let inner = "";
    if (speaker) inner += '<span class="spk">' + this.esc(speaker) + ":</span> ";
    for (const wd of words) {
      if (wd.t != null) inner += '<span class="w" data-t="' + wd.t.toFixed(2) + '">' + this.esc(wd.w) + " </span>";
      else inner += '<span class="w">' + this.esc(wd.w) + " </span>";
    }
    return '<p class="line"' + st + ">" + inner + "</p>";
  }

  // Highlight the active line / word as the audio plays; click to seek.
  // 颜色滚动：已唱词持续染强调色(w-done)，当前词填充高亮(w-on)。
  // 纵向自然滚动：活动行锚定在面板顶部（播放器下沿），平滑跟进。
  updateLyricActive(ct, force) {
    if (!this.lyricsEl || !this._lines || !this._lines.length) return;
    const lines = this._lines, nodes = this.lyricsEl.children;

    // 计算当前活动行（无时间标记的纯文本按等时长切分）
    let active = -1;
    const hasStarts = lines.some((l) => l.start != null);
    if (hasStarts) {
      for (let i = 0; i < lines.length; i++) {
        const s = lines[i].start;
        if (s == null) continue;
        if (s <= ct + 0.2) active = i; else break;
      }
    } else if (lines.length) {
      const dur = this.audio.duration || 1;
      active = Math.min(lines.length - 1, Math.floor((ct / dur) * lines.length));
    }

    // 活动行切换：更新行高亮 + 过往/未来行的整段染色状态
    if (active !== this._activeLine || force) {
      for (let i = 0; i < nodes.length; i++) {
        const node = nodes[i];
        node.classList.toggle("active", i === active);
        const ws = node._ws || (node._ws = node.querySelectorAll(".w[data-t]"));
        if (i < active) {
          ws.forEach((sp) => { sp.classList.add("w-done"); sp.classList.remove("w-on"); });
          if (!ws.length) node.classList.add("line-done"); // 纯文本：整行染色
        } else {
          ws.forEach((sp) => { sp.classList.remove("w-done", "w-on"); });
          node.classList.remove("line-done");
        }
      }
      this._activeLine = active;
      this._activeWord = -1;
      this._scrollToActive(active, !force);
    }

    // 当前行词级高亮（颜色滚动）——逐帧调用也只动变化的词，开销很小
    if (active >= 0 && nodes[active]) {
      const node = nodes[active];
      const ws = node._ws || (node._ws = node.querySelectorAll(".w[data-t]"));
      let wi = -1;
      for (let k = 0; k < ws.length; k++) {
        const t = parseFloat(ws[k].dataset.t);
        if (t <= ct + 0.06) {
          wi = k;
          if (!ws[k].classList.contains("w-done")) ws[k].classList.add("w-done");
        }
      }
      if (wi !== this._activeWord) {
        ws.forEach((sp, k) => sp.classList.toggle("w-on", k === wi));
        this._activeWord = wi;
      }
    }
  }

  // 将活动行滚动到面板顶部（播放器下沿），与播放器不重叠
  // 用 getBoundingClientRect 计算相对面板的真实位移，避免 offsetParent
  // 在 shadow DOM 里向上穿透导致 offsetTop 把播放器/顶栏高度算进去、跳飞。
  _scrollToActive(active, smooth) {
    if (active < 0 || !this.lyricsPanelEl) return;
    if (this._userScrollUntil && Date.now() < this._userScrollUntil) return; // 用户正在手动看
    const el = this.lyricsEl.children[active];
    if (!el) return;
    const panel = this.lyricsPanelEl;
    const panelRect = panel.getBoundingClientRect();
    const elRect = el.getBoundingClientRect();
    const delta = elRect.top - panelRect.top; // 元素当前相对面板视口顶部的位置
    const target = Math.max(0, panel.scrollTop + delta - this._anchorPx);
    if (smooth && "scrollBehavior" in panel.style) panel.scrollTo({ top: target, behavior: "smooth" });
    else panel.scrollTop = target;
  }

  // 播放时逐帧追踪进度（实时），暂停即停
  _startFollow() {
    if (this._raf !== null) return;
    const tick = () => {
      if (this.audio.paused || this.idx < 0) { this._raf = null; return; }
      this.updateLyricActive(this.audio.currentTime || 0);
      this._raf = requestAnimationFrame(tick);
    };
    this._raf = requestAnimationFrame(tick);
  }

  _stopFollow() {
    if (this._raf !== null) { cancelAnimationFrame(this._raf); this._raf = null; }
  }

  esc(s) {
    return String(s).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
  }

  showLyricsPanel(show) {
    if (this.lyricsPanelEl) this.lyricsPanelEl.hidden = !show;
  }

  toggleLyrics() {
    this.showLyrics = !this.showLyrics;
    this.showLyricsPanel(this.showLyrics);
    this.pushState();
  }
}

defineComponent("listening-app", ListeningApp);
