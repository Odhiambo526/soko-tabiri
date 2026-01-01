# Settlement Service Dockerfile
# Privacy: ONLY service with Zcash key access (via KMS/HSM).
# Default: shielded-only (z-to-z). T-address flows require explicit flags.

# ASSUMPTION: Node.js 18 (LTS) - not specified in repo
FROM node:18-alpine

WORKDIR /app

# Install dependencies for health checks and gRPC
RUN apk add --no-cache wget

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install --omit=dev

# Copy proto files
COPY proto ./proto

# Copy source code
COPY . .

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 -G nodejs && \
    chown -R nodejs:nodejs /app

USER nodejs

# Expose port
EXPOSE 3003

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget -q --spider http://localhost:3003/health || exit 1

# Start service
CMD ["node", "src/index.js"]

