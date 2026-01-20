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

# Copy lazyrepo config
COPY lazy.config.ts ./

# Install dependencies (skip postinstall that needs git for husky)
RUN yarn install --mode=skip-build

# Run refresh-assets manually (needed for build)
RUN yarn run -T tsx internal/scripts/refresh-assets.ts

# Run typecheck to generate .tsbuild files
RUN yarn run -T tsx internal/scripts/typecheck.ts

# Run build-api to generate api/public.d.ts files (needed by build)
RUN yarn workspace @tldraw/utils build-api
RUN yarn workspace @tldraw/validate build-api
RUN yarn workspace @tldraw/state build-api
RUN yarn workspace @tldraw/store build-api
RUN yarn workspace @tldraw/tlschema build-api
RUN yarn workspace @tldraw/editor build-api
RUN yarn workspace @tldraw/sync-core build-api
RUN yarn workspace @tldraw/sync build-api
RUN yarn workspace tldraw build-api

# Build the packages we need using workspace commands
RUN yarn workspace @tldraw/utils build
RUN yarn workspace @tldraw/validate build
RUN yarn workspace @tldraw/state build
RUN yarn workspace @tldraw/store build
RUN yarn workspace @tldraw/tlschema build
RUN yarn workspace @tldraw/editor build
RUN yarn workspace @tldraw/sync-core build
RUN yarn workspace @tldraw/sync build
RUN yarn workspace tldraw build

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
