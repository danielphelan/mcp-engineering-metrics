# MCP Engineering Metrics Server

A Model Context Protocol (MCP) server for aggregating and reporting engineering metrics from JIRA, GitHub, and GitHub Advanced Security. Built with TypeScript following Domain-Driven Design (DDD) principles and SOLID best practices.

Implements **MCP Specification 2025-03-26** with streamable HTTP transport.

## Features

### 📊 JIRA Metrics
- **Story Points Tracking**: Query story points by quarterly label with status breakdown
- **Deployment Frequency**: Track JIRA releases and deployment cadence
- **Defect Rate Analysis**: Calculate bug ratios and quality metrics

### 💻 GitHub Metrics
- **Pull Request Analytics**: Track PR creation, merges, and merge rates
- **Repository Insights**: Multi-repository support with filtering

### 🔒 Security Metrics (GHAS)
- **Vulnerability Tracking**: Critical and high severity alerts
- **Secret Detection**: Identify exposed credentials and tokens
- **Security Posture**: Real-time security status across repositories

### 📈 Reporting
- **Weekly Reports**: Comprehensive markdown reports with week-over-week trends
- **Quarterly Summaries**: Quarter-to-date progress with weekly breakdowns
- **Customizable Periods**: Flexible date range queries

## Architecture

This project follows Domain-Driven Design with a clean architecture approach:

```
src/
├── domain/                     # Core business logic (framework-independent)
│   ├── interfaces/             # Abstractions (SOLID - Dependency Inversion)
│   │   ├── IJiraService.ts
│   │   ├── IGitHubService.ts
│   │   ├── ISecurityService.ts
│   │   ├── IReportService.ts
│   │   ├── IHttpClient.ts
│   │   └── ILogger.ts
│   ├── models/                 # Domain entities
│   │   ├── StoryPointsMetrics.ts
│   │   ├── PullRequestMetrics.ts
│   │   ├── DeploymentMetrics.ts
│   │   ├── BugMetrics.ts
│   │   └── SecurityMetrics.ts
│   └── value-objects/          # Immutable domain objects
│       ├── DateRange.ts
│       ├── QuarterLabel.ts
│       └── MetricTrend.ts
├── application/                # Application business rules
│   └── services/               # Service implementations
│       ├── JiraService.ts
│       ├── GitHubService.ts
│       ├── SecurityService.ts
│       └── ReportService.ts
└── infrastructure/             # External concerns & implementations
    ├── http/
    │   ├── AxiosHttpClient.ts
    │   └── ConsoleLogger.ts
    ├── config/
    │   └── Config.ts
    └── mcp/
        └── MCPServer.ts        # Streamable HTTP transport
```

### SOLID Principles Applied

1. **Single Responsibility Principle (SRP)**
   - Each service handles one domain (JIRA, GitHub, Security, Reports)
   - Logger handles only logging concerns
   - Config handles only configuration management

2. **Open/Closed Principle (OCP)**
   - Services are open for extension through interfaces
   - New metric sources can be added without modifying existing code

3. **Liskov Substitution Principle (LSP)**
   - Any `IHttpClient` implementation can replace `AxiosHttpClient`
   - Service interfaces can be swapped without breaking consumers

4. **Interface Segregation Principle (ISP)**
   - Focused interfaces (IJiraService, IGitHubService, etc.)
   - No client depends on methods it doesn't use

5. **Dependency Inversion Principle (DIP)**
   - High-level modules (services) depend on abstractions
   - Dependency injection in the composition root (index.ts)

## Prerequisites

