# frontend/Dockerfile
FROM node:18-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci

# Copy application code
COPY . .

# Expose port
EXPOSE 3000

# Start the development server
CMD ["npm", "start"]