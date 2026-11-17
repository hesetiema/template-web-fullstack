# syntax=docker/dockerfile:1

# ---------- Stage 1: base with pnpm ----------
FROM node:22-alpine AS base
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@10.0.0 --activate

# ---------- Stage 2: install dependencies (layer cached) ----------
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json ./apps/web/
RUN pnpm install --frozen-lockfile

# ---------- Stage 3: build ----------
FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/web/node_modules ./apps/web/node_modules
COPY . .
RUN pnpm --filter @template/web build

# ---------- Stage 4: runtime (nginx, non-root) ----------
FROM nginxinc/nginx-unprivileged:1.27-alpine AS runtime
WORKDIR /usr/share/nginx/html
COPY --from=build /app/apps/web/dist ./
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 8080
# Port 8080 is used because the unprivileged image cannot bind to 80.
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:8080/health || exit 1
