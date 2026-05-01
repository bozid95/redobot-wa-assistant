FROM node:20-slim AS builder
WORKDIR /app

RUN apt-get update \
  && apt-get install -y openssl \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json tsconfig.build.json nest-cli.json ./
COPY prisma ./prisma
RUN npx prisma generate

COPY src ./src
RUN npm run build

FROM node:20-slim AS runner
WORKDIR /app

RUN apt-get update \
  && apt-get install -y openssl \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/dist ./dist

RUN mkdir -p /app/uploads /app/knowledge

EXPOSE 4000
CMD ["sh", "-c", "mkdir -p /app/uploads /app/knowledge && npm run prisma:prepush && npm run prisma:push:accept && npm run prisma:seed && node dist/src/main.js"]
