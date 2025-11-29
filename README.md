# Live Tables Backend

A unified data collaboration platform backend built with NestJS. Provides both External DB Explorer and Internal Mini-DB capabilities with real-time collaboration, RBAC, and audit logging.

## 🚀 Features

- **🔐 Authentication & Authorization**: JWT-based auth with refresh tokens
- **👥 Multi-Tenancy**: Workspace-based isolation with RBAC (Owner, Admin, Editor, Viewer)
- **🗄️ External DB Support**: Connect to PostgreSQL, MongoDB, MySQL databases
- **📊 Internal Mini-DB**: Fully managed database system (like Notion/Airtable)
- **🔄 Real-Time Collaboration**: WebSocket-based live updates
- **📜 Audit Logging**: Complete history of all operations
- **🔍 Dynamic Views**: Complex views with joins and computed columns
- **🌐 Views as API**: Expose views as public read-only APIs

## 📋 Prerequisites

- Node.js >= 18.x
- Docker & Docker Compose
- npm or yarn

## 🛠️ Installation

1. **Clone the repository**
```bash
git clone <repository-url>
cd live-tables-backend
```

2. **Install dependencies**
```bash
npm install
```

3. **Setup environment variables**
```bash
cp .env.example .env
# Edit .env with your configuration
```

4. **Start Docker services**
```bash
docker-compose up -d
```

This will start:
- PostgreSQL Main (port 5432)
- PostgreSQL Mini-DB (port 5433)
- Redis (port 6379)
- MongoDB (port 27017) - for testing
- MySQL (port 3307) - for testing
- pgAdmin (port 5050) - optional DB management UI

5. **Run database migrations** (when ready)
```bash
npm run migration:run
```

## 🏃 Running the Application

### Development mode
```bash
npm run start:dev
```

### Production mode
```bash
npm run build
npm run start:prod
```

### Debug mode
```bash
npm run start:debug
```

## 🧪 Testing

```bash
# Unit tests
npm run test

# E2E tests
npm run test:e2e

# Test coverage
npm run test:cov
```

## 📚 API Documentation

Once the server is running, access the **interactive Swagger API documentation** at:
```
http://localhost:3000/api/docs
```

The Swagger UI provides:
- 🔍 Complete API endpoint documentation
- 🧪 Interactive "Try it out" functionality
- 📝 Request/response schemas
- 🔐 JWT authentication testing

### API Base URL
```
http://localhost:3000/api/v1
```

### Health Check
```
GET /api/v1/health
```
**Public endpoint** (no authentication required)

Returns comprehensive system health status including:
- 🗄️ **Database** - PostgreSQL connectivity with response time
- 🔴 **Redis** - Cache connectivity and performance
- 💾 **Memory** - Heap and RSS usage with limits
- 💿 **Disk** - Storage availability and path
- 🖥️ **System** - OS info, CPU, total memory, load average
- 📦 **Application** - Version, environment, process info, uptime
- ⏱️ **Timestamps** - Current time and application uptime

Response example:
```json
{
  "status": "ok",
  "timestamp": "2024-01-01T12:00:00.000Z",
  "uptime": 3600,
  "info": {
    "database": { 
      "status": "up", 
      "responseTime": "15ms" 
    },
    "redis": { 
      "status": "up", 
      "responseTime": "2ms",
      "host": "localhost",
      "port": 6379
    },
    "memory_heap": { 
      "status": "up", 
      "used": "150 MB", 
      "limit": "300 MB",
      "percentage": "50%" 
    },
    "memory_rss": { 
      "status": "up", 
      "used": "200 MB", 
      "limit": "500 MB",
      "percentage": "40%"
    },
    "storage": { 
      "status": "up",
      "path": "C:\\"
    },
    "system": {
      "status": "up",
      "platform": "win32",
      "arch": "x64",
      "nodeVersion": "v18.0.0",
      "cpuCores": 8,
      "cpuModel": "Intel Core i7",
      "totalMemory": "16 GB",
      "freeMemory": "8 GB",
      "usedMemory": "8 GB",
      "memoryUsagePercent": "50%",
      "uptime": "5d 12h 30m 45s",
      "loadAverage": [1.5, 1.3, 1.2]
    },
    "application": {
      "status": "up",
      "name": "live-tables-backend",
      "version": "0.0.1",
      "environment": "development",
      "processId": 12345,
      "processUptime": "1h 30m 15s"
    }
  },
  "details": { ... }
}
```



