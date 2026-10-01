# Moviejuke — production image.
#
# Zero runtime dependencies, so the image is just Node plus the app:
#   docker build -t moviejuke .
#   docker run -p 8080:8080 moviejuke   →  http://localhost:8080

FROM node:22-alpine

ENV NODE_ENV=production \
    PORT=8080 \
    HOST=0.0.0.0

WORKDIR /app

# Application code only — no package manager install step is needed because the
# server imports nothing outside the Node standard library.
COPY package.json ./
COPY server.js ./
COPY data ./data
COPY public ./public
COPY scripts ./scripts

# `node` (uid 1000) already exists in the base image; ./data must stay writable
# for the profile / favorites / queue store.
RUN rm -f data/state.json && chown -R node:node /app

USER node

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=4s --start-period=5s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
