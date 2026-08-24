/* ============================================================
   listening-app.js
   - Defines window.buildAudioFlat() so all components agree on the
     track ordering. (Base theme lives in UI/shared.js.)
   - Registers <listening-app>, the controller that owns the single
     <audio> element and wires the sidebar (<listening-track-list>)
     to the player (<listening-player>).
   ============================================================ */

// Shared styles now live in UI/shared.js (window.SHARED_CSS).

// Build a flat, ordered list of every track from the library tree.
// Every component that needs an "index" uses this so they stay in sync.
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
  }

  connectedCallback() {
    this.flat = window.buildAudioFlat(window.AUDIO_LIBRARY || []);
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
        .sidebar{width:320px;flex:none;border-right:1px solid var(--border);overflow-y:auto;background:var(--panel);scrollbar-width:none;-ms-overflow-style:none;}
        .sidebar::-webkit-scrollbar{width:0;height:0;display:none;}
        .stage{flex:1;display:flex;flex-direction:column;min-width:0;overflow:hidden;}
        .backdrop{display:none;position:absolute;inset:0;background:rgba(0,0,0,.45);z-index:5;}
        .stage-empty{
          flex:1;display:flex;align-items:center;justify-content:center;
          color:var(--muted);font-size:15px;padding:24px;text-align:center;
        }
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
          .stage-empty{font-size:13px;padding:16px;}
        }
      </style>
      <div class="app">
        <header class="topbar">
          <div class="brand"><button class="menu-btn" id="menu" title="目录" aria-label="目录">☰</button><span class="dot">●</span> IELTS Listening</div>
          <div class="topright">
            <div class="hint">空格 播放/暂停 · ← → 快退快进 · ↑ ↓ 音量</div>
            <theme-toggle></theme-toggle>
          </div>
        </header>
        <div class="body">
          <div class="backdrop" id="backdrop"></div>
          <aside class="sidebar"><listening-track-list></listening-track-list></aside>
          <main class="stage">
            <listening-player id="player"></listening-player>
            <div class="stage-empty" id="empty">← 从左侧选择一段音频开始练习</div>
          </main>
        </div>
        <footer class="foot">Built by <span class="name">Chen Kaixiang</span>, ${new Date().getFullYear()}</footer>
      </div>
    `;

    this.listEl = this.shadowRoot.querySelector("listening-track-list");
    this.player = this.shadowRoot.querySelector("#player");
    this.emptyEl = this.shadowRoot.querySelector("#empty");

    // Mobile drawer: open/close the sidebar, close on backdrop or selection.
    this._appEl = this.shadowRoot.querySelector(".app");
    this.shadowRoot.querySelector("#menu").addEventListener("click", () =>
      this._appEl.classList.toggle("nav-open")
    );
    this.shadowRoot.querySelector("#backdrop").addEventListener("click", () =>
      this._appEl.classList.remove("nav-open")
    );

    this.listEl.addEventListener("track-select", (e) => {
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

    this.audio.addEventListener("timeupdate", () => this.onTime());
    this.audio.addEventListener("loadedmetadata", () => this.pushState());
    this.audio.addEventListener("play", () => this.pushState());
    this.audio.addEventListener("pause", () => this.pushState());
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
    this.audio.src = t.file;
    this.audio.currentTime = 0;
    this.emptyEl.style.display = "none";
    this.listEl.setActive(i);
    const p = this.audio.play();
    if (p && p.catch) p.catch(() => {});
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
    // A-B repeat: jump back to A when we pass B.
    if (this.abA !== null && this.abB !== null && this.audio.currentTime >= this.abB) {
      this.audio.currentTime = this.abA;
    }
    this.pushState();
  }

  onEnded() {
    if (this.abA !== null && this.abB !== null) {
      this.audio.currentTime = this.abA;
      const p = this.audio.play();
      if (p && p.catch) p.catch(() => {});
      return;
    }
    this.step(1);
  }

  onKey(e) {
    // Ignore when typing in an input.
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
        },
        extra || {}
      )
    );
  }
}

defineComponent("listening-app", ListeningApp);
