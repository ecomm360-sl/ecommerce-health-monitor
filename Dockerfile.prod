FROM node:20-alpine

RUN apk add --no-cache python3 make g++ curl libssl1.1

WORKDIR /app

COPY package*.json ./
RUN npm install --production

COPY prisma ./prisma
RUN npx prisma generate

COPY . .

RUN npm run build

ENV PORT=80

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 CMD curl -f http://localhost:80/ || exit 1

CMD ["npm", "start"]