import { Controller, Get } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { 
  HealthCheckService, 
  HealthCheck, 
  TypeOrmHealthIndicator,
  MemoryHealthIndicator,
  DiskHealthIndicator,
  HealthIndicatorResult,
} from '@nestjs/terminus';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import Redis from 'ioredis';
import * as os from 'os';
import * as process from 'process';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  private readonly startTime: number;
  private redis: Redis;

  constructor(
    private health: HealthCheckService,
    private db: TypeOrmHealthIndicator,
    private memory: MemoryHealthIndicator,
    private disk: DiskHealthIndicator,
    private configService: ConfigService,
  ) {
    this.startTime = Date.now();
    
    // Initialize Redis client for health check
    this.redis = new Redis({
      host: this.configService.get<string>('redis.host') || 'localhost',
      port: this.configService.get<number>('redis.port') || 6379,
      maxRetriesPerRequest: 1,
      retryStrategy: () => null, // Don't retry on health checks
    });
  }

  @Get()
  @Public()
  @HealthCheck()
  @ApiOperation({ 
    summary: 'Comprehensive system health check',
    description: 'Returns detailed health status including database, Redis, memory, disk, and application metrics. Public endpoint - no authentication required.'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Health check completed successfully',
    schema: {
      example: {
        status: 'ok',
        timestamp: '2024-01-01T00:00:00.000Z',
        uptime: 3600,
        info: {
          database: { status: 'up', responseTime: '15ms' },
          redis: { status: 'up', responseTime: '2ms' },
          memory_heap: { status: 'up', used: '150MB', limit: '300MB' },
          memory_rss: { status: 'up', used: '200MB', limit: '500MB' },
          storage: { status: 'up', free: '75%' },
          system: { 
            status: 'up',
            platform: 'win32',
            nodeVersion: 'v18.0.0',
            cpuUsage: '25%',
            totalMemory: '16GB',
            freeMemory: '8GB'
          },
          application: {
            status: 'up',
            name: 'live-tables-backend',
            version: '0.0.1',
            environment: 'development'
          }
        },
        error: {},
        details: {
          database: { status: 'up' },
          redis: { status: 'up' },
          memory_heap: { status: 'up' },
          memory_rss: { status: 'up' },
          storage: { status: 'up' },
          system: { status: 'up' },
          application: { status: 'up' }
        }
      }
    }
  })
  @ApiResponse({ 
    status: 503, 
    description: 'Service unavailable - one or more health checks failed' 
  })
  async check() {
    const healthChecks = await this.health.check([
      // Database connectivity with response time
      async () => {
        const start = Date.now();
        const result = await this.db.pingCheck('database', { timeout: 5000 });
        const responseTime = Date.now() - start;
        return {
          database: {
            ...result.database,
            responseTime: `${responseTime}ms`,
          },
        };
      },

      // Redis connectivity and response time
      async () => this.checkRedis(),
      
      // Memory checks with detailed info
      async () => {
        const memUsage = process.memoryUsage();
        const heapLimit = 300 * 1024 * 1024;
        const heapUsed = memUsage.heapUsed;
        
        return {
          memory_heap: {
            status: heapUsed < heapLimit ? 'up' : 'down',
            used: this.formatBytes(heapUsed),
            limit: this.formatBytes(heapLimit),
            percentage: `${Math.round((heapUsed / heapLimit) * 100)}%`,
          },
        };
      },
      
      async () => {
        const memUsage = process.memoryUsage();
        const rssLimit = 500 * 1024 * 1024;
        const rssUsed = memUsage.rss;
        
        return {
          memory_rss: {
            status: rssUsed < rssLimit ? 'up' : 'down',
            used: this.formatBytes(rssUsed),
            limit: this.formatBytes(rssLimit),
            percentage: `${Math.round((rssUsed / rssLimit) * 100)}%`,
          },
        };
      },
      
      // Disk storage check with details
      async () => {
        const diskPath = process.platform === 'win32' ? 'C:\\' : '/';
        const result = await this.disk.checkStorage('storage', { 
          path: diskPath,
          thresholdPercent: 0.95 // Allow up to 95% disk usage (5% free space required)
        });
        
        return {
          storage: {
            ...result.storage,
            path: diskPath,
          },
        };
      },

      // System information
      async () => this.getSystemInfo(),

      // Application information
      async () => this.getApplicationInfo(),
    ]);

    // Add timestamp and uptime to response
    return {
      ...healthChecks,
      timestamp: new Date().toISOString(),
      uptime: Math.floor((Date.now() - this.startTime) / 1000), // seconds
    };
  }

  private async checkRedis(): Promise<HealthIndicatorResult> {
    try {
      const start = Date.now();
      await this.redis.ping();
      const responseTime = Date.now() - start;
      
      return {
        redis: {
          status: 'up',
          responseTime: `${responseTime}ms`,
          host: this.configService.get<string>('redis.host') || 'localhost',
          port: this.configService.get<number>('redis.port') || 6379,
        },
      };
    } catch (error) {
      return {
        redis: {
          status: 'down',
          message: error.message,
        },
      };
    }
  }

  private async getSystemInfo(): Promise<HealthIndicatorResult> {
    const cpus = os.cpus();
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const usedMemory = totalMemory - freeMemory;
    
    return {
      system: {
        status: 'up',
        platform: os.platform(),
        arch: os.arch(),
        nodeVersion: process.version,
        cpuCores: cpus.length,
        cpuModel: cpus[0]?.model || 'Unknown',
        totalMemory: this.formatBytes(totalMemory),
        freeMemory: this.formatBytes(freeMemory),
        usedMemory: this.formatBytes(usedMemory),
        memoryUsagePercent: `${Math.round((usedMemory / totalMemory) * 100)}%`,
        uptime: this.formatUptime(os.uptime()),
        loadAverage: os.loadavg(),
      },
    };
  }

  private async getApplicationInfo(): Promise<HealthIndicatorResult> {
    return {
      application: {
        status: 'up',
        name: 'live-tables-backend',
        version: '0.0.1',
        environment: this.configService.get<string>('nodeEnv') || 'development',
        nodeEnv: process.env.NODE_ENV || 'development',
        processId: process.pid,
        processUptime: this.formatUptime(process.uptime()),
      },
    };
  }

  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  }

  private formatUptime(seconds: number): string {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    const parts = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    if (secs > 0 || parts.length === 0) parts.push(`${secs}s`);
    
    return parts.join(' ');
  }

  async onModuleDestroy() {
    // Clean up Redis connection
    if (this.redis) {
      await this.redis.quit();
    }
  }
}
