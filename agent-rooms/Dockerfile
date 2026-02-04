FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .

ENV PORT=3847
ENV DATA_DIR=/app/data

# Note: For Railway, use Railway volumes instead of VOLUME directive
# VOLUME ["/app/data"]

EXPOSE 3847

CMD ["node", "server.js"]
