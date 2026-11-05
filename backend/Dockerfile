# ────────────────────────────────────────────────────────────────────────────
# ConversAI Builder - Backend Dockerfile
# Single-stage build for production NestJS application
# ────────────────────────────────────────────────────────────────────────────

FROM node:24-alpine

# Install dependencies for node-gyp (needed for some native modules)
RUN apk add --no-cache python3 make g++

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install ALL dependencies first (for build) - don't set NODE_ENV yet
RUN npm ci

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Remove all node_modules and reinstall only production dependencies
RUN rm -rf node_modules && NODE_ENV=production npm ci --omit=dev

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nestjs -u 1001

# Change ownership of the app directory
RUN chown -R nestjs:nodejs /app

# Switch to non-root user
USER nestjs

# Expose the port the app runs on
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3001/api/chat/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start the application
CMD ["node", "dist/main.js"]
