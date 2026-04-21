FROM node:20-alpine
WORKDIR /app/server
COPY server/package*.json ./
RUN npm install --production --no-audit
WORKDIR /app
COPY . .
EXPOSE 3000
CMD ["node", "server/index.js"]
