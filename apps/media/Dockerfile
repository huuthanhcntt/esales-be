FROM node:22-alpine AS development

WORKDIR /usr/src/app

COPY package.json ./
COPY pnpm-lock.yaml ./
COPY pnpm-workspace.yaml ./
COPY tsconfig.json tsconfig.json
COPY nest-cli.json nest-cli.json
COPY apps/media/package.json apps/media/package.json

RUN npm install -g pnpm@9.15.4

RUN pnpm install

COPY apps/media apps/media
COPY libs libs

RUN pnpm -w run build media

FROM node:22-alpine AS production

ARG NODE_ENV=production
ENV NODE_ENV=${NODE_ENV}

WORKDIR /usr/src/app

COPY package.json ./
COPY pnpm-lock.yaml ./
COPY pnpm-workspace.yaml ./
COPY apps/media/package.json apps/media/package.json

RUN npm install -g pnpm@9.15.4

RUN pnpm install --prod

COPY --from=development /usr/src/app/dist ./dist

CMD ["node", "dist/apps/media/main"]
