# ───────── بناء الخادم ─────────
FROM node:20-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json tsconfig.base.json ./
COPY packages/core/package.json packages/core/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN npm ci --ignore-scripts
COPY packages packages
COPY apps/api apps/api
RUN npm run build -w @iltizam/api

# ───────── صورة التشغيل: Node + Chromium (لتوليد PDF) + خطوط عربية ─────────
FROM node:20-bookworm-slim
ENV NODE_ENV=production PORT=3000 TZ=Asia/Riyadh \
    CHROMIUM_PATH=/usr/bin/chromium PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 \
    STORAGE_DIR=/data/storage
RUN apt-get update \
 && apt-get install -y --no-install-recommends chromium fonts-noto-core fonts-noto-ui-core fonts-liberation fonts-dejavu-core tini ca-certificates curl tzdata \
 && rm -rf /var/lib/apt/lists/* \
 && mkdir -p /data/storage && chown -R node:node /data
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/core/package.json packages/core/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN npm ci --omit=dev --ignore-scripts -w @iltizam/api --include-workspace-root && npm cache clean --force
COPY --from=build /app/apps/api/dist apps/api/dist
COPY apps/api/drizzle apps/api/drizzle
WORKDIR /app/apps/api
USER node
EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=5s --start-period=40s --retries=5 CMD curl -fsS http://127.0.0.1:3000/api/v1/health || exit 1
ENTRYPOINT ["tini", "--"]
CMD ["node", "dist/server.js"]
