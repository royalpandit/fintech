import { TRADINGVIEW_EMBED_SCRIPT_URL } from "@/components/tradingview/constants";

const SCRIPT_SRC_ATTR = "data-tv-embed-src";

/**
 * Creates the official TradingView embed script (src + JSON config body).
 * The browser caches `embed-widget-advanced-chart.js` after the first fetch.
 */
export function createWidgetEmbedScript(
  configJson: string,
  instanceId: string,
): HTMLScriptElement {
  const script = document.createElement("script");
  script.type = "text/javascript";
  script.async = true;
  script.src = TRADINGVIEW_EMBED_SCRIPT_URL;
  script.text = configJson;
  script.setAttribute(SCRIPT_SRC_ATTR, TRADINGVIEW_EMBED_SCRIPT_URL);
  script.setAttribute("data-tv-widget-instance", instanceId);
  return script;
}

/**
 * Removes any prior embed script for this container to avoid duplicate widgets
 * when props change or React Strict Mode re-runs effects.
 */
export function clearWidgetContainer(container: HTMLElement): void {
  container
    .querySelectorAll(`script[${SCRIPT_SRC_ATTR}]`)
    .forEach((node) => node.remove());
  container.replaceChildren();
}
