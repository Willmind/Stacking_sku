import { createPinia } from "pinia";
import { createApp } from "vue";
import VueKonva from "vue-konva";
import App from "./App.vue";
import { initializeTheme } from "./composables/useTheme";
import "./styles/tokens.css";
import "./styles/global.css";

initializeTheme();
createApp(App).use(createPinia()).use(VueKonva).mount("#app");
