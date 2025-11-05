# Architecture Documentation

## Overview

This MCP server is built using Domain-Driven Design (DDD) principles with a clean architecture approach. The codebase aggregates engineering metrics from JIRA, GitHub, and GitHub Advanced Security (GHAS), implementing the **MCP Specification 2025-03-26** with streamable HTTP transport.

The architecture is organized into distinct layers with clear boundaries, with dependencies flowing inward following the Dependency Inversion Principle.

## Architectural Layers

```
┌─────────────────────────────────────────────────────────┐
│              MCP Client (Claude Desktop, etc.)          │
└─────────────────────────┬───────────────────────────────┘
                          │ Streamable HTTP Transport
                          │ (JSON-RPC 2.0 over HTTP)
┌─────────────────────────▼───────────────────────────────┐
│              Infrastructure Layer                       │
│  ┌──────────────────────────────────────────────────┐  │
│  │            MCPServer                             │  │
│  │  • StreamableHTTPServerTransport                 │  │
│  │  • Session Management (UUID-based)               │  │
│  │  • Tool Registration & Routing                   │  │
│  │  • Express HTTP Endpoints:                       │  │
│  │    - POST /mcp (initialize & requests)           │  │
│  │    - GET /mcp  (SSE streams)                     │  │
│  │    - DELETE /mcp (session termination)           │  │
│  │    - GET /health                                 │  │
│  └──────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────┐  │
│  │     AxiosHttpClient    │    ConsoleLogger        │  │
│  │     (HTTP Impl)        │    (Logging Impl)       │  │
│  └──────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────┐  │
│  │              Config                              │  │
│  │  (Environment & Validation with Zod)             │  │
│  └──────────────────────────────────────────────────┘  │
└─────────────────────────┬───────────────────────────────┘
                          │ Depends on Interfaces
┌─────────────────────────▼───────────────────────────────┐
│              Application Layer                          │
│  ┌──────────────────────────────────────────────────┐  │
│  │       JiraService                                │  │
│  │       • Story Points (quarterly labels)          │  │
│  │       • Deployments (releases)                   │  │
│  │       • Bug Metrics (defect rate)                │  │
│  └──────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────┐  │
│  │       GitHubService                              │  │
│  │       • Pull Request Metrics                     │  │
│  │       • Repository Analytics                     │  │
│  └──────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────┐  │
│  │       SecurityService                            │  │
│  │       • GHAS Vulnerability Tracking              │  │
│  │       • Secret Detection                         │  │
│  └──────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────┐  │
│  │       ReportService                              │  │
│  │       • Weekly Reports (with WoW comparison)     │  │
│  │       • Quarterly Summaries (with trends)        │  │
│  └──────────────────────────────────────────────────┘  │
└─────────────────────────┬───────────────────────────────┘
                          │ Uses
┌─────────────────────────▼───────────────────────────────┐
│              Domain Layer                               │
│  ┌──────────────────────────────────────────────────┐  │
│  │           Interfaces (Contracts)                 │  │
│  │  • IJiraService      • IGitHubService            │  │
│  │  • ISecurityService  • IReportService            │  │
│  │  • IHttpClient       • ILogger                   │  │
│  └──────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────┐  │
│  │           Domain Models (Entities)               │  │
│  │  • StoryPointsMetrics  • PullRequestMetrics      │  │
│  │  • DeploymentMetrics   • BugMetrics              │  │
│  │  • SecurityMetrics                               │  │
│  └──────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────┐  │
│  │           Value Objects                          │  │
│  │  • DateRange (week-based periods)                │  │
│  │  • QuarterLabel (YYYY-QX-PI format)              │  │
│  │  • MetricTrend (WoW comparison)                  │  │
│  └──────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

## Dependency Flow

The architecture follows the Dependency Rule:

```
Infrastructure → Application → Domain
     ↓               ↓           ↑
  Depends on     Depends on   Pure Business Logic
  Application    Domain       (No Dependencies)
```

**Key principle**: Dependencies point inward. The domain layer has zero external dependencies and contains only pure business logic.

## MCP Specification 2025-03-26: Streamable HTTP Transport

### Session Lifecycle

```
1. Client sends initialize request (no session ID)
   POST /mcp
   Body: {"jsonrpc": "2.0", "method": "initialize", ...}
   ↓
2. Server detects isInitializeRequest(body)
   - Creates new StreamableHTTPServerTransport
   - Generates UUID session ID
   - Stores in transports map
   - Creates new McpServer instance
   - Connects transport to server
   ↓
3. Server responds with Mcp-Session-Id header
   Response Headers: Mcp-Session-Id: <uuid>
   Body: {"jsonrpc": "2.0", "result": {...}, "id": 1}
   ↓
4. Client sends subsequent requests with session ID
   POST /mcp
   Headers: Mcp-Session-Id: <uuid>
   Body: {"jsonrpc": "2.0", "method": "tools/call", ...}
   ↓
5. Server retrieves transport from map by session ID
   - Routes to appropriate handler
   - Maintains session state
   ↓
6. Client can establish SSE stream for resumability
   GET /mcp
   Headers: Mcp-Session-Id: <uuid>
   (Server sends event stream)
   ↓
7. Client terminates session
   DELETE /mcp
   Headers: Mcp-Session-Id: <uuid>
   (Server cleans up transport and session)
```

### Transport Features

- **Stateful Sessions**: UUID-based session tracking with transport map storage
- **Resumability**: SSE streams support `Last-Event-ID` header for connection recovery
- **Graceful Shutdown**: Cleanup handlers remove transports on close
- **Error Handling**: JSON-RPC 2.0 compliant error responses
- **CORS Support**: Configurable origins with `Mcp-Session-Id` header exposure

## SOLID Principles Implementation

### Single Responsibility Principle (SRP)

Each class has one and only one reason to change:

- `JiraService`: Responsible only for JIRA API integration and metric calculation
- `GitHubService`: Responsible only for GitHub API integration (PRs, repos)
- `SecurityService`: Responsible only for GHAS data retrieval (vulnerabilities, secrets)
- `ReportService`: Responsible only for report generation and metric aggregation
- `AxiosHttpClient`: Responsible only for HTTP communication
- `ConsoleLogger`: Responsible only for logging
- `Config`: Responsible only for configuration management and validation
- `MCPServer`: Responsible only for MCP protocol handling and transport management

### Open/Closed Principle (OCP)

Classes are open for extension but closed for modification:

```typescript
// Easy to add new metric sources without modifying existing code
class SonarQubeService implements IQualityService {
  // New implementation for code quality metrics
}

