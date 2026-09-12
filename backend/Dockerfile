FROM node:22-alpine

WORKDIR /app

# Install dependencies first (cached layer)
COPY package*.json ./
RUN npm ci

# Copy prisma schema and generate client
COPY prisma ./prisma
RUN npx prisma generate

# Copy source
COPY src ./src

EXPOSE 5000

# On startup: push schema, seed, then start server
CMD ["sh", "-c", "npx prisma db push --skip-generate && node prisma/seed.js; node src/server.js"]
