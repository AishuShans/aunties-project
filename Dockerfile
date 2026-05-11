# Use official lightweight Python image
FROM python:3.11-slim

# Install curl and Node.js for compiling React frontend
RUN apt-get update && apt-get install -y curl && \
    curl -fsSL https://deb.nodesource.com/setup_18.x | bash - && \
    apt-get install -y nodejs && \
    rm -rf /var/lib/apt/lists/*

# Set the working directory
WORKDIR /app

# Copy the entire repository code
COPY . .

# Build the React frontend
WORKDIR /app/crop_insurance/frontend
RUN npm install
RUN npm run build

# Copy build files into backend directory
RUN mkdir -p /app/crop_insurance/backend/frontend_dist
RUN cp -r dist/* /app/crop_insurance/backend/frontend_dist/

# Install FastAPI backend dependencies
WORKDIR /app/crop_insurance/backend
RUN pip install --no-cache-dir -r requirements.txt

# Create static directory to prevent writing errors
RUN mkdir -p /app/crop_insurance/backend/static

# Expose Hugging Face default container port
EXPOSE 7860

# Run uvicorn on port 7860
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "7860"]
