import { defineConfig } from "tsup";
export default defineConfig({
  entry: { server: "src/server.ts", "db/migrate": "src/db/migrate.ts", "db/seed-cli": "src/db/seed-cli.ts" },
  format: ["esm"],
  target: "node20",
  platform: "node",
  outDir: "dist",
  clean: true,
  sourcemap: true,
  // نضمّن حزمة core (TS مباشر) داخل الحزمة الناتجة؛ بقية الاعتماديات تبقى خارجية
  noExternal: ["@iltizam/core"],
  banner: { js: "import { createRequire as __cr } from 'module'; const require = __cr(import.meta.url);" },
});
