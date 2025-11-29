---
description: How to access and use the API documentation
---

# API Documentation Workflow

## Accessing Swagger Documentation

1. **Start the development server**
   ```bash
   npm run start:dev
   ```

2. **Open Swagger UI in your browser**
   Navigate to: `http://localhost:3000/api/docs`

3. **Authenticate (for protected endpoints)**
   - Click the "Authorize" button in the top-right
   - Enter your JWT token in the format: `Bearer <your-token>`
   - Click "Authorize" and close the modal

4. **Test endpoints**
   - Expand any endpoint
   - Click "Try it out"
   - Fill in the required parameters
   - Click "Execute"
   - View the response

## Health Check Endpoint

**No authentication required** - This is a public endpoint.

To verify the system is running and check detailed health metrics:
```bash
curl http://localhost:3000/api/v1/health
```

Expected response:
```json
{
  "status": "ok",
  "info": {
    "database": {
      "status": "up"
    },
    "memory_heap": {
      "status": "up"
    },
    "memory_rss": {
      "status": "up"
    },
    "storage": {
      "status": "up"
    }
  },
  "error": {},
  "details": {
    "database": {
      "status": "up"
    },
    "memory_heap": {
      "status": "up"
    },
    "memory_rss": {
      "status": "up"
    },
    "storage": {
      "status": "up"
    }
  }
}
```

The health check monitors:
- **Database**: PostgreSQL connection (3 second timeout)
- **Memory Heap**: Should not exceed 300MB
- **Memory RSS**: Should not exceed 500MB
- **Disk Storage**: Should have at least 50% free space


## Using the API

### 1. Register a new user
```bash
curl -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "password123",
    "firstName": "John",
    "lastName": "Doe"
  }'
```

### 2. Login to get JWT token
```bash
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "password123"
  }'
```

### 3. Use the token for authenticated requests
```bash
curl http://localhost:3000/api/v1/auth/me \
  -H "Authorization: Bearer <your-access-token>"
```

## Documentation Features

The Swagger documentation includes:

- **All endpoints** organized by tags (Authentication, Workspaces, Health)
- **Request/response schemas** with example values
- **Authentication requirements** clearly marked
- **Try it out** functionality for testing directly in the browser
- **Model definitions** for all DTOs and entities
- **Response status codes** with descriptions
