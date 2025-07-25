# KrishiMitra - Rural AgriTech Financial Companion

## Docker Deployment Guide

### Prerequisites
- Docker installed on your system
- MongoDB Atlas account (or existing MongoDB instance)
- OpenAI API key

### Environment Setup
1. Copy the environment template:
   ```bash
   cp env.template .env
   ```

2. Update the `.env` file with your credentials:
   - `MONGODB_URI`: Your MongoDB connection string
   - `OPENAI_API_KEY`: Your OpenAI API key
   - `SESSION_SECRET`: A secure random string (min 32 chars)

### Building the Docker Image
```bash
# Build the image
docker build -t krishimitra .

# Run the container
docker run -d \
  --name krishimitra \
  -p 3000:3000 \
  --env-file .env \
  krishimitra
```

### Using Docker Compose (Alternative)
```bash
# Start the application
docker-compose up -d

# View logs
docker-compose logs -f

# Stop the application
docker-compose down
```

### Health Check
The application includes a health check endpoint at `/health` that monitors:
- Application status
- MongoDB connection
- System uptime

### Container Management
```bash
# View container logs
docker logs -f krishimitra

# Stop container
docker stop krishimitra

# Remove container
docker rm krishimitra

# Remove image
docker rmi krishimitra
```

### Troubleshooting
1. **Container won't start**:
   - Check logs: `docker logs krishimitra`
   - Verify environment variables
   - Ensure MongoDB is accessible

2. **MongoDB Connection Issues**:
   - Verify MongoDB URI
   - Check network connectivity
   - Ensure IP whitelist in MongoDB Atlas

3. **Application Errors**:
   - Check application logs
   - Verify OpenAI API key
   - Check port availability

### Production Deployment Tips
1. Always use specific version tags for Node.js base image
2. Set appropriate environment variables
3. Use proper logging configuration
4. Monitor container health
5. Set up container restart policies
6. Use proper security measures:
   - Non-root user (already configured)
   - Environment variable management
   - Regular security updates

### Security Notes
- Never commit `.env` file
- Use secrets management in production
- Keep Docker image updated
- Follow security best practices 
