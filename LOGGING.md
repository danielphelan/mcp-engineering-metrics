# Logging Guide

## Overview

The MCP Engineering Metrics Server uses **Pino** for production-ready structured logging, optimized for Docker, Azure, and other log aggregation systems.

## Why Pino?

### Performance
- **5-10x faster** than Winston, Bunyan, or standard console.log
- Uses asynchronous I/O (sonic-boom) to avoid blocking the event loop
- Critical for high-throughput production environments

### Structured Logging
- Outputs **newline-delimited JSON** (NDJSON) format
- Perfect for log aggregators: Azure Log Analytics, CloudWatch, Datadog, Splunk
- Easy to query: `logs | where level == "error" | where sessionId == "abc-123"`

### Production Features
- **Automatic redaction** of sensitive fields (passwords, tokens, API keys)
- **Error serialization** with stack traces
- **Child loggers** for request correlation (requestId, sessionId)
- **Pretty printing** in development mode for human readability

## Output Comparison

### Development Mode (Pretty Printing)

When `NODE_ENV=development`, logs are formatted for human readability:

```
[10:30:45] INFO  (12345): Starting MCP Engineering Metrics Server
    version: "1.0.0"
    environment: "development"
[10:30:46] DEBUG (12345): HTTP GET request
    url: "/rest/api/2/search"
    method: "GET"
[10:30:47] ERROR (12345): Failed to fetch story points from JIRA
    quarter: "2025-Q1-PI"
    error: {
      "message": "Connection timeout",
      "stack": "Error: Connection timeout\n    at ..."
    }
```

### Production Mode (Structured JSON)

When `NODE_ENV=production`, logs are pure JSON for log aggregators:

```json
{"level":"info","time":"2025-11-05T10:30:45.123Z","msg":"Starting MCP Engineering Metrics Server","version":"1.0.0","environment":"production"}
{"level":"debug","time":"2025-11-05T10:30:46.456Z","msg":"HTTP GET request","url":"/rest/api/2/search","method":"GET"}
{"level":"error","time":"2025-11-05T10:30:47.789Z","msg":"Failed to fetch story points from JIRA","quarter":"2025-Q1-PI","error":{"message":"Connection timeout","stack":"Error: Connection timeout\n    at ..."}}
```

## Configuration

### Log Levels

Set via `LOG_LEVEL` environment variable:

```bash
LOG_LEVEL=debug  # Show all logs (debug, info, warn, error)
LOG_LEVEL=info   # Show info, warn, error (default)
LOG_LEVEL=warn   # Show warn, error only
LOG_LEVEL=error  # Show errors only
```

### Environment

Set via `NODE_ENV` environment variable:

```bash
NODE_ENV=development  # Pretty formatted logs
NODE_ENV=production   # JSON structured logs
NODE_ENV=test         # Pretty formatted logs
```

## Sensitive Data Redaction

Pino automatically redacts the following fields from logs:

- `password`
- `apiKey`, `api_key`
- `apiToken`, `api_token`
- `token`
- `secret`
- `authorization`
- `cookie`, `set-cookie`

**Example:**

```typescript
logger.info('User authenticated', {
  username: 'john.doe',
  password: 'super-secret-123',  // Will be removed from logs
  apiToken: 'ghp_abc123'          // Will be removed from logs
});
```

**Output:**
```json
{"level":"info","time":"...","msg":"User authenticated","username":"john.doe"}
```

## Child Loggers (Request Correlation)

Use child loggers to add context to all logs within a request or session:

```typescript
// In your HTTP endpoint handler
const requestLogger = logger.child({
  requestId: req.id,
  sessionId: req.headers['mcp-session-id'],
  userId: req.user?.id
});

requestLogger.info('Processing request');
// Output: {"level":"info","requestId":"abc-123","sessionId":"xyz-789","msg":"Processing request"}

requestLogger.error('Request failed', error);
// Output: {"level":"error","requestId":"abc-123","sessionId":"xyz-789","msg":"Request failed","error":{...}}
```

All subsequent logs from `requestLogger` will include `requestId` and `sessionId` automatically.

## Docker Integration

Pino's JSON output is perfect for Docker:

### Docker Logs
```bash
docker logs my-mcp-server
# Output: newline-delimited JSON
{"level":"info","time":"2025-11-05T10:30:45.123Z","msg":"Starting MCP Server"}
{"level":"info","time":"2025-11-05T10:30:46.456Z","msg":"Server listening","port":3000}
```

### Parse with jq
```bash
docker logs my-mcp-server | jq 'select(.level == "error")'
# Shows only error logs
```

## Azure Log Analytics Integration

Azure automatically parses JSON logs into queryable fields:

### Kusto Query Examples

