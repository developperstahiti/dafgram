FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .

ARG NEXT_PUBLIC_API_BASE
# Forcer HTTPS pour éviter Mixed Content en production
RUN export NEXT_PUBLIC_API_BASE=$(echo "${NEXT_PUBLIC_API_BASE}" | sed 's|^http://|https://|') && npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

EXPOSE 3000
CMD ["node", "server.js"]
