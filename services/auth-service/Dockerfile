FROM node:20-alpine AS base
WORKDIR /app

# Copy shared package trước (dùng chung cho mọi service)
COPY shared ./shared

# Copy service code
COPY services/auth-service ./services/auth-service
WORKDIR /app/services/auth-service

RUN npm install
RUN npx prisma generate
RUN npm run build

EXPOSE 3001
CMD ["node", "dist/services/auth-service/src/index.js"]