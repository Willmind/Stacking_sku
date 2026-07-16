import { defineConfig } from "vite";
import { templateCompilerOptions } from "@tresjs/core";
import vue from "@vitejs/plugin-vue";

export default defineConfig({
  base: "./",
  plugins: [vue({ ...templateCompilerOptions })],
  optimizeDeps: {
    include: ["fflate", "read-excel-file/browser"],
  },
  test: {
    environment: "jsdom",
    include: ["tests/**/*.test.ts"],
  },
});
