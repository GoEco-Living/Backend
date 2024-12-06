FROM node:20

# Set working directory
WORKDIR /usr/src/app

# Copy package.json and install dependencies
COPY package*.json ./ 
RUN npm install

# Install TensorFlow.js for Node.js (if required for ML tasks)
RUN npm install @tensorflow/tfjs-node

# Copy the rest of the application code
COPY . .

# Set environment variables (URL to models stored in Google Cloud Storage)
ENV PORT=3000 
ENV MODEL_URL=https://storage.googleapis.com/geo-ml/meals/model.json
ENV MODEL_URL2=https://storage.googleapis.com/geo-ml/transport/model.json

# Define health check (Ensure this endpoint is implemented in your Express app)
HEALTHCHECK CMD curl --fail http://localhost:${PORT}/status || exit 1

# Run the application
CMD ["npm", "start"]

EXPOSE 8080
