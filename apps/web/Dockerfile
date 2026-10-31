# syntax=docker/dockerfile:1
FROM node:22-bookworm-slim AS base
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH
RUN corepack enable && corepack prepare pnpm@9.12.3 --activate
WORKDIR /repo

FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/web/package.json apps/web/package.json
RUN pnpm install --frozen-lockfile --filter @woibot/web... || pnpm install --no-frozen-lockfile --filter @woibot/web...

FROM base AS builder
COPY --from=deps /repo/node_modules ./node_modules
COPY --from=deps /repo/apps/web/node_modules ./apps/web/node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1 NEXT_OUTPUT=standalone
RUN cd apps/web && npx prisma generate 2>/dev/null || true
RUN cd apps/web && pnpm build

FROM node:22-bookworm-slim AS runner
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=8080 HOSTNAME=0.0.0.0
WORKDIR /app
RUN groupadd -g 1001 nodejs && useradd -u 1001 -g nodejs nextjs
COPY --from=builder --chown=nextjs:nodejs /repo/apps/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /repo/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder --chown=nextjs:nodejs /repo/apps/web/public ./apps/web/public
# skills catalog for the auto-selection engine (loader tries both shapes)
COPY --from=builder --chown=nextjs:nodejs /repo/apps/web/data/skills ./apps/web/data/skills
COPY --from=builder --chown=nextjs:nodejs /repo/apps/web/data/skills ./data/skills
USER nextjs
EXPOSE 8080
CMD ["node", "apps/web/server.js"]
