FROM node:20-alpine

RUN apk add --no-cache python3 make g++ curl libssl1.1

WORKDIR /app

RUN mkdir -p /app/data && chown -R node:node /app

COPY package*.json ./
RUN npm install --production

COPY prisma ./prisma
RUN npx prisma generate

COPY --chown=node:node . .

RUN npm run build

ENV PORT=80
ENV DATABASE_URL=file:/app/data/dev.db

EXPOSE 80

VOLUME ["/app/data"]

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 CMD curl -f http://localhost:80/ || exit 1

USER node

CMD ["npm", "start"]