# frontend/Dockerfile
# Multi-stage build for the Court Command frontend
#
# Build args:
#   VITE_API_URL            - Backend API URL (e.g. https://api.courtcommand.app)
#   VITE_GOOGLE_MAPS_API_KEY - Google Maps API key

FROM node:20-alpine AS builder

# Pin pnpm to match lockfile version
RUN corepack enable && corepack prepare pnpm@10.33.0 --activate

WORKDIR /app

# Build args for Vite — only declare what we need
ARG VITE_API_URL
ARG VITE_GOOGLE_MAPS_API_KEY

# Install dependencies with NODE_ENV=development to include devDeps
COPY package.json pnpm-lock.yaml ./
RUN NODE_ENV=development pnpm install --frozen-lockfile

# Copy source and build
COPY . .
RUN NODE_ENV=production pnpm run build

FROM nginx:alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html
EXPOSE 80
