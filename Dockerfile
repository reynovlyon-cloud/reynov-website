FROM node:20-alpine
WORKDIR /app
COPY . .
RUN cd server && npm install --production
CMD ["node", "server/index.js"]
