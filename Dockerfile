# Use official Node 20 slim image (Debian-based — has python3/gcc/make for node-gyp)
FROM node:20-slim

# Install build tools needed by better-sqlite3 (node-gyp)
RUN apt-get update && \
    apt-get install -y python3 make g++ && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install dependencies first (layer cache friendly)
COPY package*.json ./
RUN npm ci

# Copy source and build TypeScript
COPY . .
RUN npm run build

# No hardcoded EXPOSE 3001, Railway handles port mapping via PORT env var
# EXPOSE 3000

CMD ["npm", "run", "start"]
