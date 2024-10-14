FROM node:20-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

# install deps
FROM base AS deps
WORKDIR /app

# install deps with package manager
COPY package.json pnpm-lock.yaml ./
RUN corepack enable pnpm
RUN pnpm install --frozen-lockfile

# build source code
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# run build process
RUN corepack enable pnpm
RUN pnpm run build

# production image, copy all files and run the server
FROM base AS runner

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 express

COPY --from=builder --chown=express:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=express:nodejs /app/package.json ./
COPY --from=builder --chown=express:nodejs /app/dist ./

USER express
EXPOSE 5173
ENV PORT=5173
ENV NODE_ENV=production

CMD HOSTNAME="0.0.0.0" node server.js