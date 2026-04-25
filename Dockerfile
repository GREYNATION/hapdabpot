# STAGE 1: Build
FROM node:22-slim AS builder

# Install build dependencies
RUN apt-get update && apt-get install -y \
    python3 python-is-python3 make g++ git ffmpeg \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install root dependencies
COPY package*.json ./
# Ensure Puppeteer downloads its bundled Chromium into a known path
ENV PUPPETEER_CACHE_DIR=/app/.cache/puppeteer
RUN npm install --legacy-peer-deps

# Build nested Remotion composer
COPY . .
RUN cd src/agents/stuyza/openmontage/remotion-composer && npm install --legacy-peer-deps

# Build the main TS project
RUN npm run build

# STAGE 2: Production Runtime
FROM node:22-slim

# Install ONLY runtime dependencies (no compilers)
RUN apt-get update && apt-get install -y \
    ffmpeg \
    libnss3 libatk-bridge2.0-0 libxcomposite1 libxdamage1 libxrandr2 \
    libgbm1 libasound2 libpangocairo-1.0-0 libxshmfence1 libx11-xcb1 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy only what we need from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.cache ./.cache
COPY --from=builder /app/src/agents/stuyza/openmontage/remotion-composer ./src/agents/stuyza/openmontage/remotion-composer
COPY --from=builder /app/scripts ./scripts

# Set environment to production
ENV NODE_ENV=production
ENV PUPPETEER_CACHE_DIR=/app/.cache/puppeteer

CMD ["npm", "run", "start"]
