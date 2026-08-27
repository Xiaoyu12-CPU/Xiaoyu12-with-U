import { createApp } from "vue";
import { invoke, isTauri } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import App from "./App.vue";
import { settingsManager } from "./settings/settingsManager";

/**
 * Temporary battery of bootstrap diagnostics for the Windows
 * control-center white screen. Every line is mirrored to the on-screen
 * error banner AND to app_data_dir/diagnostic.log (via the Rust command
 * write_diagnostic_line). Remove once the issue is fixed.
 */

let banner: HTMLDivElement | undefined;

function showBanner(message: string): void {
  try {
    if (!banner) {
      banner = document.createElement("div");
      banner.style.cssText = [
        "position: fixed",
        "top: 0",
        "left: 0",
        "right: 0",
        "z-index: 2147483647",
        "padding: 10px 12px",
        "background: #b91c1c",
        "color: #ffffff",
        "font: 12px/1.5 monospace",
        "white-space: pre-wrap",
        "word-break: break-all",
      ].join(";");
      document.body.appendChild(banner);
    }
    banner.textContent = message;
  } catch {
    // Banner must never break the app.
  }
}

function diag(message: string): void {
  console.error(`[withXiaoyu12-diag] ${message}`);
  showBanner(message);
  if (!isTauri()) {
    return;
  }
  void invoke("write_diagnostic_line", { line: message }).catch(() => {
    // Logging must never break the app.
  });
}

window.addEventListener("error", (event) => {
  diag(
    `window-error: ${event.message} @ ${event.filename}:${event.lineno}:${event.colno}`,
  );
});

window.addEventListener("unhandledrejection", (event) => {
  diag(`unhandled-rejection: ${String(event.reason)}`);
});

try {
  diag(`bootstrap url=${window.location.href} label=${getCurrentWindow().label}`);
} catch (error) {
  diag(`bootstrap label-error: ${String(error)}`);
}

const app = createApp(App);
app.config.errorHandler = (error, _instance, info) => {
  diag(`vue-error: ${String(error)} info=${info}`);
};
app.mount("#app");
diag("app-mounted");

void settingsManager.initialize();
