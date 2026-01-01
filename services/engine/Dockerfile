# Engine Service Dockerfile (AMM + Orderbook)
# Privacy: Performs AMM math and orderbook matching. No access to Zcash keys.

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
EXPOSE 3002

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget -q --spider http://localhost:3002/health || exit 1

# Start service
CMD ["node", "src/index.js"]