### Authentication Endpoints

- `POST /api/v1/auth/register` - Register new user
- `POST /api/v1/auth/login` - Login user
- `POST /api/v1/auth/refresh` - Refresh access token
- `POST /api/v1/auth/logout` - Logout user (requires JWT)
- `GET /api/v1/auth/me` - Get current user profile (requires JWT)

### Workspace Endpoints

- `POST /api/v1/workspaces` - Create workspace
- `GET /api/v1/workspaces` - List user workspaces
- `GET /api/v1/workspaces/:id` - Get workspace details
- `PATCH /api/v1/workspaces/:id` - Update workspace (Admin+)
- `DELETE /api/v1/workspaces/:id` - Delete workspace (Owner)
- `POST /api/v1/workspaces/:id/members` - Invite member (Admin+)
- `DELETE /api/v1/workspaces/:id/members/:memberId` - Remove member (Admin+)
- `GET /api/v1/workspaces/:id/members` - List workspace members


## 🗄️ Database Access

### pgAdmin
Access pgAdmin at `http://localhost:5050`

**Credentials:**
- Email: `admin@livetables.com`
- Password: `admin123`

**Server Connection:**
- Host: `postgres_main` or `postgres_mini_db`
- Port: `5432`
- Username: `postgres`
- Password: `postgres`

## 📁 Project Structure

```
src/
├── modules/           # Feature modules
│   ├── auth/         # Authentication & authorization
│   ├── users/        # User management
│   ├── workspaces/   # Workspace & RBAC
│   ├── connections/  # External DB connections
│   ├── tables/       # Internal mini-DB tables
│   ├── views/        # Dynamic views
│   ├── audit/        # Audit logging
│   └── websocket/    # Real-time collaboration
├── common/            # Shared utilities
│   ├── decorators/   # Custom decorators
│   ├── guards/       # Auth guards
│   ├── interceptors/ # HTTP interceptors
│   ├── filters/      # Exception filters
│   └── pipes/        # Validation pipes
├── config/            # Configuration
└── database/          # Database entities & migrations
```

## 🔧 Environment Variables

Key environment variables (see `.env.example` for all):

```env
# Application
NODE_ENV=development
PORT=3000

# Database
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=postgres
DB_DATABASE=live_tables_main

# JWT
JWT_SECRET=your-secret-key
JWT_ACCESS_TOKEN_EXPIRATION=15m
JWT_REFRESH_TOKEN_EXPIRATION=7d

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
```

## 🐳 Docker Commands

```bash
# Start all services
docker-compose up -d

# Stop all services
docker-compose down

# View logs
docker-compose logs -f

# Restart specific service
docker-compose restart postgres_main
```

## 📈 Development Roadmap

- [x] Phase 1: Foundation & Core Infrastructure
- [ ] Phase 2: Workspace & RBAC System
- [ ] Phase 3: Data Abstraction Layer
- [ ] Phase 4: External Database Connectivity  
- [ ] Phase 5: Internal Mini-DB
- [ ] Phase 6: Views System
- [ ] Phase 7: Real-Time Collaboration
- [ ] Phase 8: Audit Logging & History
- [ ] Phase 9: View as API
- [ ] Phase 10: Security Hardening
- [ ] Phase 11: Performance & Scalability
- [ ] Phase 12: DevOps & Deployment

See [IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md) for detailed roadmap.

## 🤝 Contributing

1. Create a feature branch
2. Make your changes
3. Write/update tests
4. Submit a pull request

## 📝 License

MIT

## 👨‍💻 Support

For issues and questions, please create an issue in the repository.
