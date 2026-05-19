FROM node:20-slim

WORKDIR /app

ENV PORT=80

RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ curl && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm install

COPY prisma ./prisma
RUN npx prisma generate

COPY . .

RUN npx prisma db push --accept-data-loss

RUN npm run build

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 CMD curl -f http://localhost:80/ || exit 1

CMD ["npm", "start"]