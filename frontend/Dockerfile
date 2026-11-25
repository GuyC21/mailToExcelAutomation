FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install

COPY . .

RUN mkdir -p /app/node_modules/.vite-temp /app/node_modules/.vite && \
    chown -R node:node /app
USER node

# Vite default port
EXPOSE 5173

# Kept running by docker-compose using npm run dev
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
