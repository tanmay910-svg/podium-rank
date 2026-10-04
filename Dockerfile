FROM node:20-alpine
WORKDIR /app
COPY package.json server.js ./
COPY public ./public
COPY data ./data
ENV NODE_ENV=production
ENV PORT=3001
EXPOSE 3001
CMD ["npm","start"]
