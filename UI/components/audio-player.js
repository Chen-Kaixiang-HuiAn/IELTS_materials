/* ============================================================
   audio-player.js — <audio-player>
   Dumb-ish view: renders controls and emits events.
     toggle | seek{ratio} | rate{value} | volume{value}
     next | prev | ab-a | ab-b | ab-clear | loop
   State pushed in via setState({...}) from <listening-app>.
   ============================================================ */

function fmt(sec) {
  if (!isFinite(sec) || sec < 0) sec = 0;
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return m + ":" + (s < 10 ? "0" : "") + s;
}

class AudioPlayer extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._state = {};
    this._dragging = false;
  }

  connectedCallback() {
    this.shadowRoot.innerHTML = `
      <style>${window.SHARED_CSS}</style>
      <style>
        :host{display:block;border-top:1px solid var(--border);background:var(--panel);}
        .player{padding:14px 20px 16px;display:flex;flex-direction:column;gap:10px;}
        .row1{display:flex;align-items:center;justify-content:space-between;gap:14px;min-width:0;}
        .meta{min-width:0;}
        .title{font-size:15px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
        .sub{font-size:12px;color:var(--muted);margin-top:2px;}
        .abinfo{font-size:12px;color:var(--accent);margin-top:3px;min-height:14px;}
        .seek{position:relative;height:22px;display:flex;align-items:center;cursor:pointer;}
        .seek-track{position:relative;width:100%;height:6px;background:var(--panel2);border-radius:4px;}
        .seek-fill{position:absolute;left:0;top:0;height:100%;background:var(--accent);border-radius:4px;width:0;}
        .seek-knob{position:absolute;top:50%;width:13px;height:13px;border-radius:50%;background:#fff;
          transform:translate(-50%,-50%);left:0;box-shadow:0 1px 4px rgba(0,0,0,.5);}
        .ab-mark{position:absolute;top:50%;width:3px;height:14px;background:var(--danger);
          transform:translate(-50%,-50%);border-radius:2px;display:none;}
        .times{display:flex;justify-content:space-between;font-size:12px;color:var(--muted);margin-top:-4px;}
        .controls{display:flex;align-items:center;gap:8px;flex-wrap:wrap;}
        .play{width:46px;height:38px;border-radius:10px;background:var(--accent);color:#06211e;
          border:none;font-size:17px;font-weight:700;}
        .play:hover{background:var(--accent2);}
        .icon-btn{width:38px;height:34px;font-size:15px;}
        .rate-select{height:34px;min-width:62px;font-size:13px;font-weight:600;padding:0 6px;background:var(--panel2);color:var(--text);border:1px solid var(--border);border-radius:8px;}
        .rate-select:focus-visible{outline:2px solid var(--accent);}
        .ab-group{display:flex;gap:6px;align-items:center;padding-left:6px;border-left:1px solid var(--border);}
        .ab-btn{width:34px;height:34px;font-weight:700;font-size:13px;}
        .ab-btn.on{background:var(--active);border-color:var(--accent);color:var(--accent);}
        .vol{display:flex;align-items:center;gap:6px;margin-left:auto;}
        .vol input{width:96px;}
        .err{color:var(--danger);font-size:12px;min-height:14px;}
      </style>
      <div class="player">
        <div class="row1">
          <div class="meta">
            <div class="title" id="title">未选择音频</div>
            <div class="sub" id="sub"></div>
            <div class="abinfo" id="abinfo"></div>
            <div class="err" id="err"></div>
          </div>
        </div>
        <div class="seek" id="seek">
          <div class="seek-track">
            <div class="seek-fill" id="fill"></div>
            <div class="ab-mark" id="markA"></div>
            <div class="ab-mark" id="markB"></div>
            <div class="seek-knob" id="knob"></div>
          </div>
        </div>
        <div class="times"><span id="cur">0:00</span><span id="dur">0:00</span></div>
        <div class="controls">
          <button class="icon-btn" id="prev" title="上一段">⏮</button>
          <button class="play" id="play" title="播放/暂停">▶</button>
          <button class="icon-btn" id="next" title="下一段">⏭</button>
          <select class="rate-select" id="rate" title="播放倍速"></select>
          <div class="ab-group">
            <button class="ab-btn" id="setA" title="设 A 点">A</button>
            <button class="ab-btn" id="setB" title="设 B 点">B</button>
            <button class="ab-btn" id="abClear" title="清除 A-B">✕</button>
            <button class="ab-btn" id="loop" title="单段循环">↻</button>
          </div>
          <div class="vol"><span>🔈</span><input type="range" id="vol" min="0" max="1" step="0.01" value="1"></div>
        </div>
      </div>
    `;

    this.$ = (id) => this.shadowRoot.getElementById(id);
    this._bind();
  }

  _bind() {
    this.$("play").addEventListener("click", () =>
      this.dispatchEvent(new CustomEvent("toggle", { bubbles: true, composed: true }))
    );
    this.$("prev").addEventListener("click", () =>
      this.dispatchEvent(new CustomEvent("prev", { bubbles: true, composed: true }))
    );
    this.$("next").addEventListener("click", () =>
      this.dispatchEvent(new CustomEvent("next", { bubbles: true, composed: true }))
    );
    // Playback speed: dynamic <select> populated from window.PLAYBACK_RATES.
    const rateSel = this.$("rate");
    const rates = window.PLAYBACK_RATES || [];
    rateSel.innerHTML = rates
      .map((r) => `<option value="${r}">${r}×</option>`)
      .join("");
    rateSel.addEventListener("change", () =>
      this.dispatchEvent(
        new CustomEvent("rate", {
          bubbles: true,
          composed: true,
          detail: { value: parseFloat(rateSel.value) },
        })
      )
    );
    this.$("setA").addEventListener("click", () =>
      this.dispatchEvent(new CustomEvent("ab-a", { bubbles: true, composed: true }))
    );
    this.$("setB").addEventListener("click", () =>
      this.dispatchEvent(new CustomEvent("ab-b", { bubbles: true, composed: true }))
    );
    this.$("abClear").addEventListener("click", () =>
      this.dispatchEvent(new CustomEvent("ab-clear", { bubbles: true, composed: true }))
    );
    this.$("loop").addEventListener("click", () =>
      this.dispatchEvent(new CustomEvent("loop", { bubbles: true, composed: true }))
    );
    const vol = this.$("vol");
    vol.addEventListener("input", () =>
      this.dispatchEvent(
        new CustomEvent("volume", {
          bubbles: true,
          composed: true,
          detail: { value: parseFloat(vol.value) },
        })
      )
    );

    // Seek drag
    const seek = this.$("seek");
    const ratioFromEvent = (e) => {
      const r = seek.getBoundingClientRect();
      return Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
    };
    const down = (e) => {
      this._dragging = true;
      seek.setPointerCapture(e.pointerId);
      this.dispatchEvent(
        new CustomEvent("seek", { bubbles: true, composed: true, detail: { ratio: ratioFromEvent(e) } })
      );
    };
    const move = (e) => {
      if (!this._dragging) return;
      this.dispatchEvent(
        new CustomEvent("seek", { bubbles: true, composed: true, detail: { ratio: ratioFromEvent(e) } })
      );
    };
    const up = (e) => {
      this._dragging = false;
      try { seek.releasePointerCapture(e.pointerId); } catch (_) {}
    };
    seek.addEventListener("pointerdown", down);
    seek.addEventListener("pointermove", move);
    seek.addEventListener("pointerup", up);
  }

  setState(s) {
    this._state = s || {};
    const $ = this.$;
    if (!$) return;
    $("title").textContent = s.title || "未选择音频";
    $("sub").textContent = s.sub || "";
    $("cur").textContent = fmt(s.currentTime || 0);
    $("dur").textContent = fmt(s.duration || 0);

    const ratio = s.duration ? (s.currentTime || 0) / s.duration : 0;
    $("fill").style.width = (ratio * 100).toFixed(2) + "%";
    $("knob").style.left = (ratio * 100).toFixed(2) + "%";

    $("play").textContent = s.playing ? "⏸" : "▶";

    // Rate select
    if ($("rate") && $("rate").tagName === "SELECT") {
      $("rate").value = String(s.rate || 1);
    }

    // Volume (avoid feedback loop while user drags)
    if (document.activeElement !== $("vol")) $("vol").value = s.volume != null ? s.volume : 1;

    // A-B markers & info
    const markA = $("markA"), markB = $("markB");
    if (s.abA != null && s.duration) {
      markA.style.display = "block";
      markA.style.left = ((s.abA / s.duration) * 100).toFixed(2) + "%";
    } else markA.style.display = "none";
    if (s.abB != null && s.duration) {
      markB.style.display = "block";
      markB.style.left = ((s.abB / s.duration) * 100).toFixed(2) + "%";
    } else markB.style.display = "none";

    if (s.abA != null && s.abB != null) {
      $("abinfo").textContent = "A–B 复读：" + fmt(s.abA) + " → " + fmt(s.abB);
    } else if (s.abA != null) {
      $("abinfo").textContent = "A 点已设：" + fmt(s.abA) + "（再点 B 设定区间）";
    } else {
      $("abinfo").textContent = "";
    }
    $("setA").classList.toggle("on", s.abA != null);
    $("setB").classList.toggle("on", s.abB != null);
    $("loop").classList.toggle("on", !!s.loop);

    $("err").textContent = s.error || "";
  }
}

customElements.define("audio-player", AudioPlayer);
