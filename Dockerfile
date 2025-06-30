# Use an official lightweight Node.js base image
FROM node:18-slim

# Set environment variables
ENV NODE_ENV=production

# Set working directory inside container
WORKDIR /app

# Copy only package.json and package-lock.json first (for Docker caching)
COPY package*.json ./

# Install production dependencies
RUN npm install --only=production

# Copy application source code
COPY . .

# Expose your app’s port
EXPOSE 5000

# Define the default command to run your app
CMD ["node", "index.js"]
