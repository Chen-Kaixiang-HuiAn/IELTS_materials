/* ============================================================
   listening-boot.js — entry point for the Listening page.
   Components self-register on load; this file just reports status.
   ============================================================ */

(function () {
  if (!window.AUDIO_LIBRARY) {
    console.warn("[IELTS UI] AUDIO_LIBRARY 未加载，请确认 UI/listening/manifest.js 已包含。");
  }
  console.log(
    "[IELTS UI] Listening player ready · " +
      ((window.AUDIO_LIBRARY || []).length) +
      " books loaded."
  );
})();
