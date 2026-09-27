FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install

COPY . .

# Vite default port
EXPOSE 5173

# Kept running by docker-compose using npm run dev
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
