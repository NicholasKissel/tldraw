# Build stage - builds the full monorepo then the template
FROM node:20-slim AS builder

# Install dependencies for native modules
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    git \
    && rm -rf /var/lib/apt/lists/*

# Enable corepack for yarn 4
RUN corepack enable

WORKDIR /app

# Copy everything needed for yarn install
# The .dockerignore at repo root excludes node_modules, dist, .git, etc.
COPY package.json yarn.lock .yarnrc.yml ./
COPY .yarn/patches ./.yarn/patches

# Copy all workspace package.json files (yarn needs them all)
# Using find to copy just package.json files first for better caching
COPY packages/ ./packages/
COPY templates/ ./templates/
COPY apps/ ./apps/
COPY internal/ ./internal/

# Install all dependencies
RUN yarn install

# Copy config files needed for build
COPY lazy.config.ts tsconfig.json ./

# Build required workspace packages
RUN yarn build \
    --filter='@tldraw/state' \
    --filter='@tldraw/utils' \
    --filter='@tldraw/validate' \
    --filter='@tldraw/store' \
    --filter='@tldraw/tlschema' \
    --filter='@tldraw/assets' \
    --filter='@tldraw/editor' \
    --filter='@tldraw/sync-core' \
    --filter='@tldraw/sync' \
    --filter='tldraw'

# Build the sync-rivet template
WORKDIR /app/templates/sync-rivet
RUN yarn build

# Production stage - minimal image
FROM node:20-slim AS runner

RUN corepack enable

WORKDIR /app

# Copy the built server and client
COPY --from=builder /app/templates/sync-rivet/dist ./dist

# Copy package.json for yarn start
COPY --from=builder /app/templates/sync-rivet/package.json ./

# Copy node_modules with resolved workspace dependencies
COPY --from=builder /app/templates/sync-rivet/node_modules ./node_modules

# srvx serves static from public/ - copy built client assets there
RUN cp -r dist/public ./public

# Environment variables (override at runtime)
ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

# Run the production server
CMD ["npx", "srvx", "--static=public/", "dist/server.js"]
