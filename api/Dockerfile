# --- Build stage ---
FROM node:18-slim AS builder
WORKDIR /app

# Install deps with reproducible lockfile semantics
COPY package*.json ./
RUN npm ci --omit=dev  # installs only prod deps with npm v7+

# Bring in source
COPY . .

# --- Runtime stage ---
FROM node:18-slim
WORKDIR /app

# Copy files for runtime and set ownership
COPY --from=builder --chown=node:node /app/package*.json ./
COPY --from=builder --chown=node:node /app/node_modules ./node_modules
COPY --chown=node:node . .

ENV NODE_ENV=production
ENV PORT=4211
EXPOSE 4211
USER node

# Run command
CMD ["node", "src/api.js"]
