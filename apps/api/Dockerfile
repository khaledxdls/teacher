# Build from the repository root:  docker build -f apps/api/Dockerfile -t classpilot-api .
FROM node:22-bookworm-slim AS base
# Prisma's query engine needs OpenSSL.
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app

# ---- build: install everything, compile TypeScript ----
FROM base AS build
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/mobile/package.json apps/mobile/
RUN npm ci --workspace apps/api --include-workspace-root --ignore-scripts
COPY apps/api apps/api
RUN cd apps/api && npx prisma generate && npm run build

# ---- runtime: production dependencies + compiled output only ----
FROM base AS runtime
ENV NODE_ENV=production
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/mobile/package.json apps/mobile/
RUN npm ci --workspace apps/api --include-workspace-root --omit=dev --ignore-scripts && npm cache clean --force
COPY apps/api/prisma apps/api/prisma
RUN cd apps/api && npx prisma generate
COPY --from=build /app/apps/api/dist apps/api/dist

USER node
WORKDIR /app/apps/api
EXPOSE 3000
# Apply pending migrations, then start the server.
CMD ["npm", "run", "start:prod"]
