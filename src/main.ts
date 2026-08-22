import { createApp } from "vue";
import App from "./App.vue";
import { settingsManager } from "./settings/settingsManager";

void settingsManager.initialize();
createApp(App).mount("#app");
