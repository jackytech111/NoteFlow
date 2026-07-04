FROM node:20-alpine AS base
WORKDIR /app

COPY shared ./shared
RUN cd shared && npm install

COPY services/notes-service ./services/notes-service
WORKDIR /app/services/notes-service

RUN npm install
RUN npx prisma generate
RUN npm run build

EXPOSE 3003
CMD ["node", "dist/services/notes-service/src/index.js"]