// Easy to add new HTTP clients
class FetchHttpClient implements IHttpClient {
  // Alternative HTTP implementation
}

// Easy to add new report formats
class PDFReportService implements IReportService {
  // Generate PDF instead of markdown
}
```

### Liskov Substitution Principle (LSP)

Subtypes can replace their base types without breaking functionality:

```typescript
// Any IHttpClient implementation can be used
const httpClient: IHttpClient = new AxiosHttpClient(logger);
// OR
const httpClient: IHttpClient = new FetchHttpClient(logger);

// Service doesn't care which implementation
const jiraService = new JiraService(httpClient, logger, jiraUrl, email, token);
```

### Interface Segregation Principle (ISP)

No client is forced to depend on methods it doesn't use:

- `IJiraService`: Only JIRA-specific methods (story points, deployments, bugs)
- `IGitHubService`: Only GitHub-specific methods (PR metrics)
- `ISecurityService`: Only security-specific methods (GHAS metrics)
- `IReportService`: Only reporting methods (weekly, quarterly)
- `IHttpClient`: Only essential HTTP methods (get, post)
- `ILogger`: Only logging methods at different levels

### Dependency Inversion Principle (DIP)

High-level modules don't depend on low-level modules. Both depend on abstractions:

```typescript
// High-level module depends on abstractions
class ReportService implements IReportService {
  constructor(
    private readonly jiraService: IJiraService,      // ← Abstraction
    private readonly githubService: IGitHubService,  // ← Abstraction
    private readonly securityService: ISecurityService, // ← Abstraction
    private readonly logger: ILogger                 // ← Abstraction
  ) {}
}

// Low-level modules implement abstractions
class JiraService implements IJiraService {
  constructor(
    private readonly httpClient: IHttpClient,  // ← Also depends on abstraction
    private readonly logger: ILogger
  ) {}
}
```

**Composition Root** (`src/index.ts`):
```typescript
// All dependencies wired together in one place
const logger = new ConsoleLogger(config.server.logLevel);
const httpClient = new AxiosHttpClient(logger);
const jiraService = new JiraService(httpClient, logger, jiraUrl, email, token, projects);
const githubService = new GitHubService(logger, org, token, repos);
const securityService = new SecurityService(logger, org, token, repos);
const reportService = new ReportService(jiraService, githubService, securityService, logger);
const mcpServer = new MCPServer(jiraService, githubService, securityService, reportService, logger);
```

## Domain-Driven Design Patterns

### Value Objects

Immutable objects representing domain concepts with validation:

**DateRange** (`src/domain/value-objects/DateRange.ts`)
```typescript
export class DateRange {
  private constructor(
    public readonly start: Date,
    public readonly end: Date
  ) {
    this.validate();
  }

  // Smart constructors
  static currentWeek(): DateRange
  static previousWeek(): DateRange
  static forWeek(date: Date): DateRange
  static fromISOStrings(start: string, end: string): DateRange

  // Domain logic
  getWeekNumber(): number
  toString(): string
}
```

**QuarterLabel** (`src/domain/value-objects/QuarterLabel.ts`)
```typescript
export class QuarterLabel {
  private constructor(
    public readonly year: number,
    public readonly quarter: number
  ) {
    this.validate();
  }

  // Parsing and validation
  static fromString(quarterString: string): QuarterLabel // "2025-Q1-PI"
  static current(): QuarterLabel

  // Date calculations
  getStartDate(): Date
  getEndDate(): Date
  toString(): string // Returns "2025-Q1-PI"
}
```

**MetricTrend** (`src/domain/value-objects/MetricTrend.ts`)
```typescript
export class MetricTrend {
  constructor(
    public readonly previousValue: number,
    public readonly currentValue: number,
    public readonly change: number,
    public readonly changePercent: number,
    public readonly direction: TrendDirection
  ) {}

  static create(previous: number, current: number): MetricTrend

  // Display helpers
  getEmoji(): string // ⬆️ ⬇️ ➡️
  toString(): string // "+15 (↑23.5%)"
}
```

**Benefits:**
- Validation at creation time (fail fast)
- Immutability prevents accidental mutation bugs
- Self-documenting code (QuarterLabel vs string)
- Encapsulated domain logic (week calculations)

### Entities (Domain Models)

Objects with business logic and rich behavior:

**StoryPointsMetrics** (`src/domain/models/StoryPointsMetrics.ts`)
```typescript
export class StoryPointsMetrics {
  constructor(
    public readonly totalPoints: number,
    public readonly quarterLabel: QuarterLabel,
    public readonly period: DateRange,
    public readonly breakdown: StoryPointsBreakdown
  ) {}

  getCompletionPercentage(): number {
    return this.totalPoints > 0
      ? (this.breakdown.done / this.totalPoints) * 100
      : 0;
  }

  toJSON() {
    return {
      total_points: this.totalPoints,
      label: this.quarterLabel.toString(),
      period: this.period.toString(),
      breakdown: this.breakdown,
      completion_percentage: this.getCompletionPercentage()
    };
  }
}
```

**PullRequestMetrics** (`src/domain/models/PullRequestMetrics.ts`)
```typescript
export class PullRequestMetrics {
  constructor(
    public readonly created: number,
    public readonly merged: number,
    public readonly period: DateRange,
    public readonly repositories: string[]
  ) {}

  getMergeRate(): number {
    return this.created > 0 ? (this.merged / this.created) * 100 : 0;
  }

