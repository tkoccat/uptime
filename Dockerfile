# syntax=docker/dockerfile:1
# Üç hedef: runner (web uygulaması), tools (worker ve migration). Derleme bağlamı: proje kökü.

# --- 1) Bağımlılıklar ---
FROM node:22-alpine AS deps
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci

# --- 2) Derleme ---
FROM deps AS builder
COPY . .
# NEXT_PUBLIC_* değerleri derleme sırasında JS'e gömülür; değişirse imaj yeniden derlenmelidir
ARG NEXT_PUBLIC_APP_URL
ARG NEXT_PUBLIC_STATUS_BASE_DOMAIN
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ARG NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
ARG NEXT_PUBLIC_GTAG_ID
ARG NEXT_PUBLIC_GTAG_CONVERSION_LABEL
ARG NEXT_PUBLIC_META_PIXEL_ID
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL \
    NEXT_PUBLIC_STATUS_BASE_DOMAIN=$NEXT_PUBLIC_STATUS_BASE_DOMAIN \
    NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL \
    NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY \
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=$NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY \
    NEXT_PUBLIC_GTAG_ID=$NEXT_PUBLIC_GTAG_ID \
    NEXT_PUBLIC_GTAG_CONVERSION_LABEL=$NEXT_PUBLIC_GTAG_CONVERSION_LABEL \
    NEXT_PUBLIC_META_PIXEL_ID=$NEXT_PUBLIC_META_PIXEL_ID \
    BUILD_STANDALONE=true \
    NEXT_TELEMETRY_DISABLED=1
RUN npx prisma generate && npm run build

# --- 3a) worker + migration (tüm bağımlılıklar ve kaynak, tsx ve prisma CLI dahil) ---
FROM builder AS tools
ENV NODE_ENV=production
CMD ["npm", "run", "worker"]

# --- 3b) Web uygulaması (küçük standalone çıktı) ---
FROM node:22-alpine AS runner
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
COPY --from=builder --chown=node:node /app/public ./public
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static
# Prisma motoru standalone izlemesine her zaman dahil olmaz; açıkça kopyalanır
COPY --from=builder --chown=node:node /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder --chown=node:node /app/node_modules/@prisma ./node_modules/@prisma
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server.js"]
