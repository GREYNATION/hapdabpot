# Use official Node 22 slim image
FROM node:22-slim

# Install system dependencies
RUN apt-get update && \
    apt-get install -y \
    python3 \
    python-is-python3 \
    make \
    g++ \
    ffmpeg \
    libnss3 \
    libatk-bridge2.0-0 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    libgbm1 \
    libasound2 \
    libpangocairo-1.0-0 \
    libxshmfence1 \
    libx11-xcb1 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install dependencies first (layer cache friendly)
COPY package*.json ./
RUN npm ci
RUN cd src/agents/stuyza/openmontage/remotion-composer && npm install

# Copy source and build TypeScript
COPY . .
RUN npm run build

# No hardcoded EXPOSE 3001, Railway handles port mapping via PORT env var
# EXPOSE 3000

CMD ["npm", "run", "start"]
