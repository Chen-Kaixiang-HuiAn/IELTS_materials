/* ============================================================
   listening-player.js — <listening-player>
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

class ListeningPlayer extends HTMLElement {
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
        .ab-range{position:absolute;top:0;height:100%;background:var(--accent);opacity:.28;
          border-radius:4px;left:0;width:0;display:none;}
        .times{display:flex;justify-content:space-between;font-size:12px;color:var(--muted);margin-top:-4px;}
        .controls{display:flex;align-items:center;gap:8px;flex-wrap:wrap;}
        /* 控件分组：桌面端整体横排，标签隐藏；移动端竖向堆叠，标签显示 */
        .ctl-play{display:inline-flex;align-items:center;gap:8px;}
        .ctl-row{display:inline-flex;align-items:center;gap:8px;}
        .ctl-row .lbl{display:none;}
        .play{width:46px;height:38px;border-radius:10px;background:var(--accent-grad);color:var(--on-accent);
          border:none;font-size:17px;font-weight:700;display:inline-flex;align-items:center;justify-content:center;}
        .play .ico{display:inline-flex;align-items:center;justify-content:center;width:1em;height:1em;line-height:0;}
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
        /* ── 移动端：控件直接向下堆叠，分组排布（不收起） ── */
        @media (max-width:768px){
          .player{padding:12px 14px calc(12px + env(safe-area-inset-bottom,0));gap:10px;}
          /* 移动端：在播放器上方显示正在播放的曲目信息 */
          .meta{display:block;margin-bottom:1px;}
          .meta .title{font-size:15px;font-weight:700;line-height:1.3;}
          .meta .sub{font-size:12px;color:var(--muted);margin-top:2px;line-height:1.3;}
          .meta .abinfo{font-size:12px;color:var(--accent);margin-top:3px;min-height:0;}
          .meta .err{font-size:11.5px;min-height:0;margin-top:3px;}
          .seek{height:30px;margin-top:2px;}
          .seek-track{height:8px;}
          .seek-knob{width:18px;height:18px;}
          .ab-mark{width:4px;height:22px;}
          .ab-range{opacity:.34;display:block;}
          .times{font-size:13px;margin-top:-2px;font-variant-numeric:tabular-nums;}
          /* 控件整体竖向堆叠，每行一个功能组 */
          .controls{display:flex;flex-direction:column;align-items:stretch;gap:12px;flex-wrap:nowrap;}
          /* 播放行：三段居中 */
          .ctl-play{display:flex;align-items:center;justify-content:center;gap:18px;}
          .ctl-play .play{width:54px;height:46px;border-radius:12px;font-size:20px;}
          .ctl-play .icon-btn{width:48px;height:44px;font-size:18px;}
          /* 倍速 / A-B / 音量：标签在左，控件在右 */
          .ctl-row{display:flex;align-items:center;justify-content:space-between;gap:10px;
            border-top:1px solid var(--border);padding-top:11px;}
          .ctl-row .lbl{display:block;flex:none;font-size:13px;color:var(--muted);}
          .ctl-row .rate-select{height:40px;min-width:88px;font-size:15px;font-weight:600;
            padding:0 10px;margin-left:auto;}
          .ctl-row .ab-group{border-left:none;padding-left:0;margin-left:auto;gap:8px;}
          .ctl-row .ab-btn{width:44px;height:42px;font-weight:700;font-size:14px;}
          .ctl-row .vol{margin-left:auto;flex:1;max-width:220px;}
          .ctl-row .vol input{width:100%;flex:1;}
        }
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
            <div class="ab-range" id="abRange"></div>
            <div class="ab-mark" id="markA"></div>
            <div class="ab-mark" id="markB"></div>
            <div class="seek-knob" id="knob"></div>
          </div>
        </div>
        <div class="times"><span id="cur">0:00</span><span id="dur">0:00</span></div>

        <!-- 控件：桌面横排 / 移动端向下分组堆叠 -->
        <div class="controls">
          <div class="ctl-play">
            <button class="icon-btn" id="prev" title="上一段">⏮</button>
            <button class="play" id="play" title="播放/暂停"><span class="ico" id="playIco"></span></button>
            <button class="icon-btn" id="next" title="下一段">⏭</button>
          </div>
          <div class="ctl-row">
            <span class="lbl">倍速</span>
            <select class="rate-select" id="rate" title="播放倍速"></select>
          </div>
          <div class="ctl-row">
            <span class="lbl">A–B 复读</span>
            <div class="ab-group">
              <button class="ab-btn" id="setA" title="设 A 点">A</button>
              <button class="ab-btn" id="setB" title="设 B 点">B</button>
              <button class="ab-btn" id="abClear" title="清除 A-B">✕</button>
              <button class="ab-btn" id="loop" title="单段循环">↻</button>
            </div>
          </div>
          <div class="ctl-row">
            <span class="lbl">音量</span>
            <div class="vol"><span>🔈</span><input type="range" id="vol" min="0" max="1" step="0.01" value="1"></div>
          </div>
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

    // 播放/暂停图标用矢量绘制，保证两种状态视觉尺寸一致（不依赖字体字形）
    $("playIco").innerHTML = s.playing
      ? '<svg viewBox="0 0 24 24" width="1em" height="1em" fill="currentColor"><rect x="6" y="5" width="4" height="14" rx="1.2"/><rect x="14" y="5" width="4" height="14" rx="1.2"/></svg>'
      : '<svg viewBox="0 0 24 24" width="1em" height="1em" fill="currentColor"><path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.5-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z"/></svg>';

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

    // A-B 区间色带（仅移动端显示，桌面端保留竖线标记）
    const abRange = $("abRange");
    const isMobile = window.matchMedia && window.matchMedia("(max-width:768px)").matches;
    if (abRange && isMobile && s.abA != null && s.abB != null && s.duration) {
      const a = (s.abA / s.duration) * 100;
      const b = (s.abB / s.duration) * 100;
      abRange.style.left = a.toFixed(2) + "%";
      abRange.style.width = (b - a).toFixed(2) + "%";
      abRange.style.display = "block";
    } else if (abRange) {
      abRange.style.display = "none";
    }

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

defineComponent("listening-player", ListeningPlayer);
