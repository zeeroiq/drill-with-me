# ==============================================================================
# JavaDrill Multi-Stage Production Dockerfile
# Stage 1: Builder (Node.js 22 + build tools for React & TypeScript)
# Stage 2: Production Runtime (Node.js 22 + OpenJDK 21 JDK sandbox)
# ==============================================================================

# ------------------------------------------------------------------------------
# Stage 1: Builder
# ------------------------------------------------------------------------------
FROM node:22-bookworm AS builder

WORKDIR /app

# Copy package manifests across workspaces for optimal layer caching
COPY package.json package-lock.json* ./
COPY server/package.json ./server/
COPY client/package.json ./client/

# Install full dependencies (including devDependencies required for compilation)
RUN npm ci

# Copy full repository source
COPY . .

# Build frontend React bundle (client/dist) and backend TypeScript (server/dist)
RUN npm run build

# Prune development dependencies to keep production footprint minimal
RUN npm prune --omit=dev

# ------------------------------------------------------------------------------
# Stage 2: Production Runtime
# ------------------------------------------------------------------------------
FROM eclipse-temurin:21-jdk-bookworm-slim AS runtime

LABEL maintainer="ZeeroIQ Platform Team"
LABEL description="DrillWithMe Production Container with Node.js 22 and OpenJDK 21 Sandbox"

# Install curl for container healthcheck and ca-certificates
RUN apt-get update && \
    apt-get install -y --no-install-recommends curl ca-certificates && \
    rm -rf /var/lib/apt/lists/*

# Copy Node.js 22 runtime binaries, npm, and headers from official Node image
COPY --from=node:22-bookworm-slim /usr/local /usr/local

# Verify during image build that both OpenJDK 21 and Node.js 22 run smoothly
RUN javac -version && java -version && node -v

# Create dedicated unprivileged non-root user and group
RUN groupadd -g 10001 appuser && \
    useradd -u 10001 -g appuser -m -s /bin/sh appuser

# Set up directory layout with strict permission isolation:
# - /app: Application code, node_modules, and client bundle
# - /data: SQLite persistence directory (private to appuser, mode 700)
# - /tmp: Ephemeral scratch directory for isolated Java runner (mode 1777)
RUN mkdir -p /app /data /tmp && \
    chown -R appuser:appuser /app && \
    chown -R appuser:appuser /data && \
    chmod 700 /data && \
    chmod 1777 /tmp

WORKDIR /app

# Copy production assets and dependencies from builder stage
COPY --chown=appuser:appuser --from=builder /app/package.json ./package.json
COPY --chown=appuser:appuser --from=builder /app/node_modules ./node_modules
COPY --chown=appuser:appuser --from=builder /app/server/package.json ./server/package.json
COPY --chown=appuser:appuser --from=builder /app/server/dist ./server/dist
COPY --chown=appuser:appuser --from=builder /app/client/package.json ./client/package.json
COPY --chown=appuser:appuser --from=builder /app/client/dist ./client/dist
COPY --chown=appuser:appuser --from=builder /app/scripts ./scripts

# Set default production environment variables
ENV NODE_ENV=production \
    PORT=3000 \
    SQLITE_DB_PATH=/data/app.db

# Health check probing the server /health endpoint
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

# Run container process as non-root user
USER appuser

# Expose HTTP port
EXPOSE 3000

# Start server entrypoint
CMD ["node", "server/dist/index.js"]
