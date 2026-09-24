FROM node:22-alpine
WORKDIR /app
COPY server /app/server
COPY cloudfunctions/travel/handler.js cloudfunctions/travel/domain.cjs cloudfunctions/travel/tencent.js /app/cloudfunctions/travel/
ENV HOST=0.0.0.0 DATA_DIR=/data PORT=8787
RUN mkdir -p /data && chown node:node /data
USER node
EXPOSE 8787
CMD ["node", "server/start.cjs"]
