import { defineConfig } from "vite";
import { templateCompilerOptions } from "@tresjs/core";
import vue from "@vitejs/plugin-vue";

export default defineConfig({
  base: "./",
  plugins: [vue({ ...templateCompilerOptions })],
  build: {
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            {
              name: "vendor-three",
              test: /node_modules[\\/]three/,
              priority: 30,
              maxSize: 500_000,
            },
            {
              name: "vendor-tres",
              test: /node_modules[\\/]@tresjs/,
              priority: 20,
              maxSize: 650_000,
            },
            {
              name: "vendor-konva",
              test: /node_modules[\\/](?:konva|vue-konva)/,
              priority: 20,
              maxSize: 650_000,
            },
          ],
        },
      },
    },
  },
  test: {
    environment: "jsdom",
    include: ["tests/**/*.test.ts"],
  },
});
