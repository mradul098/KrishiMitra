################ 1. Base image  ################
FROM node:20-alpine AS base
WORKDIR /app

################ 2. Install dependencies  ################
# copy only the manifests first to leverage Docker layer‑cache
COPY package*.json ./

# install prod deps (add --omit=dev if you keep dev deps separate)
RUN npm ci --omit=dev

################ 3. Copy source code  ################
COPY . .

################ 4. Environment & runtime settings  ################
# You’ll pass real values at run‑time or via docker‑compose
ENV NODE_ENV=production \
    PORT=3000

EXPOSE 3000

################ 5. Non‑root user for security  ################
# node user is built‑in on node:<version>-alpine
USER node

################ 6. Start the server  ################
CMD ["node", "server.js"]
