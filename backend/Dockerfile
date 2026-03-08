# ────────────────────────────────────────────────────────────────────────────
# ConversAI Builder - Backend Dockerfile
# Multi-stage build for production-optimized NestJS application
# ────────────────────────────────────────────────────────────────────────────

# ══════════════════════════════════════════════════════════════════════════════
# Stage 1: Build
# ══════════════════════════════════════════════════════════════════════════════
FROM node:20-alpine AS builder

# Install dependencies for node-gyp (needed for some native modules)
RUN apk add --no-cache python3 make g++

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install ALL dependencies (including devDependencies for building)
RUN npm ci

# Copy source code
COPY . .

# Build the application
RUN npm run build

# ══════════════════════════════════════════════════════════════════════════════
# Stage 1.5: Production Dependencies
# ══════════════════════════════════════════════════════════════════════════════
FROM node:20-alpine AS dependencies

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install ONLY production dependencies (faster and cleaner)
RUN npm ci --omit=dev

# ══════════════════════════════════════════════════════════════════════════════
# Stage 2: Production
# ══════════════════════════════════════════════════════════════════════════════
FROM node:20-alpine AS production

# Set NODE_ENV to production
ENV NODE_ENV=production

# Create app directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Copy production node_modules from dependencies stage
COPY --from=dependencies /app/node_modules ./node_modules

# Copy built application from builder
COPY --from=builder /app/dist ./dist

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
