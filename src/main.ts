import { createApp } from "vue";
import App from "./App.vue";
import { i18nPlugin } from "./i18n";
import { settingsManager } from "./settings/settingsManager";

void settingsManager.initialize();
createApp(App).use(i18nPlugin).mount("#app");