  toJSON() {
    return {
      created: this.created,
      merged: this.merged,
      merge_rate: this.getMergeRate(),
      period: this.period.toString(),
      repositories: this.repositories
    };
  }
}
```

**Benefits:**
- Rich domain models (not anemic)
- Encapsulated business logic (completion calculations)
- Type safety throughout the application
- Consistent serialization via toJSON()

### Application Services

Stateless services that orchestrate use cases and coordinate domain objects:

**JiraService** (`src/application/services/JiraService.ts`)
```typescript
export class JiraService implements IJiraService {
  constructor(
    private readonly httpClient: IHttpClient,
    private readonly logger: ILogger,
    private readonly jiraUrl: string,
    jiraEmail: string,
    jiraApiToken: string,
    private readonly defaultProjects?: string[]
  ) {
    const credentials = Buffer.from(`${jiraEmail}:${jiraApiToken}`).toString('base64');
    this.authHeader = `Basic ${credentials}`;
  }

  async getStoryPoints(
    quarterLabel: QuarterLabel,
    period?: DateRange
  ): Promise<StoryPointsMetrics> {
    // Build JQL query with quarterly label
    const jql = `labels = "${quarterLabel.toString()}" AND updated >= "${start}" AND updated <= "${end}"`;

    // Execute JIRA search
    const response = await this.httpClient.get<JiraSearchResponse>(...);

    // Calculate breakdown by status
    const breakdown = this.calculateBreakdown(response.data.issues);

    // Return rich domain model
    return new StoryPointsMetrics(totalPoints, quarterLabel, period, breakdown);
  }

  async getDeployments(period: DateRange, projects?: string[]): Promise<DeploymentMetrics>
  async getBugMetrics(period: DateRange, projects?: string[]): Promise<BugMetrics>
}
```

**Key Responsibilities:**
- External API integration (JIRA REST API)
- Data transformation (API responses → domain models)
- Business rule execution (story point calculations, defect rate)
- Error handling and logging

**ReportService** (`src/application/services/ReportService.ts`)
```typescript
export class ReportService implements IReportService {
  constructor(
    private readonly jiraService: IJiraService,
    private readonly githubService: IGitHubService,
    private readonly securityService: ISecurityService,
    private readonly logger: ILogger
  ) {}

  async generateWeeklyReport(options: WeeklyReportOptions): Promise<string> {
    // Fetch current and previous week metrics in parallel
    const [currentMetrics, previousMetrics] = await Promise.all([
      this.fetchWeeklyMetrics(currentWeek, options),
      this.fetchWeeklyMetrics(previousWeek, options)
    ]);

    // Calculate trends
    const trends = this.calculateTrends(previousMetrics, currentMetrics);

    // Generate markdown report
    return this.formatWeeklyReport(currentMetrics, trends, options);
  }

  async generateQuarterlyReport(options: QuarterlyReportOptions): Promise<string> {
    // Fetch all weeks in quarter
    const weeks = this.getWeeksInQuarter(options.quarter);
    const weeklyMetrics = await Promise.all(
      weeks.map(week => this.fetchWeeklyMetrics(week, options))
    );

    // Generate comprehensive quarterly summary
    return this.formatQuarterlyReport(weeklyMetrics, options);
  }

  private async fetchWeeklyMetrics(
    week: DateRange,
    options: WeeklyReportOptions | QuarterlyReportOptions
  ): Promise<WeeklyMetrics> {
    // Coordinate all services to fetch metrics in parallel
    const [storyPoints, pullRequests, deployments, bugs, security] = await Promise.all([
      this.jiraService.getStoryPoints(quarter, week),
      this.githubService.getPullRequestMetrics(week, options.repositories),
      this.jiraService.getDeployments(week, options.jiraProjects),
      this.jiraService.getBugMetrics(week, options.jiraProjects),
      this.securityService.getSecurityMetrics(options.repositories, 'open')
    ]);

    return { storyPoints, pullRequests, deployments, bugs, security };
  }
}
```

**Key Responsibilities:**
- Service orchestration (coordinates multiple services)
- Report generation (markdown formatting)
- Trend calculation (week-over-week comparison)
- Parallel data fetching (performance optimization)

## Design Patterns Used

### 1. Dependency Injection

All dependencies are injected through constructors, enabling:
- Easy testing with mocks
- Flexible implementations
- Clear dependency graph

**Composition Root** (`src/index.ts`):
```typescript
// All wiring happens in one place
const config = Config.load();

// Infrastructure
const logger = new ConsoleLogger(config.server.logLevel);
const httpClient = new AxiosHttpClient(logger);

// Application Services
const jiraService = new JiraService(
  httpClient,
  logger,
  config.jira.url,
  config.jira.email,
  config.jira.apiToken,
  config.jira.projects?.split(',')
);

const githubService = new GitHubService(
  logger,
  config.github.org,
  config.github.token,
  config.github.repos?.split(',')
);

const securityService = new SecurityService(
  logger,
  config.github.org,
  config.github.token,
  config.github.repos?.split(',')
);

const reportService = new ReportService(
  jiraService,
  githubService,
  securityService,
  logger
);

// MCP Server
const mcpServer = new MCPServer(
  jiraService,
  githubService,
  securityService,
  reportService,
  logger
);

// Start server
const corsOrigins = config.server.corsOrigins?.split(',').map(o => o.trim());
await mcpServer.start(config.server.port, config.server.host, corsOrigins);
```

### 2. Repository Pattern (Simplified)

Services act as repositories for external data sources:

```typescript
// Each service provides domain-focused data access
interface IJiraService {
  getStoryPoints(quarterLabel: QuarterLabel, period?: DateRange): Promise<StoryPointsMetrics>;
  getDeployments(period: DateRange, projects?: string[]): Promise<DeploymentMetrics>;
  getBugMetrics(period: DateRange, projects?: string[]): Promise<BugMetrics>;
}

