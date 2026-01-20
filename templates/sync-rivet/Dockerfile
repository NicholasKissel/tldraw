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
COPY package.json yarn.lock .yarnrc.yml ./
COPY .yarn/patches ./.yarn/patches

# Copy all workspace directories
COPY packages/ ./packages/
COPY templates/ ./templates/
COPY apps/ ./apps/
COPY internal/ ./internal/
COPY assets/ ./assets/

# Copy config files needed for build
COPY lazy.config.ts tsdoc.json ./

# Install dependencies (skip postinstall that needs git for husky)
# YARN_CHECKSUM_BEHAVIOR=ignore handles checksum mismatches from pkg.pr.new preview packages
RUN YARN_CHECKSUM_BEHAVIOR=ignore yarn install --mode=skip-build

# Run refresh-assets manually (needed for build)
RUN yarn run -T tsx internal/scripts/refresh-assets.ts

# Run typecheck to generate .tsbuild files
RUN yarn run -T tsx internal/scripts/typecheck.ts

# Run build-api to generate api/public.d.ts files (tsdoc.json defines @react tag)
RUN yarn workspace @tldraw/utils build-api && \
    yarn workspace @tldraw/validate build-api && \
    yarn workspace @tldraw/state build-api && \
    yarn workspace @tldraw/state-react build-api && \
    yarn workspace @tldraw/store build-api && \
    yarn workspace @tldraw/tlschema build-api && \
    yarn workspace @tldraw/editor build-api && \
    yarn workspace @tldraw/sync-core build-api && \
    yarn workspace @tldraw/sync build-api && \
    yarn workspace tldraw build-api

# Build the packages we need using workspace commands
RUN yarn workspace @tldraw/utils build && \
    yarn workspace @tldraw/validate build && \
    yarn workspace @tldraw/state build && \
    yarn workspace @tldraw/state-react build && \
    yarn workspace @tldraw/store build && \
    yarn workspace @tldraw/tlschema build && \
    yarn workspace @tldraw/editor build && \
    yarn workspace @tldraw/sync-core build && \
    yarn workspace @tldraw/sync build && \
    yarn workspace tldraw build

# Build the sync-rivet template
WORKDIR /app/templates/sync-rivet
RUN yarn build

# Production stage - minimal image
FROM node:20-slim AS runner

WORKDIR /app

# Copy the built server and client
# Server is fully bundled (ssr.noExternal: true) so no node_modules needed
COPY --from=builder /app/templates/sync-rivet/dist ./dist

# srvx serves static from public/ - copy built client assets there
RUN cp -r dist/public ./public

# Environment variables (override at runtime)
ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

# Run the production server directly with node
CMD ["node", "dist/server.js"]
