/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// base "./" يجعل البناء قابلًا للنشر على أي مسار (GitHub Pages، Netlify، nginx…) والتوجيه يعتمد على الـ hash.
export default defineConfig({
  base: "./",
  plugins: [react(), tailwindcss()],
  server: { port: 5180, host: true },
  preview: { port: 5180, host: true },
  test: {
    environment: "jsdom",
    include: ["test/**/*.test.ts", "test/**/*.test.tsx"],
  },
});