interface IGitHubService {
  getPullRequestMetrics(period: DateRange, repositories?: string[]): Promise<PullRequestMetrics>;
}
```

### 3. Adapter Pattern

`AxiosHttpClient` adapts Axios library to our domain's `IHttpClient` interface:

```typescript
export class AxiosHttpClient implements IHttpClient {
  private axiosInstance: AxiosInstance;

  constructor(private readonly logger: ILogger, baseURL?: string) {
    this.axiosInstance = axios.create({
      baseURL,
      timeout: 30000,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // Adapts Axios API to our interface
  async get<T>(url: string, config?: HttpRequestConfig): Promise<HttpResponse<T>> {
    try {
      const response = await this.axiosInstance.get<T>(url, {
        headers: config?.headers,
        params: config?.params,
        timeout: config?.timeout
      });

      return {
        data: response.data,
        status: response.status,
        headers: response.headers as Record<string, string>
      };
    } catch (error) {
      this.logger.error('HTTP GET request failed', error as Error);
      throw error;
    }
  }
}
```

### 4. Strategy Pattern

Different implementations can be swapped at runtime:

```typescript
// Different logging strategies
const consoleLogger = new ConsoleLogger(LogLevel.INFO);
const fileLogger = new FileLogger(LogLevel.DEBUG);     // Could be implemented
const cloudLogger = new CloudWatchLogger(LogLevel.ERROR); // Could be implemented

// Different HTTP strategies
const axiosClient = new AxiosHttpClient(logger);
const fetchClient = new FetchHttpClient(logger);       // Could be implemented
const retryClient = new RetryHttpClient(axiosClient, 3); // Decorator pattern
```

### 5. Factory Pattern (in Value Objects)

Smart constructors for creating valid domain objects:

```typescript
// DateRange factory methods
DateRange.currentWeek()           // Creates range for current week
DateRange.previousWeek()          // Creates range for previous week
DateRange.forWeek(date)           // Creates range for week containing date
DateRange.fromISOStrings(s, e)    // Creates from ISO date strings

// QuarterLabel factory methods
QuarterLabel.fromString("2025-Q1-PI")  // Parses and validates
QuarterLabel.current()                  // Creates for current quarter

// MetricTrend factory
MetricTrend.create(previous, current)   // Calculates trend automatically
```

## Data Flow Examples

### Example 1: Getting Story Points

```
1. MCP Client sends tool call request
   POST /mcp
   Headers: Mcp-Session-Id: <uuid>
   Body: {
     "jsonrpc": "2.0",
     "method": "tools/call",
     "params": {
       "name": "get_story_points",
       "arguments": {
         "quarter": "2025-Q1",
         "week_start": "2025-01-13",
         "week_end": "2025-01-19"
       }
     },
     "id": 2
   }
   ↓
2. MCPServer retrieves transport by session ID
   - Validates request with Zod schema
   - Parses arguments
   ↓
3. Tool handler calls JiraService.getStoryPoints()
   - Creates QuarterLabel.fromString("2025-Q1")
   - Creates DateRange.fromISOStrings(...)
   ↓
4. JiraService builds JQL query
   jql = 'labels = "2025-Q1-PI" AND updated >= "2025-01-13" AND updated <= "2025-01-19"'
   ↓
5. JiraService calls httpClient.get()
   url = "/rest/api/2/search"
   params = { jql, maxResults: 100 }
   headers = { Authorization: "Basic <base64>" }
   ↓
6. AxiosHttpClient makes HTTP request
   - Logs request details
   - Awaits Axios response
   - Logs response status
   ↓
7. JiraService processes response
   - Extracts story points from customfield_10016
   - Calculates breakdown by status (Done, In Progress, To Do)
   - Creates StoryPointsMetrics entity
   ↓
8. Tool handler serializes result
   - Calls metrics.toJSON()
   - Formats as MCP tool response
   ↓
9. MCPServer returns JSON-RPC response
   Response: {
     "jsonrpc": "2.0",
     "result": {
       "content": [
         {
           "type": "text",
           "text": "{\"total_points\": 45, ...}"
         }
       ]
     },
     "id": 2
   }
```

### Example 2: Generating Weekly Report

```
1. MCP Client calls generate_weekly_report
   ↓
2. ReportService.generateWeeklyReport(options)
   - Calculates current and previous week DateRanges
   ↓
3. Parallel fetch of current week metrics
   Promise.all([
     jiraService.getStoryPoints(quarter, currentWeek),
     githubService.getPullRequestMetrics(currentWeek, repos),
     jiraService.getDeployments(currentWeek, projects),
     jiraService.getBugMetrics(currentWeek, projects),
     securityService.getSecurityMetrics(repos, 'open')
   ])
   ↓
4. Parallel fetch of previous week metrics (for comparison)
   (same parallel structure)
   ↓
5. Calculate trends
   - MetricTrend.create(previousStoryPoints, currentStoryPoints)
   - MetricTrend.create(previousPRs, currentPRs)
   - ...
   ↓
6. Format markdown report
   - Build header with date range
   - Add metrics sections with emojis
   - Create comparison table with trends
   - Add insights section
   ↓
7. Return comprehensive markdown string
```

## Error Handling Strategy

### Layer-Specific Error Handling

**Domain Layer:**
- Validates value objects on creation
- Throws descriptive errors immediately (fail fast)

```typescript
export class QuarterLabel {
  static fromString(quarterString: string): QuarterLabel {
    const match = quarterString.match(/^(\d{4})-Q([1-4])(-PI)?$/);
    if (!match) {
      throw new Error(
        `Invalid quarter format: ${quarterString}. Expected format: YYYY-QX-PI (e.g., "2025-Q1-PI")`
      );
    }
    // ... create object
  }

  private validate(): void {
    if (this.quarter < 1 || this.quarter > 4) {
      throw new Error(`Invalid quarter: ${this.quarter}. Must be 1-4.`);
    }
  }
}
```

**Application Layer:**
- Catches infrastructure errors
- Logs errors with full context
- Transforms to domain-friendly errors
- Provides actionable error messages

```typescript
export class JiraService implements IJiraService {
  async getStoryPoints(
    quarterLabel: QuarterLabel,
    period?: DateRange
  ): Promise<StoryPointsMetrics> {
    try {
      const response = await this.httpClient.get<JiraSearchResponse>(...);
      // ... process response
    } catch (error) {
      this.logger.error('Failed to fetch story points from JIRA', {
        quarter: quarterLabel.toString(),
        period: period?.toString(),
        error: error as Error
      });
      throw new Error(
        `Failed to fetch story points for ${quarterLabel.toString()}: ${(error as Error).message}`
      );
    }
  }
}
```

**Infrastructure Layer:**
- Handles HTTP errors (4xx, 5xx)
- Handles network errors (timeouts, connection failures)
- Logs all requests and responses
- Provides detailed error context

```typescript
export class AxiosHttpClient implements IHttpClient {
  async get<T>(url: string, config?: HttpRequestConfig): Promise<HttpResponse<T>> {
    this.logger.debug('HTTP GET request', { url, headers: config?.headers });

    try {
      const response = await this.axiosInstance.get<T>(url, ...);
      this.logger.debug('HTTP GET response', { url, status: response.status });
      return { data: response.data, status: response.status, headers: response.headers };
    } catch (error) {
      if (axios.isAxiosError(error)) {
        this.logger.error('HTTP GET request failed', {
          url,
          status: error.response?.status,
          statusText: error.response?.statusText,
          message: error.message
        });
      }
      throw error;
    }
  }
}
```

**MCP Layer:**
- JSON-RPC 2.0 compliant error responses
- Session validation errors
- Tool parameter validation errors

```typescript
// Session validation
if (!sessionId || !this.transports[sessionId]) {
  res.status(400).json({
    jsonrpc: '2.0',
    error: {
      code: -32000,
      message: 'Invalid or missing session ID'
    },
    id: null
  });
  return;
}

// Tool execution errors are caught and formatted
try {
  const result = await toolHandler(args);
  return { content: [{ type: 'text', text: JSON.stringify(result) }] };
} catch (error) {
  this.logger.error('Tool execution failed', { tool: toolName, error });
  throw error; // SDK handles JSON-RPC error formatting
}
```

## Testing Strategy

### Unit Tests (Domain Layer)

Test value objects and domain models in isolation:

```typescript
describe('QuarterLabel', () => {
  it('should parse valid quarter string', () => {
    const label = QuarterLabel.fromString('2025-Q1-PI');
    expect(label.year).toBe(2025);
    expect(label.quarter).toBe(1);
  });

  it('should reject invalid quarter format', () => {
    expect(() => QuarterLabel.fromString('2025-Q5-PI')).toThrow('Invalid quarter');
    expect(() => QuarterLabel.fromString('not-a-quarter')).toThrow('Invalid quarter format');
  });

  it('should calculate quarter start date', () => {
    const label = QuarterLabel.fromString('2025-Q2-PI');
    const start = label.getStartDate();
    expect(start.getMonth()).toBe(3); // April (0-indexed)
    expect(start.getDate()).toBe(1);
  });
});

describe('DateRange', () => {
  it('should create range for current week', () => {
    const range = DateRange.currentWeek();
    expect(range.start.getDay()).toBe(1); // Monday
  });

  it('should validate start before end', () => {
    expect(() => {
      DateRange.fromISOStrings('2025-01-20', '2025-01-13');
    }).toThrow('Start date must be before or equal to end date');
  });
});

describe('MetricTrend', () => {
  it('should calculate upward trend', () => {
    const trend = MetricTrend.create(10, 15);
    expect(trend.direction).toBe(TrendDirection.UP);
    expect(trend.change).toBe(5);
    expect(trend.changePercent).toBe(50);
  });

  it('should handle zero previous value', () => {
    const trend = MetricTrend.create(0, 10);
    expect(trend.changePercent).toBe(100);
  });
});
```

### Unit Tests (Application Layer)

Test services with mocked dependencies:

```typescript
describe('JiraService', () => {
  let mockHttpClient: jest.Mocked<IHttpClient>;
  let mockLogger: jest.Mocked<ILogger>;
  let jiraService: JiraService;

  beforeEach(() => {
    mockHttpClient = {
      get: jest.fn(),
      post: jest.fn()
    };
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn()
    };

    jiraService = new JiraService(
      mockHttpClient,
      mockLogger,
      'https://test.atlassian.net',
      'test@example.com',
      'test-token'
    );
  });

  it('should fetch story points with quarterly label', async () => {
    // Mock HTTP response
    mockHttpClient.get.mockResolvedValue({
      data: {
        total: 10,
        issues: [
          {
            fields: {
              customfield_10016: 5,
              status: { name: 'Done' }
            }
          },
          {
            fields: {
              customfield_10016: 3,
              status: { name: 'In Progress' }
            }
          }
        ]
      },
      status: 200,
      headers: {}
    });

    const quarter = QuarterLabel.fromString('2025-Q1-PI');
    const period = DateRange.fromISOStrings('2025-01-13', '2025-01-19');

    const metrics = await jiraService.getStoryPoints(quarter, period);

    expect(metrics.totalPoints).toBe(8);
    expect(metrics.breakdown.done).toBe(5);
    expect(metrics.breakdown.inProgress).toBe(3);
    expect(mockHttpClient.get).toHaveBeenCalledWith(
      expect.stringContaining('/rest/api/2/search'),
      expect.objectContaining({
        params: expect.objectContaining({
          jql: expect.stringContaining('labels = "2025-Q1-PI"')
        })
      })
    );
  });

  it('should handle JIRA API errors', async () => {
    mockHttpClient.get.mockRejectedValue(new Error('JIRA API error'));

    const quarter = QuarterLabel.fromString('2025-Q1-PI');

    await expect(jiraService.getStoryPoints(quarter)).rejects.toThrow('Failed to fetch story points');
    expect(mockLogger.error).toHaveBeenCalled();
  });
});
```

### Integration Tests

Test service interactions with real (or docker-based) APIs:

```typescript
describe('JiraService Integration', () => {
  let jiraService: JiraService;

  beforeAll(() => {
    // Use real HTTP client but with test JIRA instance
    const logger = new ConsoleLogger(LogLevel.WARN);
    const httpClient = new AxiosHttpClient(logger);
    jiraService = new JiraService(
      httpClient,
      logger,
      process.env.TEST_JIRA_URL!,
      process.env.TEST_JIRA_EMAIL!,
      process.env.TEST_JIRA_TOKEN!
    );
  });

  it('should fetch real story points', async () => {
    const quarter = QuarterLabel.fromString('2025-Q1-PI');
    const metrics = await jiraService.getStoryPoints(quarter);

    expect(metrics).toBeInstanceOf(StoryPointsMetrics);
    expect(metrics.totalPoints).toBeGreaterThanOrEqual(0);
  }, 10000); // Longer timeout for real API
});
```

### End-to-End Tests

Test the entire MCP server:

```typescript
describe('MCP Server E2E', () => {
  let serverUrl: string;

  beforeAll(async () => {
    // Start server on test port
    serverUrl = 'http://localhost:3001';
    // ... start server
  });

  it('should initialize session', async () => {
    const response = await fetch(`${serverUrl}/mcp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {},
          clientInfo: { name: 'test-client', version: '1.0.0' }
        },
        id: 1
      })
    });

    expect(response.status).toBe(200);
    expect(response.headers.get('Mcp-Session-Id')).toBeTruthy();

    const data = await response.json();
    expect(data.result).toBeDefined();
    expect(data.result.capabilities).toBeDefined();
  });

  it('should call get_story_points tool', async () => {
    // First initialize
    const initResponse = await fetch(`${serverUrl}/mcp`, { /* ... */ });
    const sessionId = initResponse.headers.get('Mcp-Session-Id')!;

    // Then call tool
    const toolResponse = await fetch(`${serverUrl}/mcp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Mcp-Session-Id': sessionId
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'tools/call',
        params: {
          name: 'get_story_points',
          arguments: { quarter: '2025-Q1' }
        },
        id: 2
      })
    });

    expect(toolResponse.status).toBe(200);
    const data = await toolResponse.json();
    expect(data.result.content).toBeDefined();
    expect(data.result.content[0].type).toBe('text');
  });
});
```

## Configuration Management

Type-safe configuration with Zod validation:

```typescript
const ConfigSchema = z.object({
  jira: z.object({
    url: z.string().url('JIRA URL must be a valid URL'),
    email: z.string().email('JIRA email must be valid'),
    apiToken: z.string().min(1, 'JIRA API token is required'),
    projects: z.string().optional(), // Comma-separated
  }),
  github: z.object({
    token: z.string().min(1, 'GitHub token is required'),
    org: z.string().min(1, 'GitHub organization is required'),
    repos: z.string().optional(), // Comma-separated
  }),
  server: z.object({
    nodeEnv: z.enum(['development', 'production', 'test']).default('development'),
    logLevel: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
    port: z.number().int().min(1).max(65535).default(3000),
    host: z.string().default('0.0.0.0'),
    corsOrigins: z.string().optional(), // Comma-separated
  }),
});

