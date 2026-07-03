FROM node:20-alpine AS base
WORKDIR /app

COPY shared ./shared

COPY api-gateway ./api-gateway
WORKDIR /app/api-gateway

RUN npm install
RUN npm run build

EXPOSE 8080
CMD ["node", "dist/api-gateway/src/index.js"]