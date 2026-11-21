# RepoLenz Production Dockerfile
FROM node:22-bookworm-slim

# Install git for repository cloning capabilities
RUN apt-get update && apt-get install -y git && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy dependency manifests
COPY package*.json ./
COPY web/package*.json ./web/

# Install dependencies (backend & frontend)
RUN npm install --omit=dev
RUN npm --prefix web install

# Copy application source code
COPY . .

# Build React production static assets into web/dist
RUN npm --prefix web run build

# Default environment configuration
ENV NODE_ENV=production
ENV PORT=3001

EXPOSE 3001

# Start RepoLenz standalone server
CMD ["node", "src/server/app.js"]
