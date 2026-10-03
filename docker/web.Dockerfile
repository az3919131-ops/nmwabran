# ───────── بناء الواجهة ─────────
FROM node:20-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json tsconfig.base.json ./
COPY packages/core/package.json packages/core/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN npm ci --ignore-scripts
COPY packages packages
COPY apps/web apps/web
RUN npm run build -w @iltizam/web

# ───────── nginx: يخدم الواجهة ويمرّر /api إلى الخادم ─────────
FROM nginx:1.27-alpine
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
EXPOSE 5173
HEALTHCHECK --interval=15s --timeout=5s CMD wget -qO- http://127.0.0.1:5173/ >/dev/null || exit 1
