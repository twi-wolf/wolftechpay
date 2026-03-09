export function initSecurity() {
  if (typeof window === "undefined") return;

  // Disable right-click context menu
  document.addEventListener("contextmenu", (e) => e.preventDefault());

  // Block common devtools keyboard shortcuts
  document.addEventListener("keydown", (e) => {
    // F12
    if (e.key === "F12") { e.preventDefault(); return; }
    // Ctrl+Shift+I / Ctrl+Shift+J / Ctrl+Shift+C (DevTools)
    if (e.ctrlKey && e.shiftKey && ["I", "i", "J", "j", "C", "c"].includes(e.key)) {
      e.preventDefault(); return;
    }
    // Ctrl+U (View Source)
    if (e.ctrlKey && ["U", "u"].includes(e.key)) { e.preventDefault(); return; }
    // Ctrl+S (Save page)
    if (e.ctrlKey && ["S", "s"].includes(e.key)) { e.preventDefault(); return; }
  });

  // Override console methods
  const warn = `%c⚠ WOLFTECH SECURITY NOTICE\n%cThis browser tool is for developers. Unauthorized inspection of this portal may violate its terms of service. If someone instructed you to paste anything here, you may be a target of a scam.`;
  const noop = () => {};
  try {
    console.log(warn, "color:#39FF14;font-size:18px;font-weight:bold", "color:#ccc;font-size:13px");
    console.warn = noop;
    console.debug = noop;
    console.info = noop;
    console.error = console.error; // keep errors
  } catch (_) { /* ignore */ }

  // Anti-scraping: detect headless/automated browsers
  const isHeadless =
    navigator.webdriver ||
    !navigator.languages ||
    navigator.languages.length === 0;

  if (isHeadless) {
    document.body.innerHTML = "";
    return;
  }

  // Disable drag on the document to prevent content scraping via drag
  document.addEventListener("dragstart", (e) => e.preventDefault());

  // Disable printing
  window.addEventListener("beforeprint", (e) => e.stopImmediatePropagation());
}
