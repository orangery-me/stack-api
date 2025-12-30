# Test Setup Guide

## MongoDB Setup

1. **Install MongoDB locally** or use **MongoDB Atlas**:

   ```bash
   # For local installation (Windows)
   # Download from: https://www.mongodb.com/try/download/community

   # Or use Docker
   docker run --name mongodb -d -p 27017:27017 mongo:latest
   ```

2. **Create .env file** with your MongoDB connection string:
   ```bash
   APP_PORT=3000
   MONGODB_URI=mongodb://localhost:27017/stack-app
   JWT_ACCESS_SECRETKEY=your-super-secret-access-key-here
   JWT_ACCESS_EXPIRES=15m
   JWT_REFRESH_SECRETKEY=your-super-secret-refresh-key-here
   JWT_REFRESH_EXPIRES=7d
   RESET_PASSWORD=123456
   ```

## Testing the Application

1. **Start the development server**:

   ```bash
   npm run start:dev
   ```

2. **Test the Keep-Alive service**:

   - Visit: `http://localhost:3000/keep-alive/status`
   - You should see the service status and execution count
   - Check the console logs for cron job execution every 30 seconds

3. **Test MongoDB connection**:
   - The application should start without MongoDB connection errors
   - User registration/login endpoints should work with MongoDB

## API Endpoints

### Keep-Alive

- `GET /keep-alive/status` - Check service status

### Authentication

- `POST /auth/login` - User login
- `POST /auth/logout` - User logout
- `POST /auth/refresh` - Refresh token

### Users

- `GET /users` - List users
- `POST /users` - Create user
- `GET /users/:id` - Get user by ID
- `PUT /users/:id` - Update user
- `DELETE /users/:id` - Delete user

## Verification

The application now includes:
✅ MongoDB integration with Mongoose
✅ Cron job running every 30 seconds to prevent sleep
✅ Updated user authentication system
✅ All entities converted to MongoDB schemas
✅ Keep-alive monitoring endpoint
