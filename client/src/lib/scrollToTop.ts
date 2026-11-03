/**
 * Scrolls the page back to the top. Studio pages scroll inside their <main> panel rather than the
 * window, so both are reset.
 */
export function scrollToTop() {
  if (typeof window === "undefined") return;
  window.scrollTo({ top: 0 });
  document.querySelectorAll("main").forEach(el => el.scrollTo({ top: 0 }));
}
