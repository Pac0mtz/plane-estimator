const SUBTITLE = "Trace plan sets, price takeoffs";

/** Boot-time fixes for /plan-estimator — hide host subtitle before first paint. */
export function bootPlanEstimatorEmbed() {
  if (typeof window === "undefined") return () => {};
  if (!window.location.pathname.includes("plan-estimator")) return () => {};

  document.documentElement.classList.add("plan-estimator-page");

  const style = document.createElement("style");
  style.id = "plan-estimator-embed-fixes";
  style.textContent = `
    html.plan-estimator-page .document-chrome-page-header p.text-muted-foreground,
    html.plan-estimator-page .document-chrome-page-header [data-page-header="subtitle"],
    html.plan-estimator-page .document-chrome-toolbar-container p.text-xs.leading-snug,
    html.plan-estimator-page p.text-muted-foreground.mt-0\\.5.text-xs.leading-snug { display: none !important; }
  `;
  document.head.appendChild(style);

  const hideSubtitleNodes = () => {
    document.querySelectorAll("p").forEach((el) => {
      if (el.textContent.includes(SUBTITLE)) el.style.display = "none";
    });
  };

  hideSubtitleNodes();
  const observer = new MutationObserver(hideSubtitleNodes);
  observer.observe(document.body, { childList: true, subtree: true });

  return () => {
    observer.disconnect();
    style.remove();
    document.documentElement.classList.remove("plan-estimator-page");
  };
}
