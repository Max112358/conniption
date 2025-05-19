# backend/Dockerfile
FROM node:18-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci

# Copy application code
COPY . .

# Expose port
EXPOSE 5000

# Add nodemon for development
RUN npm install -g nodemon

# Start the server in development mode with nodemon
CMD ["npm", "run", "dev"]