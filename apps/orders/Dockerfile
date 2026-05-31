FROM node:22-alpine AS development

WORKDIR /usr/src/app

COPY package.json ./
COPY pnpm-lock.yaml ./
COPY pnpm-workspace.yaml ./
COPY tsconfig.json tsconfig.json
COPY nest-cli.json nest-cli.json
COPY apps/orders/package.json apps/orders/package.json

RUN npm install -g pnpm@9.15.4

RUN pnpm install

COPY apps/orders apps/orders
COPY libs libs

RUN pnpm -w run build orders

FROM node:22-alpine AS production

ARG NODE_ENV=production
ENV NODE_ENV=${NODE_ENV}

WORKDIR /usr/src/app

COPY package.json ./
COPY pnpm-lock.yaml ./
COPY pnpm-workspace.yaml ./
COPY apps/orders/package.json apps/orders/package.json

RUN npm install -g pnpm@9.15.4

RUN pnpm install --prod

COPY --from=development /usr/src/app/dist ./dist
COPY --from=development /usr/src/app/apps/orders/prisma.config.ts ./apps/orders/prisma.config.ts
COPY --from=development /usr/src/app/apps/orders/prisma ./apps/orders/prisma

CMD ["sh", "-c", "cd apps/orders && pnpm prisma migrate deploy && cd ../.. && node dist/apps/orders/main"]