- Node.js >= 18.0.0
- npm or yarn
- API credentials:
  - [JIRA API Token](https://support.atlassian.com/atlassian-account/docs/manage-api-tokens-for-your-atlassian-account/)
  - [GitHub Personal Access Token](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens)

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd mcp-engineering-metrics
```

2. Install dependencies:
```bash
npm install
```

3. Configure environment variables:
```bash
cp .env.example .env
```

4. Edit `.env` and add your credentials:
```env
# JIRA Configuration
JIRA_URL=https://your-domain.atlassian.net
JIRA_EMAIL=your-email@company.com
JIRA_API_TOKEN=your_jira_api_token

# GitHub Configuration
GITHUB_TOKEN=ghp_your_github_token
GITHUB_ORG=your-organization-name

# Optional: Specific repositories (comma-separated)
GITHUB_REPOS=backend-api,frontend-app

# Optional: Specific JIRA projects (comma-separated)
JIRA_PROJECTS=PROJ1,PROJ2

# Server Configuration
PORT=3000
HOST=0.0.0.0
LOG_LEVEL=info
```

5. Build the project:
```bash
npm run build
```

## Usage

### Starting the Server

```bash
npm start
```

The server will start on `http://localhost:3000` (or your configured PORT).

### MCP Client Configuration

Add this server to your MCP client configuration (e.g., Claude Desktop):

```json
{
  "mcpServers": {
    "engineering-metrics": {
      "url": "http://localhost:3000/mcp",
      "transport": "streamableHttp"
    }
  }
}
```

For development with environment variables:

```json
{
  "mcpServers": {
    "engineering-metrics": {
      "command": "node",
      "args": ["/path/to/mcp-engineering-metrics/dist/index.js"],
      "env": {
        "JIRA_URL": "https://your-domain.atlassian.net",
        "JIRA_EMAIL": "your-email@company.com",
        "JIRA_API_TOKEN": "your_token",
        "GITHUB_TOKEN": "ghp_your_token",
        "GITHUB_ORG": "your-org"
      }
    }
  }
}
```

## Logging

This server uses **Pino** for production-ready structured logging, optimized for Docker, Azure, and other log aggregation systems.

### Features
- **Structured JSON logging** - Perfect for log aggregators (Azure, CloudWatch, Datadog)
- **High performance** - 5-10x faster than alternatives, non-blocking async I/O
- **Automatic redaction** - Passwords, tokens, and API keys never appear in logs
- **Pretty printing** - Human-readable format in development mode
- **Request correlation** - Child loggers for tracing requests across logs

### Configuration

**Log Levels** (via `LOG_LEVEL` env var):
```bash
LOG_LEVEL=debug  # Show all logs (debug, info, warn, error)
LOG_LEVEL=info   # Show info, warn, error (default)
LOG_LEVEL=warn   # Show warnings and errors only
LOG_LEVEL=error  # Show errors only
```

**Output Format** (via `NODE_ENV` env var):
```bash
NODE_ENV=development  # Pretty formatted logs for humans
NODE_ENV=production   # JSON structured logs for aggregators
```

### Example Output

**Development mode:**
```
[10:30:45] INFO  (12345): Starting MCP Engineering Metrics Server
    version: "1.0.0"
    environment: "development"
```

**Production mode (JSON for log aggregators):**
```json
{"level":"info","time":"2025-11-05T10:30:45.123Z","msg":"Starting MCP Engineering Metrics Server","version":"1.0.0","environment":"production"}
```

**See [LOGGING.md](./LOGGING.md) for detailed documentation** including:
- Docker integration
- Azure Log Analytics queries
- CloudWatch Insights examples
- Request correlation with child loggers
- Best practices

## Available Tools

### 1. `get_story_points`

Query JIRA for story points with quarterly label.

**Parameters:**
- `quarter` (required): Quarter label (e.g., "2025-Q1" or "2025-Q1-PI")
- `week_start` (optional): ISO date for specific week start (YYYY-MM-DD)
- `week_end` (optional): ISO date for specific week end (YYYY-MM-DD)

**Example:**
```json
{
  "quarter": "2025-Q1",
  "week_start": "2025-01-13",
  "week_end": "2025-01-19"
}
```

**Returns:**
```json
{
  "total_points": 45,
  "label": "2025-Q1-PI",
  "period": "2025-01-13 to 2025-01-19",
  "breakdown": {
    "done": 30,
    "in_progress": 10,
    "to_do": 5
  },
  "completion_percentage": 66.7
}
```

### 2. `get_pr_metrics`

Retrieve GitHub pull request statistics.

**Parameters:**
- `start_date` (required): ISO date (YYYY-MM-DD)
- `end_date` (required): ISO date (YYYY-MM-DD)
- `repositories` (optional): List of repository names

**Example:**
```json
{
  "start_date": "2025-01-13",
  "end_date": "2025-01-19",
  "repositories": ["backend-api", "frontend-app"]
}
```

**Returns:**
```json
{
  "created": 24,
  "merged": 20,
  "merge_rate": 83.3,
  "period": "2025-01-13 to 2025-01-19",
  "repositories": ["backend-api", "frontend-app"]
}
```

### 3. `get_deployment_count`

Count JIRA releases deployed within a time period.

**Parameters:**
- `start_date` (required): ISO date (YYYY-MM-DD)
- `end_date` (required): ISO date (YYYY-MM-DD)
- `projects` (optional): List of JIRA project keys

**Example:**
```json
{
  "start_date": "2025-01-13",
  "end_date": "2025-01-19",
  "projects": ["PROJ1", "PROJ2"]
}
```

**Returns:**
```json
{
  "total_deployments": 3,
  "period": "2025-01-13 to 2025-01-19",
  "releases": [
    {"name": "v2.4.0", "project": "PROJ1", "date": "2025-01-15"},
    {"name": "v1.2.3", "project": "PROJ2", "date": "2025-01-17"}
  ],
  "frequency_per_week": 3.0
}
```

### 4. `get_bug_ratio`

Calculate defect rate from JIRA.

**Parameters:**
- `start_date` (required): ISO date (YYYY-MM-DD)
- `end_date` (required): ISO date (YYYY-MM-DD)
- `projects` (optional): List of JIRA project keys

**Example:**
```json
{
  "start_date": "2025-01-13",
  "end_date": "2025-01-19"
}
```

**Returns:**
```json
{
  "bugs": 5,
  "defect_subtasks": 3,
  "total_defects": 8,
  "total_tickets": 52,
  "defect_rate": 15.4,
  "period": "2025-01-13 to 2025-01-19"
}
```

### 5. `get_ghas_metrics`

Retrieve GitHub Advanced Security metrics.

**Parameters:**
- `repositories` (optional): List of repository names
- `state` (optional): "open" or "resolved" (default: "open")

**Example:**
```json
{
  "repositories": ["backend-api"],
  "state": "open"
}
```

**Returns:**
```json
{
  "critical_vulnerabilities": 2,
  "high_vulnerabilities": 7,
  "secrets_detected": 1,
  "total_critical_and_high": 9,
  "timestamp": "2025-01-19T10:30:00Z",
  "repositories": ["backend-api"]
}
```

### 6. `generate_weekly_report`

Generate comprehensive markdown report for a week with week-over-week comparison.

**Parameters:**
- `quarter` (required): Quarter label (e.g., "2025-Q1")
- `week_start` (optional): ISO date (defaults to most recent Monday)
- `repositories` (optional): List of repository names
- `jira_projects` (optional): List of JIRA project keys

**Example:**
```json
{
  "quarter": "2025-Q1",
  "week_start": "2025-01-13"
}
```

**Returns:** Markdown report with:
- Story points breakdown
- PR metrics
- Deployments
- Bug ratio
- Security metrics
- Week-over-week comparison table

### 7. `generate_quarterly_summary`

Generate quarter-to-date summary with weekly trend tables.

**Parameters:**
- `quarter` (required): Quarter label (e.g., "2025-Q1")
- `repositories` (optional): List of repository names
- `jira_projects` (optional): List of JIRA project keys

**Example:**
```json
{
  "quarter": "2025-Q1"
}
```

**Returns:** Markdown report with:
- Quarter-to-date totals
- Weekly trends for all metrics
- Key insights and averages

## HTTP Endpoints

The server implements streamable HTTP transport per MCP specification 2025-03-26:

### POST /mcp
Primary MCP endpoint for JSON-RPC requests.

**First Request (Initialize):**
```bash
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "initialize",
    "params": {
      "protocolVersion": "2024-11-05",
      "capabilities": {},
      "clientInfo": {"name": "test-client", "version": "1.0.0"}
    },
    "id": 1
  }'
```

Response includes `Mcp-Session-Id` header.

**Subsequent Requests:**
```bash
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -H "Mcp-Session-Id: <session-id>" \
  -d '{
    "jsonrpc": "2.0",
    "method": "tools/call",
    "params": {
      "name": "get_ghas_metrics",
      "arguments": {"state": "open"}
    },
    "id": 2
  }'
```

### GET /mcp
SSE stream for resumability (requires `Mcp-Session-Id` header).

Supports `Last-Event-ID` header for connection recovery.

### DELETE /mcp
Session termination (requires `Mcp-Session-Id` header).

### GET /health
Health check endpoint.

```bash
curl http://localhost:3000/health
```

Returns:
```json
{
  "status": "healthy",
  "timestamp": "2025-01-19T12:00:00.000Z",
  "activeSessions": 3
}
```

## Development

### Available Scripts

- `npm run build` - Compile TypeScript to JavaScript
- `npm run dev` - Watch mode for development
- `npm start` - Start the MCP server
- `npm run lint` - Run ESLint
- `npm run lint:fix` - Fix ESLint issues
- `npm run clean` - Remove build artifacts

### Running in Development

```bash
# Watch mode
npm run dev

# In another terminal
npm start
```

## Configuration Options

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `JIRA_URL` | Yes | - | JIRA instance URL |
| `JIRA_EMAIL` | Yes | - | JIRA user email |
| `JIRA_API_TOKEN` | Yes | - | JIRA API token |
| `JIRA_PROJECTS` | No | All | Comma-separated JIRA project keys |
| `GITHUB_TOKEN` | Yes | - | GitHub personal access token |
| `GITHUB_ORG` | Yes | - | GitHub organization name |
| `GITHUB_REPOS` | No | All | Comma-separated repository names |
| `PORT` | No | 3000 | HTTP server port |
| `HOST` | No | 0.0.0.0 | Bind address |
| `NODE_ENV` | No | development | Environment (development/production/test) |
| `LOG_LEVEL` | No | info | Logging level (debug/info/warn/error) |
| `CORS_ORIGINS` | No | * | Comma-separated allowed CORS origins |

### Quarterly Label Format

Story points use quarterly labels in the format: `YYYY-QX-PI`

Examples:
- `2025-Q1-PI` - Q1 2025
- `2025-Q2-PI` - Q2 2025
- `2026-Q3-PI` - Q3 2026

Create these labels in JIRA and apply them to issues for tracking.

## Error Handling

The server implements comprehensive error handling:

- Invalid parameters are rejected with validation errors
- API errors are logged and returned with meaningful messages
- Configuration errors are caught at startup
- All service errors are properly propagated
- JSON-RPC 2.0 error responses for protocol violations

## Best Practices

This project demonstrates several best practices:

1. **Dependency Injection**: All dependencies are injected, making testing easier
2. **Interface-Based Design**: Depend on abstractions, not concretions
3. **Immutable Domain Objects**: Value objects and entities are immutable
4. **Type Safety**: Full TypeScript with strict mode enabled
5. **Validation**: Zod schemas for runtime validation
6. **Error Handling**: Comprehensive error handling with proper logging
7. **Configuration Management**: Type-safe configuration with validation
8. **Clean Architecture**: Clear separation of concerns across layers
9. **Session Management**: Proper lifecycle management per MCP spec
10. **Graceful Shutdown**: Cleanup of all resources on exit

## Troubleshooting

### Connection Issues

**Problem**: Cannot connect to MCP server

**Solutions**:
- Check server is running: `curl http://localhost:3000/health`
- Verify PORT and HOST environment variables
- Check firewall settings
- Review server logs for errors

### Authentication Errors

**Problem**: JIRA or GitHub API errors

**Solutions**:
- Verify API tokens are valid and not expired
- Check token permissions/scopes
- For JIRA: Ensure email matches token owner
- For GitHub: Ensure token has repo and security_events scopes

### Session Issues

**Problem**: "Invalid or missing session ID" errors

**Solutions**:
- Ensure initialize request is sent first
- Include `Mcp-Session-Id` header in all requests after initialization
- Check session hasn't expired (server restart clears sessions)

## License

MIT

## Contributing

Contributions are welcome! Please ensure:

1. Follow the existing architecture patterns
2. Maintain SOLID principles
3. Add appropriate error handling
4. Update documentation
5. TypeScript strict mode compliance
6. ESLint passing

## Support

For issues or questions:
- GitHub Issues: [Create an issue](<repository-url>/issues)
- Documentation: See ARCHITECTURE.md for detailed design docs

## Changelog

### v1.0.0 (2025-01-05)
- ✅ Initial release with streamable HTTP transport
- ✅ 7 MCP tools for engineering metrics
- ✅ JIRA, GitHub, and GHAS integration
- ✅ Weekly and quarterly report generation
- ✅ Session management per MCP spec 2025-03-26
- ✅ Full TypeScript with DDD architecture
