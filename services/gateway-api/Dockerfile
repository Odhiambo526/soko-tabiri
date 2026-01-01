# Gateway API Service Dockerfile
# Privacy: This service handles user-facing requests. No direct Zcash key access.

# ASSUMPTION: Node.js 18 (LTS) - not specified in repo
FROM node:18-alpine

WORKDIR /app

# Install dependencies for health checks
RUN apk add --no-cache wget

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install --omit=dev

# Copy source code
COPY . .

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 -G nodejs && \
    chown -R nodejs:nodejs /app

USER nodejs

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget -q --spider http://localhost:3001/health || exit 1

# Start service
CMD ["node", "src/index.js"]

