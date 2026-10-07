FROM node:24-bookworm-slim
WORKDIR /app
RUN apt-get update \
    && apt-get install -y --no-install-recommends git \
    && rm -rf /var/lib/apt/lists/*
COPY package.json ./
RUN npm install --omit=dev
COPY server.mjs ./
ENV NODE_ENV=production
ENV PORT=8787
ENV WHATSAPP_DATA_DIR=/data
VOLUME ["/data"]
EXPOSE 8787
CMD ["node", "server.mjs"]
