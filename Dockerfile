FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# The server bundle carries its dependencies and serves the browser files beside it.
FROM node:24-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /app/dist/beds24-direct-booking ./
USER node
EXPOSE 4000
CMD ["node", "server/server.mjs"]
