import { createApp } from "vue";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { diag } from "./diagnostics";
import App from "./App.vue";
import { settingsManager } from "./settings/settingsManager";

/**
 * Temporary bootstrap diagnostics for the Windows control-center white
 * screen. Every line is mirrored to the on-screen banner and to
 * app_data_dir/diagnostic.log. Remove once the issue is fixed.
 */

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

try {
  void getCurrentWindow().onCloseRequested(() => {
    diag("close-requested (frontend)");
  });
} catch (error) {
  diag(`close-requested-setup-error: ${String(error)}`);
}

const app = createApp(App);
app.config.errorHandler = (error, _instance, info) => {
  diag(`vue-error: ${String(error)} info=${info}`);
};
app.mount("#app");
diag("app-mounted");

void settingsManager.initialize();
