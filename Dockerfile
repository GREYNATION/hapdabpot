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
# Full Chromium shared-library set required by Puppeteer on Debian slim
RUN apt-get update && apt-get install -y \
    ffmpeg \
    python3 python-is-python3 python3-pip python3-venv libsndfile1 \
    libnss3 libatk-bridge2.0-0 libxcomposite1 libxdamage1 libxrandr2 \
    libgbm1 libasound2 libpangocairo-1.0-0 libxshmfence1 libx11-xcb1 \
    libcups2 libdbus-1-3 libdrm2 libexpat1 libxcb1 libxkbcommon0 \
    libatspi2.0-0 libxfixes3 libxext6 fonts-liberation wget ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy only what we need from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.cache ./.cache
COPY --from=builder /app/src/agents/stuyza/openmontage/remotion-composer ./src/agents/stuyza/openmontage/remotion-composer
COPY --from=builder /app/scripts ./scripts
COPY *.py ./
RUN ls -la video_agent.py
COPY video-use ./video-use

# Setup Python Virtual Environment and Install Dependencies
ENV VIRTUAL_ENV=/app/.venv
RUN python3 -m venv $VIRTUAL_ENV
ENV PATH="$VIRTUAL_ENV/bin:$PATH"
RUN pip install --upgrade pip && \
    pip install -e ./video-use && \
    pip install youtube-transcript-api yt-dlp deap backtesting pandas numpy dill

# Set environment to production
ENV NODE_ENV=production
ENV PUPPETEER_CACHE_DIR=/app/.cache/puppeteer

CMD ["npm", "run", "start"]
