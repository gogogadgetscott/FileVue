# Build client assets
ARG NODE_VERSION=25-alpine
FROM node:${NODE_VERSION} AS client-build
WORKDIR /app/client
COPY client/package*.json ./
COPY client/tsconfig*.json ./
COPY client/vite.config.ts ./
COPY client/index.html ./
RUN npm install
COPY client/src ./src
RUN npm run build

# Install server dependencies
FROM node:${NODE_VERSION} AS server-deps
WORKDIR /app/server
COPY server/package*.json ./
RUN npm install --omit=dev

# Final runtime image
FROM node:${NODE_VERSION}
ENV NODE_ENV=production
WORKDIR /app/server
COPY --from=server-deps /app/server/node_modules ./node_modules
COPY server ./
COPY --from=client-build /app/client/dist ./public
EXPOSE 80 443
CMD ["node", "src/server.js"]
