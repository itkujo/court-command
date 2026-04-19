# frontend/Dockerfile
# Multi-stage build for the Court Command frontend
#
# Build args (set in Coolify as build-time env vars):
#   VITE_API_URL            - Backend API URL (e.g. https://api.courtcommand.app)
#   VITE_GOOGLE_MAPS_API_KEY - Google Maps API key

FROM node:20-alpine AS builder
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app

# Declare build args — Vite reads these as env vars during build
ARG VITE_API_URL
ARG VITE_GOOGLE_MAPS_API_KEY

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build

FROM nginx:alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html
EXPOSE 80
