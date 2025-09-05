# Monitoring and Observability

## Monitoring Stack

- **Frontend Monitoring:** Custom metrics in TUI/CLI
- **Backend Monitoring:** Performance Monitor service
- **Error Tracking:** Error correlation and metrics
- **Performance Monitoring:** Built-in performance tracking

## Key Metrics

**Frontend Metrics:**

- Core Web Vitals (adapted for terminal)
- JavaScript errors
- API response times
- User interactions

**Backend Metrics:**

- Request rate
- Error rate
- Response time
- Database query performance

## Health Check System

```typescript
export class HealthMonitor {
  private checks: Map<string, HealthCheck> = new Map();

  registerCheck(name: string, check: HealthCheck): void {
    this.checks.set(name, check);
  }

  async checkHealth(): Promise<HealthReport> {
    const results: HealthCheckResult[] = [];

    for (const [name, check] of this.checks) {
      const start = performance.now();

      try {
        const result = await check.execute();
        results.push({
          name,
          status: result.healthy ? 'healthy' : 'unhealthy',
          duration: performance.now() - start,
          details: result.details,
        });
      } catch (error) {
        results.push({
          name,
          status: 'critical',
          duration: performance.now() - start,
          error: error.message,
        });
      }
    }

    return {
      status: this.aggregateStatus(results),
      checks: results,
      timestamp: new Date(),
    };
  }
}
```
