# syntax=docker/dockerfile:1

# better-sqlite3 is a native addon: it is compiled in the builder and loaded at runtime, so both
# stages must share the same libc. Debian slim (glibc) on both — do not swap one side for Alpine
# (musl), the prebuilt/compiled .node will not load.
ARG NODE_VERSION=22-bookworm-slim

# ── deps ─────────────────────────────────────────────────────────────────────
FROM node:${NODE_VERSION} AS deps
WORKDIR /app
RUN apt-get update \
    && apt-get install -y --no-install-recommends build-essential python3 \
    && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci

# ── builder ──────────────────────────────────────────────────────────────────
FROM node:${NODE_VERSION} AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# next.config.js sets output: "standalone" — the build traces lib/schema.sql, data/*.json and the
# better_sqlite3 .node into .next/standalone, which is what the runner stage ships.
RUN npm run build

# ── runner ───────────────────────────────────────────────────────────────────
FROM node:${NODE_VERSION} AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# The database lives on a mounted volume, never inside the image: `next build` traces
# seatbooking.db into the build output, so keeping it under /app would mean every new image
# silently reverts live bookings to the build-time snapshot.
ENV SEAT_DB_PATH=/data/seatbooking.db

RUN groupadd --system --gid 1001 nodejs \
    && useradd --system --uid 1001 --gid nodejs nextjs

# standalone excludes these two by design — they must be copied in explicitly.
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# Bundled starting point for a brand-new volume; the entrypoint copies it once and never overwrites.
COPY --from=builder --chown=nextjs:nodejs /app/seatbooking.db /app/seed/seatbooking.db
COPY --chown=nextjs:nodejs docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# Owned by nextjs so WAL can create seatbooking.db-wal / -shm beside the database. If you bind-mount
# a host directory here, chown it to 1001:1001 on the host or the app cannot write.
RUN mkdir -p /data && chown nextjs:nodejs /data
VOLUME /data

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Hits a route that actually reads the database, so a broken/unwritable volume fails the check
# instead of passing on a static page.
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD node -e "require('http').get({host:'127.0.0.1',port:process.env.PORT||3000,path:'/api/employees'},r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"

ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["node", "server.js"]
