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
  }

  connectedCallback() {
    this.flat = window.buildAudioFlat(window.AUDIO_LIBRARY || []);
    // All chrome + nav styling comes from window.SHARED_CSS (the standard).
    this.shadowRoot.innerHTML = `
      <style>${window.SHARED_CSS}</style>
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
            <div class="stage-empty" id="empty">← 从左侧选择一段音频开始练习</div>
          </main>
        </div>
        <footer class="foot">Built by <span class="name">Chen Kaixiang</span>, ${new Date().getFullYear()}</footer>
      </div>
    `;

    this.navEl = this.shadowRoot.querySelector("#nav");
    this.player = this.shadowRoot.querySelector("#player");
    this.emptyEl = this.shadowRoot.querySelector("#empty");

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
    this.navEl.setActive(i);
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
