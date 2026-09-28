FROM node:22-bookworm-slim
WORKDIR /app/mobile/expo
COPY mobile/expo/package.json mobile/expo/package-lock.json ./
RUN npm ci && npm cache clean --force
COPY mobile/expo/App.js mobile/expo/index.js ./
COPY scripts/mobile/expo.mjs scripts/mobile/expo-container.mjs /app/scripts/mobile/
USER 10001:10001
ENV HOME=/tmp EXPO_NO_TELEMETRY=1 EXPO_NO_DOTENV=1 CI=1
CMD ["node", "/app/scripts/mobile/expo-container.mjs"]
