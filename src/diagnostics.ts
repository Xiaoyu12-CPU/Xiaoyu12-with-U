import { invoke, isTauri } from "@tauri-apps/api/core";

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
    // The banner must never break the app.
  }
}

/**
 * Temporary diagnostics channel for the Windows control-center white
 * screen. Mirrors every line to the on-screen red banner and to
 * app_data_dir/diagnostic.log (Rust command write_diagnostic_line).
 * Remove once the issue is understood.
 */
export function diag(message: string): void {
  console.error(`[withXiaoyu12-diag] ${message}`);
  showBanner(message);
  if (!isTauri()) {
    return;
  }
  void invoke("write_diagnostic_line", { line: message }).catch(() => {
    // Logging must never break the app.
  });
}
