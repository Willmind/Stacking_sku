import { createPinia } from "pinia";
import { createApp } from "vue";
import VueKonva from "vue-konva";
import App from "./App.vue";
import "./styles/tokens.css";
import "./styles/global.css";

createApp(App).use(createPinia()).use(VueKonva).mount("#app");
