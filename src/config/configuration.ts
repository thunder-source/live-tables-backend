export default () => ({
  // Application
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT ?? '3000', 10),
  apiPrefix: process.env.API_PREFIX || 'api/v1',

  // Database - Main
  database: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT ?? '5432', 10),
    username: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_DATABASE || 'live_tables_main',
    synchronize: process.env.DB_SYNCHRONIZE === 'true',
    logging: process.env.DB_LOGGING === 'true',
  },

  // Database - Internal Mini-DB
  miniDb: {
    host: process.env.MINI_DB_HOST || 'localhost',
    port: parseInt(process.env.MINI_DB_PORT ?? '5432', 10),
    username: process.env.MINI_DB_USERNAME || 'postgres',
    password: process.env.MINI_DB_PASSWORD || 'postgres',
    database: process.env.MINI_DB_DATABASE || 'live_tables_mini_db',
    synchronize: process.env.MINI_DB_SYNCHRONIZE === 'true',
  },

  // Redis
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT ?? '6379', 10),
    password: process.env.REDIS_PASSWORD || undefined,
    db: parseInt(process.env.REDIS_DB ?? '0', 10),
  },

  // JWT
  jwt: {
    secret: process.env.JWT_SECRET || 'dev-secret-key',
    accessTokenExpiration: process.env.JWT_ACCESS_TOKEN_EXPIRATION || '15m',
    refreshTokenExpiration: process.env.JWT_REFRESH_TOKEN_EXPIRATION || '7d',
  },

  // Encryption
  encryption: {
    key: process.env.ENCRYPTION_KEY,
    algorithm: process.env.ENCRYPTION_ALGORITHM || 'aes-256-gcm',
  },

  // CORS
  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:3001',
    credentials: process.env.CORS_CREDENTIALS === 'true',
  },

  // Rate Limiting
  rateLimit: {
    ttl: parseInt(process.env.RATE_LIMIT_TTL ?? '60', 10),
    limit: parseInt(process.env.RATE_LIMIT_LIMIT ?? '100', 10),
  },

  // WebSocket
  websocket: {
    port: parseInt(process.env.WS_PORT ?? '3001', 10),
    path: process.env.WS_PATH || '/socket.io',
  },

  // Public API
  publicApi: {
    baseUrl: process.env.PUBLIC_API_BASE_URL || 'http://localhost:3000/public',
  },

  // File Upload
  upload: {
    maxFileSize: parseInt(process.env.MAX_FILE_SIZE ?? '10485760', 10), // 10MB
    destination: process.env.UPLOAD_DESTINATION || './uploads',
  },

  // Logging
  logging: {
    level: process.env.LOG_LEVEL || 'debug',
  },
});
