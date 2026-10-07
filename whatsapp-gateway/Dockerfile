FROM node:24-bookworm-slim
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev
COPY server.mjs ./
ENV NODE_ENV=production
ENV PORT=8787
ENV WHATSAPP_DATA_DIR=/data
VOLUME ["/data"]
EXPOSE 8787
CMD ["node", "server.mjs"]
