FROM node:22.17.0-bookworm-slim
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts
COPY service ./service
COPY knowledge ./knowledge
ENV NODE_ENV=production
CMD ["node", "service/server.mjs"]
