# --- Build stage ---
FROM node:18-slim AS builder
WORKDIR /app

# Install deps with reproducible lockfile semantics
COPY package*.json ./
RUN npm ci --omit=dev  # installs only prod deps with npm v7+

# Bring in source and (optionally) build
COPY . .
# RUN npm run build     # uncomment if you have TS/Prisma/etc

# --- Runtime stage ---
FROM node:18-slim
WORKDIR /app

# Copy only what you need for runtime and set ownership in one step
COPY --from=builder --chown=node:node /app/package*.json ./
COPY --from=builder --chown=node:node /app/node_modules ./node_modules
# If you build to /dist or similar, copy just that:
# COPY --from=builder --chown=node:node /app/dist ./dist
# Otherwise, copy minimal app files:
COPY --chown=node:node . .

ENV NODE_ENV=production
ENV PORT=4211
EXPOSE 4211

USER node
# Prefer a direct node command if possible; npm is fine if you rely on scripts
CMD ["node", "src/api.js"]