export class Config {
  private static instance: AppConfig;

  static load(): AppConfig {
    if (!this.instance) {
      try {
        this.instance = ConfigSchema.parse({
          jira: {
            url: process.env.JIRA_URL,
            email: process.env.JIRA_EMAIL,
            apiToken: process.env.JIRA_API_TOKEN,
            projects: process.env.JIRA_PROJECTS,
          },
          github: {
            token: process.env.GITHUB_TOKEN,
            org: process.env.GITHUB_ORG,
            repos: process.env.GITHUB_REPOS,
          },
          server: {
            nodeEnv: process.env.NODE_ENV,
            logLevel: process.env.LOG_LEVEL,
            port: process.env.PORT ? parseInt(process.env.PORT, 10) : undefined,
            host: process.env.HOST,
            corsOrigins: process.env.CORS_ORIGINS,
          },
        });
      } catch (error) {
        if (error instanceof z.ZodError) {
          console.error('Configuration validation failed:');
          error.errors.forEach((err) => {
            console.error(`  - ${err.path.join('.')}: ${err.message}`);
          });
          throw new Error('Invalid configuration. Please check your environment variables.');
        }
        throw error;
      }
    }
    return this.instance;
  }
}
```

**Benefits:**
- Catches configuration errors at startup (fail fast)
- Type-safe access to config values (no typos)
- Clear documentation of required vs optional settings
- Validation messages guide users to fix issues

## Extensibility

### Adding a New Metric Source

Example: Adding SonarQube code quality metrics

**1. Define domain interface:**
```typescript
// src/domain/interfaces/IQualityService.ts
export interface IQualityService {
  getCodeQualityMetrics(period: DateRange, projects?: string[]): Promise<QualityMetrics>;
}
```

**2. Create domain model:**
```typescript
// src/domain/models/QualityMetrics.ts
export class QualityMetrics {
  constructor(
    public readonly coverage: number,
    public readonly bugs: number,
    public readonly codeSmells: number,
    public readonly technicalDebt: number,
    public readonly period: DateRange,
    public readonly projects: string[]
  ) {}

