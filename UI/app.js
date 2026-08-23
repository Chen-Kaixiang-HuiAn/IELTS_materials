/* ============================================================
   app.js — entry point for the IELTS materials web UI.
   Components self-register on load; this file is the place to
   add future sections (Reading / Writing / Speaking) later.
   ============================================================ */

(function () {
  if (!window.AUDIO_LIBRARY) {
    console.warn("[IELTS UI] AUDIO_LIBRARY 未加载，请确认 UI/manifest.js 已包含。");
  }
  console.log(
    "[IELTS UI] Listening player ready · " +
      ((window.AUDIO_LIBRARY || []).length) +
      " books loaded."
  );
})();
