# syntax=docker.io/docker/dockerfile:1

FROM node:18-alpine AS base

# install deps
FROM base AS deps
WORKDIR /app

COPY package.json yarn.lock* package-lock.json* pnpm-lock.yaml* .npmrc* ./
RUN corepack enable pnpm && pnpm i --frozen-lockfile

# build stage
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# no build step, but need source files and modules
RUN corepack enable pnpm

# prod image
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 expressjs

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/src ./src

COPY ./certs /certs
ENV SSL_KEY=/certs/scalereach.team.key
ENV SSL_CERT=/certs/scalereach.team.pem

USER expressjs

EXPOSE 6733

ENV PORT=6733

ENV HOSTNAME="0.0.0.0"
CMD ["node", "src/server.js"]