```kql
// Find all errors in the last hour
ContainerLog
| where TimeGenerated > ago(1h)
| extend level = tostring(parse_json(LogEntry).level)
| where level == "error"
| project TimeGenerated, Message=tostring(parse_json(LogEntry).msg), Error=tostring(parse_json(LogEntry).error)

// Track request performance by session
ContainerLog
| where TimeGenerated > ago(1h)
| extend sessionId = tostring(parse_json(LogEntry).sessionId)
| extend duration = toint(parse_json(LogEntry).duration)
| summarize avg(duration), max(duration), count() by sessionId
| order by avg_duration desc

// Find all JIRA API errors
ContainerLog
| where TimeGenerated > ago(24h)
| extend level = tostring(parse_json(LogEntry).level)
| extend msg = tostring(parse_json(LogEntry).msg)
| where level == "error" and msg contains "JIRA"
| project TimeGenerated, Message=msg, Details=LogEntry
```

## AWS CloudWatch Integration

CloudWatch Insights can query Pino's JSON logs:

```sql
-- Find errors by error message
fields @timestamp, msg, error.message, error.stack
| filter level = "error"
| sort @timestamp desc
| limit 20

-- Track request durations
fields @timestamp, msg, duration, sessionId
| filter msg = "Request completed"
| stats avg(duration), max(duration), min(duration) by sessionId

-- Count logs by level
fields @timestamp, level
| stats count() by level
```

## Performance Comparison

### Synchronous Logging (console.log, ConsoleLogger)
```
1,000 logs: ~50ms   (blocks event loop)
10,000 logs: ~500ms (blocks event loop)
```

### Asynchronous Logging (Pino)
```
1,000 logs: ~2ms    (non-blocking)
10,000 logs: ~15ms  (non-blocking)
```

**Result**: Pino is **25-30x faster** and doesn't block your application.

## Migration from ConsoleLogger

### Before (ConsoleLogger)
```typescript
import { ConsoleLogger } from './infrastructure/http/ConsoleLogger.js';

const logger = new ConsoleLogger(LogLevel.INFO);
logger.info('Hello', { userId: 123 });
// Output: [2025-11-05T10:30:45.123Z] [INFO] Hello {"userId":123}
```

### After (PinoLogger)
```typescript
import { PinoLogger } from './infrastructure/http/PinoLogger.js';

const logger = new PinoLogger(LogLevel.INFO, 'production');
logger.info('Hello', { userId: 123 });
// Output: {"level":"info","time":"2025-11-05T10:30:45.123Z","msg":"Hello","userId":123}
```

**No code changes required** - both implement the same `ILogger` interface!

## Best Practices

### 1. Use Structured Metadata
```typescript
// Good: Structured data
logger.info('User login', { userId: 123, email: 'user@example.com' });

// Bad: String interpolation
logger.info(`User ${userId} logged in with ${email}`);
```

### 2. Add Context with Child Loggers
```typescript
// Create child logger per request
app.use((req, res, next) => {
  req.logger = logger.child({ requestId: req.id });
  next();
});

// All logs include requestId automatically
req.logger.info('Processing request');
req.logger.error('Request failed');
```

### 3. Log Errors with Stack Traces
```typescript
// Good: Includes error object
logger.error('Failed to fetch data', error);

// Bad: Only error message
logger.error('Failed to fetch data', new Error(error.message));
```

### 4. Use Appropriate Log Levels
```typescript
logger.debug('Query execution plan', { sql, params });  // Development debugging
logger.info('User registered', { userId });             // Important events
logger.warn('Rate limit exceeded', { userId, limit }); // Potential issues
logger.error('Database connection failed', error);     // Errors requiring action
```

### 5. Don't Log in Hot Paths
```typescript
// Bad: Logging in tight loop
for (const item of items) {
  logger.debug('Processing item', { item }); // 1000s of logs
  processItem(item);
}

// Good: Log summary
logger.debug('Processing items', { count: items.length });
for (const item of items) {
  processItem(item);
}
logger.info('Items processed', { count: items.length });
```

## Troubleshooting

### Issue: Logs not appearing

**Check log level:**
```bash
# Make sure LOG_LEVEL allows the messages
LOG_LEVEL=debug npm start
```

### Issue: Logs hard to read locally

**Use development mode:**
```bash
NODE_ENV=development npm start
```

### Issue: Too many logs in production

**Increase log level:**
```bash
# Only show warnings and errors
LOG_LEVEL=warn npm start
```

### Issue: Sensitive data in logs

**Verify redaction paths in PinoLogger.ts:**
```typescript
redact: {
  paths: [
    'password',
    'apiKey',
    // Add your sensitive field names here
  ]
}
```

## References

- [Pino Documentation](https://getpino.io/)
- [Pino Best Practices](https://getpino.io/#/docs/best-practices)
- [Azure Log Analytics Query Language](https://learn.microsoft.com/en-us/azure/azure-monitor/logs/log-query-overview)
- [CloudWatch Insights Query Syntax](https://docs.aws.amazon.com/AmazonCloudWatch/latest/logs/CWL_QuerySyntax.html)
