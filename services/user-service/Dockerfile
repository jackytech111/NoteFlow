# services/user-service/Dockerfile
FROM node:20-alpine AS base
WORKDIR /app

COPY shared ./shared
COPY services/user-service ./services/user-service
WORKDIR /app/services/user-service

RUN npm install
RUN npx prisma generate
RUN npm run build

EXPOSE 3002
CMD ["node", "dist/services/user-service/src/index.js"]