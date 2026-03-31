FROM node:20-alpine
WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run prisma:generate && npm run build

EXPOSE 4000
CMD ["npm", "run", "start"]
