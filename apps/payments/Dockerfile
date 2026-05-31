FROM node:22-alpine AS development

WORKDIR /usr/src/app

COPY package.json ./
COPY pnpm-lock.yaml ./
COPY pnpm-workspace.yaml ./
COPY tsconfig.json tsconfig.json
COPY nest-cli.json nest-cli.json
COPY apps/payments/package.json apps/payments/package.json

RUN npm install -g pnpm@9.15.4

RUN pnpm install

COPY apps/payments apps/payments
COPY libs libs

RUN pnpm -w run build payments

FROM node:22-alpine AS production

ARG NODE_ENV=production
ENV NODE_ENV=${NODE_ENV}

WORKDIR /usr/src/app

COPY package.json ./
COPY pnpm-lock.yaml ./
COPY pnpm-workspace.yaml ./
COPY apps/payments/package.json apps/payments/package.json

RUN npm install -g pnpm@9.15.4

RUN pnpm install --prod

COPY --from=development /usr/src/app/dist ./dist

CMD ["node", "dist/apps/payments/main"]
