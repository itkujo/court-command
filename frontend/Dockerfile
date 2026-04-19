# frontend/Dockerfile
# Multi-stage build for the Court Command frontend
#
# Build args (set in Coolify as build-time env vars):
#   VITE_API_URL            - Backend API URL (e.g. https://api.courtcommand.app)
#   VITE_GOOGLE_MAPS_API_KEY - Google Maps API key

FROM node:20-alpine AS builder
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app

# Only declare the build args we actually need.
# Coolify injects many others (DATABASE_URL, POSTGRES_PASSWORD, etc.) but we
# intentionally do NOT declare them as ARG so they're ignored in this stage.
ARG VITE_API_URL
ARG VITE_GOOGLE_MAPS_API_KEY

COPY package.json pnpm-lock.yaml ./
RUN NODE_ENV=development pnpm install --frozen-lockfile
COPY . .
# Use shell form with explicit env to avoid any leaked ARGs interfering
RUN set -e; \
    export NODE_ENV=production; \
    export NODE_OPTIONS="--max-old-space-size=512"; \
    pnpm build

FROM nginx:alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html
EXPOSE 80