  toJSON() {
    return {
      coverage: this.coverage,
      bugs: this.bugs,
      code_smells: this.codeSmells,
      technical_debt: this.technicalDebt,
      period: this.period.toString(),
      projects: this.projects
    };
  }
}
```

**3. Implement service:**
```typescript
// src/application/services/SonarQubeService.ts
export class SonarQubeService implements IQualityService {
  constructor(
    private readonly httpClient: IHttpClient,
    private readonly logger: ILogger,
    private readonly sonarUrl: string,
    private readonly sonarToken: string,
    private readonly defaultProjects?: string[]
  ) {}

  async getCodeQualityMetrics(
    period: DateRange,
    projects?: string[]
  ): Promise<QualityMetrics> {
    // Implementation
  }
}
```

**4. Update configuration:**
```typescript
// src/infrastructure/config/Config.ts
const ConfigSchema = z.object({
  // ... existing config
  sonarqube: z.object({
    url: z.string().url(),
    token: z.string().min(1),
    projects: z.string().optional(),
  }),
});
```

**5. Register MCP tool:**
```typescript
// src/infrastructure/mcp/MCPServer.ts
server.tool(
  'get_quality_metrics',
  'Retrieve code quality metrics from SonarQube',
  {
    start_date: z.string().describe('ISO date (YYYY-MM-DD)'),
    end_date: z.string().describe('ISO date (YYYY-MM-DD)'),
    projects: z.array(z.string()).optional(),
  },
  async ({ start_date, end_date, projects }) => {
    const period = DateRange.fromISOStrings(start_date, end_date);
    const metrics = await this.qualityService.getCodeQualityMetrics(period, projects);
    return {
      content: [{ type: 'text', text: JSON.stringify(metrics.toJSON(), null, 2) }],
    };
  }
);
```

**6. Wire dependencies:**
```typescript
// src/index.ts
const sonarService = new SonarQubeService(
  httpClient,
  logger,
  config.sonarqube.url,
  config.sonarqube.token,
  config.sonarqube.projects?.split(',')
);

