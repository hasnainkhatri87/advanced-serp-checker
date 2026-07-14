FROM node:22-alpine

WORKDIR /app

COPY package.json server.js ./
COPY public ./public

ENV NODE_ENV=production
ENV PORT=5173

EXPOSE 5173

USER node

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -q -O - http://127.0.0.1:5173/api/health || exit 1

CMD ["node", "server.js"]
