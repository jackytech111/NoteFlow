FROM node:20-alpine AS base
WORKDIR /app

COPY shared ./shared
RUN cd shared && npm install

COPY services/tags-service ./services/tags-service
WORKDIR /app/services/tags-service

RUN npm install
RUN npx prisma generate
RUN npm run build

EXPOSE 3004
CMD ["node", "dist/services/tags-service/src/index.js"]