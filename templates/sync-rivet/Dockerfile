# Build stage
FROM node:20-slim AS builder

# Install dependencies for native modules
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files
COPY templates/sync-rivet/package.json ./
COPY templates/sync-rivet/tsconfig.json ./

# Install dependencies
RUN npm install

# Copy source files
COPY templates/sync-rivet/client ./client
COPY templates/sync-rivet/server ./server
COPY templates/sync-rivet/vite.config.ts ./
COPY templates/sync-rivet/index.html ./

# Build
RUN npm run build

# Production stage
FROM node:20-slim AS runner

WORKDIR /app

# Install srvx globally
RUN npm install -g srvx

# Copy built files
COPY --from=builder /app/dist ./dist

# Copy static assets
RUN cp -r dist/public ./public

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

CMD ["srvx", "--static=public/", "dist/server.js"]