const mcpServer = new MCPServer(
  jiraService,
  githubService,
  securityService,
  reportService,
  sonarService, // Add new service
  logger
);
```

### Adding a New Report Format

Example: PDF reports instead of markdown

**1. Create new interface method:**
```typescript
// src/domain/interfaces/IReportService.ts
export interface IReportService {
  generateWeeklyReport(options: WeeklyReportOptions): Promise<string>;
  generateQuarterlyReport(options: QuarterlyReportOptions): Promise<string>;
  generateWeeklyReportPDF(options: WeeklyReportOptions): Promise<Buffer>; // New
  generateQuarterlyReportPDF(options: QuarterlyReportOptions): Promise<Buffer>; // New
}
```

**2. Implement in service:**
```typescript
// src/application/services/ReportService.ts
import PDFDocument from 'pdfkit';

async generateWeeklyReportPDF(options: WeeklyReportOptions): Promise<Buffer> {
  // Fetch metrics (reuse existing logic)
  const metrics = await this.fetchWeeklyMetrics(...);

  // Generate PDF instead of markdown
  const doc = new PDFDocument();
  doc.fontSize(20).text('Weekly Engineering Metrics Report');
  doc.fontSize(12).text(`Period: ${currentWeek.toString()}`);
  // ... add metrics to PDF

  return doc.end();
}
```

## Performance Considerations

### Parallel Data Fetching

ReportService fetches all metrics in parallel:

```typescript
// Instead of sequential (slow):
const storyPoints = await jiraService.getStoryPoints(quarter, week);
const pullRequests = await githubService.getPullRequestMetrics(week, repos);
const deployments = await jiraService.getDeployments(week, projects);

// Use parallel (fast):
const [storyPoints, pullRequests, deployments, bugs, security] = await Promise.all([
  jiraService.getStoryPoints(quarter, week),
  githubService.getPullRequestMetrics(week, repos),
  jiraService.getDeployments(week, projects),
  jiraService.getBugMetrics(week, projects),
  securityService.getSecurityMetrics(repos, 'open'),
]);
```

**Result**: 5 API calls complete in ~2 seconds instead of ~10 seconds.

### HTTP Client Optimizations

AxiosHttpClient provides:
- **Connection pooling** via Axios (reuse TCP connections)
- **Configurable timeouts** (default 30s, prevents hanging)
- **Request/response interceptors** for logging
- **Automatic retries** (can be added via axios-retry)

### Pagination Handling

```typescript
// JIRA pagination
async getAllIssues(jql: string): Promise<JiraIssue[]> {
  const allIssues: JiraIssue[] = [];
  let startAt = 0;
  const maxResults = 100;

  while (true) {
    const response = await this.httpClient.get<JiraSearchResponse>(..., {
      params: { jql, startAt, maxResults }
    });

    allIssues.push(...response.data.issues);

    if (allIssues.length >= response.data.total) break;
    startAt += maxResults;
  }

  return allIssues;
}
```

### Caching Strategy (Future Enhancement)

Decorator pattern for caching:

```typescript
class CachedJiraService implements IJiraService {
  constructor(
    private readonly inner: IJiraService,
    private readonly cache: ICache,
    private readonly ttl: number = 300 // 5 minutes
  ) {}

  async getStoryPoints(
    quarterLabel: QuarterLabel,
    period?: DateRange
  ): Promise<StoryPointsMetrics> {
    const cacheKey = `story-points:${quarterLabel}:${period}`;

    const cached = await this.cache.get<StoryPointsMetrics>(cacheKey);
    if (cached) {
      this.logger.debug('Cache hit', { cacheKey });
      return cached;
    }

    const metrics = await this.inner.getStoryPoints(quarterLabel, period);
    await this.cache.set(cacheKey, metrics, this.ttl);
    return metrics;
  }
}

// Wire with caching
const jiraService = new CachedJiraService(
  new JiraService(httpClient, logger, ...),
  new RedisCache(redisClient),
  300
);
```

## Security Considerations

### 1. API Key Management
- **Never committed to git**: All tokens in `.env` (gitignored)
- **Environment variables only**: Loaded via dotenv
- **Base64 encoding for JIRA**: Basic auth credentials encoded properly

```typescript
const credentials = Buffer.from(`${jiraEmail}:${jiraApiToken}`).toString('base64');
this.authHeader = `Basic ${credentials}`;
```

### 2. Input Validation
- **Zod schemas** validate all tool inputs at runtime
- **Domain value objects** validate on creation (QuarterLabel, DateRange)
- **Type safety** via TypeScript strict mode

```typescript
server.tool(
  'get_story_points',
  'Query JIRA for story points',
  {
    quarter: z.string().regex(/^\d{4}-Q[1-4](-PI)?$/).describe('Quarter label'),
    week_start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    week_end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  },
  async (args) => { /* ... */ }
);
```

### 3. Error Messages
- **Don't leak sensitive data**: Generic error messages to clients
- **Detailed logging**: Full context logged server-side only

```typescript
try {
  // ... service call
} catch (error) {
  this.logger.error('Failed to fetch story points', {
    quarter: quarterLabel.toString(),
    period: period?.toString(),
    error: error as Error // Full error logged server-side
  });

  // Generic message to client
  throw new Error(`Failed to fetch story points for ${quarterLabel.toString()}`);
}
```

### 4. HTTPS Only
- **All external APIs use HTTPS**: JIRA, GitHub, GHAS
- **No plaintext secrets in transit**: TLS encryption

### 5. CORS Configuration
- **Configurable origins**: Via `CORS_ORIGINS` environment variable
- **Exposed headers**: Only `Mcp-Session-Id` header exposed
- **Production**: Restrict to specific domains

```typescript
app.use(cors({
  origin: corsOrigins || '*', // Restrict in production
  exposedHeaders: ['Mcp-Session-Id']
}));
```

### 6. Session Management
- **UUID-based session IDs**: Cryptographically random via Node crypto
- **Session validation**: All requests after init require valid session ID
- **Cleanup**: Sessions removed on transport close

## Monitoring and Observability

### Current Implementation

**Structured Logging:**
```typescript
this.logger.info('Fetching story points from JIRA', {
  quarter: quarterLabel.toString(),
  period: period?.toString(),
  jql: jql
});

this.logger.error('Failed to fetch story points', {
  quarter: quarterLabel.toString(),
  error: error as Error
});
```

**HTTP Request/Response Logging:**
```typescript
this.logger.debug('HTTP GET request', { url, headers: config?.headers });
this.logger.debug('HTTP GET response', { url, status: response.status });
```

**Session Lifecycle Logging:**
```typescript
this.logger.info('Session initialized', { sessionId });
this.logger.info('Session terminated', { sessionId });
```

### Future Enhancements

**1. Metrics Collection (Prometheus)**
```typescript
import promClient from 'prom-client';

const httpRequestDuration = new promClient.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code']
});

const toolCallCounter = new promClient.Counter({
  name: 'mcp_tool_calls_total',
  help: 'Total number of MCP tool calls',
  labelNames: ['tool_name', 'status']
});
```

**2. Distributed Tracing (OpenTelemetry)**
```typescript
import { trace } from '@opentelemetry/api';

const tracer = trace.getTracer('mcp-engineering-metrics');

async getStoryPoints(...): Promise<StoryPointsMetrics> {
  const span = tracer.startSpan('jira.getStoryPoints');
  try {
    // ... service logic
    span.setStatus({ code: SpanStatusCode.OK });
    return metrics;
  } catch (error) {
    span.setStatus({ code: SpanStatusCode.ERROR });
    throw error;
  } finally {
    span.end();
  }
}
```

**3. Health Checks**

Already implemented:
```typescript
app.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    activeSessions: Object.keys(this.transports).length
  });
});
```

Could be enhanced with:
```typescript
app.get('/health', async (_req: Request, res: Response) => {
  const checks = await Promise.all([
    this.checkJiraConnection(),
    this.checkGitHubConnection(),
    this.checkDatabaseConnection()
  ]);

  const isHealthy = checks.every(c => c.status === 'ok');

  res.status(isHealthy ? 200 : 503).json({
    status: isHealthy ? 'healthy' : 'unhealthy',
    timestamp: new Date().toISOString(),
    activeSessions: Object.keys(this.transports).length,
    checks: {
      jira: checks[0],
      github: checks[1],
      database: checks[2]
    }
  });
});
```

## Deployment Considerations

### Production Checklist

- [ ] **Environment variables configured** (`.env.example` → `.env`)
- [ ] **CORS origins restricted** (`CORS_ORIGINS=https://yourdomain.com`)
- [ ] **Log level set appropriately** (`LOG_LEVEL=warn` or `error`)
- [ ] **HTTPS enabled** (reverse proxy with TLS termination)
- [ ] **Process manager** (PM2, systemd, or Docker)
- [ ] **Health check monitoring** (polling `/health` endpoint)
- [ ] **API rate limiting** (if public-facing)
- [ ] **Session storage** (consider Redis for multi-instance deployments)

### Docker Deployment

```dockerfile
FROM node:18-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy built application
COPY dist ./dist

# Expose port
EXPOSE 3000

# Start server
CMD ["node", "dist/index.js"]
```

### Environment-Specific Configuration

```typescript
// Production: Use Redis for session storage
if (config.server.nodeEnv === 'production') {
  sessionStore = new RedisSessionStore(redisClient);
} else {
  sessionStore = new InMemorySessionStore();
}
```

## Conclusion

This architecture provides:

✅ **Maintainability**: Clear separation of concerns across DDD layers
✅ **Testability**: Dependency injection enables easy mocking and testing
✅ **Extensibility**: New metrics sources and tools added without modifying existing code
✅ **Type Safety**: Full TypeScript coverage with strict mode
✅ **Domain Focus**: Business logic separated from infrastructure
✅ **Best Practices**: SOLID principles and DDD patterns throughout
✅ **MCP Compliance**: Implements MCP Specification 2025-03-26 with streamable HTTP transport
✅ **Performance**: Parallel data fetching and optimized HTTP client
✅ **Security**: API key management, input validation, error handling
✅ **Observability**: Structured logging with extensible monitoring

The architecture is **production-ready** and can scale as requirements evolve. New features can be added by:
1. Defining domain interfaces and models
2. Implementing application services
3. Registering MCP tools
4. Wiring dependencies in the composition root

All while maintaining the clean architecture and SOLID principles established in the foundation.
