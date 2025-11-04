# Architecture Documentation

## Overview

This MCP server is built using Domain-Driven Design (DDD) principles with a clean architecture approach. The codebase is organized into distinct layers with clear boundaries and dependencies flowing inward.

## Architectural Layers

```
┌─────────────────────────────────────────────────────────┐
│                   MCP Client (Claude)                   │
└─────────────────────────┬───────────────────────────────┘
                          │ MCP Protocol
┌─────────────────────────▼───────────────────────────────┐
│              Infrastructure Layer                       │
│  ┌──────────────────────────────────────────────────┐  │
│  │            MCPServer                             │  │
│  │  (Request Handling & Tool Routing)               │  │
│  └──────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────┐  │
│  │     AxiosHttpClient    │    ConsoleLogger        │  │
│  │     (HTTP Impl)        │    (Logging Impl)       │  │
│  └──────────────────────────────────────────────────┘  │
└─────────────────────────┬───────────────────────────────┘
                          │ Depends on Interfaces
┌─────────────────────────▼───────────────────────────────┐
│              Application Layer                          │
│  ┌──────────────────────────────────────────────────┐  │
│  │       OpenWeatherService                         │  │
│  │       (Weather Use Cases)                        │  │
│  └──────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────┐  │
│  │       MaritimeService                            │  │
│  │       (Vessel Tracking Use Cases)                │  │
│  └──────────────────────────────────────────────────┘  │
└─────────────────────────┬───────────────────────────────┘
                          │ Uses
┌─────────────────────────▼───────────────────────────────┐
│              Domain Layer                               │
│  ┌──────────────────────────────────────────────────┐  │
│  │           Interfaces (Contracts)                 │  │
│  │  • IWeatherService  • IMaritimeService           │  │
│  │  • IHttpClient      • ILogger                    │  │
│  └──────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────┐  │
│  │           Domain Models                          │  │
│  │  • WeatherData      • VesselData                 │  │
│  └──────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────┐  │
│  │           Value Objects                          │  │
│  │  • Coordinates      • BoundingBox                │  │
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

**Key principle**: Dependencies point inward. Domain layer has zero external dependencies.

## SOLID Principles Implementation

### Single Responsibility Principle (SRP)

Each class has one and only one reason to change:

- `OpenWeatherService`: Responsible only for weather data retrieval
- `MaritimeService`: Responsible only for vessel tracking
- `AxiosHttpClient`: Responsible only for HTTP communication
- `ConsoleLogger`: Responsible only for logging
- `Config`: Responsible only for configuration management

### Open/Closed Principle (OCP)

Classes are open for extension but closed for modification:

```typescript
// Easy to add new weather providers without modifying existing code
class CustomWeatherService implements IWeatherService {
  // New implementation
}

// Easy to add new HTTP clients
class FetchHttpClient implements IHttpClient {
  // Alternative HTTP implementation
}
```

### Liskov Substitution Principle (LSP)

Subtypes can replace their base types:

```typescript
// Any IHttpClient implementation can be used
const httpClient: IHttpClient = new AxiosHttpClient(logger);
// OR
const httpClient: IHttpClient = new FetchHttpClient(logger);

// Service doesn't care which implementation
const service = new OpenWeatherService(httpClient, logger, apiKey);
```

### Interface Segregation Principle (ISP)

No client is forced to depend on methods it doesn't use:

- `IWeatherService`: Only weather-related methods
- `IMaritimeService`: Only vessel-tracking methods
- `IHttpClient`: Only essential HTTP methods (get, post)
- `ILogger`: Only logging methods at different levels

### Dependency Inversion Principle (DIP)

High-level modules don't depend on low-level modules. Both depend on abstractions:

```typescript
// High-level module depends on abstraction
class OpenWeatherService {
  constructor(
    private readonly httpClient: IHttpClient, // ← Abstraction
    private readonly logger: ILogger,         // ← Abstraction
    private readonly apiKey: string
  ) {}
}

// Low-level module implements abstraction
class AxiosHttpClient implements IHttpClient {
  // Implementation details
}
```

## Domain-Driven Design Patterns

### Value Objects

Immutable objects representing domain concepts:

```typescript
// Coordinates - validates lat/lon on creation
const coords = Coordinates.create(51.5074, -0.1278);

// BoundingBox - ensures valid geographic area
const box = BoundingBox.fromCoordinates(52, -1, 51, 0);
```

**Benefits:**
- Validation at creation time
- Immutability prevents bugs
- Self-documenting code

### Entities

Objects with identity:

```typescript
// WeatherData - represents weather at a point in time
const weather = WeatherData.create({...});

// VesselData - represents a maritime vessel
const vessel = VesselData.create({...});
```

**Benefits:**
- Rich domain models
- Encapsulated business logic
- Type safety

### Services

Stateless operations that don't belong to entities:

```typescript
// Application Services - orchestrate use cases
class OpenWeatherService implements IWeatherService {
  async getCurrentWeather(location: string | Coordinates): Promise<WeatherData>
}
```

## Design Patterns Used

### 1. Dependency Injection

All dependencies are injected through constructors:

```typescript
// Composition root (index.ts)
const logger = new ConsoleLogger(config.server.logLevel);
const httpClient = new AxiosHttpClient(logger, baseUrl);
const weatherService = new OpenWeatherService(httpClient, logger, apiKey);
const mcpServer = new MCPServer(weatherService, maritimeService, logger);
```

### 2. Repository Pattern (Simplified)

Services act as repositories for external data:

```typescript
interface IWeatherService {
  getCurrentWeather(location: string | Coordinates): Promise<WeatherData>;
  getForecast(location: string | Coordinates, days?: number): Promise<WeatherData[]>;
}
```

### 3. Adapter Pattern

`AxiosHttpClient` adapts Axios to our `IHttpClient` interface:

```typescript
class AxiosHttpClient implements IHttpClient {
  private axiosInstance: AxiosInstance;

  // Adapts Axios API to our interface
  async get<T>(url: string, config?: HttpRequestConfig): Promise<HttpResponse<T>>
}
```

### 4. Strategy Pattern

Different implementations can be swapped:

```typescript
// Different logging strategies
const consoleLogger = new ConsoleLogger(LogLevel.INFO);
const fileLogger = new FileLogger(LogLevel.DEBUG); // Could be implemented

// Different HTTP strategies
const axiosClient = new AxiosHttpClient(logger);
const fetchClient = new FetchHttpClient(logger); // Could be implemented
```

## Data Flow

### Example: Getting Current Weather

```
1. MCP Client sends request
   ↓
2. MCPServer.handleGetCurrentWeather()
   - Validates input with Zod
   - Parses location string
   ↓
3. OpenWeatherService.getCurrentWeather()
   - Builds API request parameters
   - Calls httpClient.get()
   ↓
4. AxiosHttpClient.get()
   - Makes HTTP request
   - Logs request/response
   ↓
5. OpenWeatherService.mapToWeatherData()
   - Creates Coordinates value object
   - Creates WeatherData entity
   ↓
6. MCPServer returns formatted response
   - Serializes to JSON
   - Returns to MCP client
```

## Error Handling Strategy

### Layer-Specific Error Handling

**Domain Layer:**
- Validates value objects on creation
- Throws clear validation errors

```typescript
class Coordinates {
  private validate(): void {
    if (this.latitude < -90 || this.latitude > 90) {
      throw new Error(`Invalid latitude: ${this.latitude}`);
    }
  }
}
```

**Application Layer:**
- Catches infrastructure errors
- Logs errors with context
- Transforms to domain-friendly errors

```typescript
async getCurrentWeather(location: string | Coordinates): Promise<WeatherData> {
  try {
    // ... service logic
  } catch (error) {
    this.logger.error('Failed to fetch current weather', error as Error);
    throw new Error(`Failed to fetch weather data: ${error.message}`);
  }
}
```

**Infrastructure Layer:**
- Handles HTTP errors
- Logs all requests/responses
- Provides error details

## Testing Strategy

### Unit Tests

**Domain Layer:**
```typescript
describe('Coordinates', () => {
  it('should validate latitude range', () => {
    expect(() => Coordinates.create(91, 0)).toThrow();
  });
});
```

**Application Layer:**
```typescript
describe('OpenWeatherService', () => {
  it('should fetch current weather', async () => {
    const mockHttp = createMockHttpClient();
    const service = new OpenWeatherService(mockHttp, logger, 'key');
    const weather = await service.getCurrentWeather('London');
    expect(weather).toBeDefined();
  });
});
```

### Integration Tests

Test service interactions with real (or mocked) HTTP:

```typescript
describe('OpenWeatherService Integration', () => {
  it('should handle API errors gracefully', async () => {
    // Test with real API or mock server
  });
});
```

### E2E Tests

Test the entire MCP server:

```typescript
describe('MCP Server E2E', () => {
  it('should handle get_current_weather tool call', async () => {
    // Send MCP request, verify response
  });
});
```

## Configuration Management

Type-safe configuration with validation:

```typescript
const ConfigSchema = z.object({
  openweather: z.object({
    apiKey: z.string().min(1),
    baseUrl: z.string().url(),
  }),
  // ...
});

type AppConfig = z.infer<typeof ConfigSchema>;
```

**Benefits:**
- Catches configuration errors at startup
- Type-safe access to config values
- Clear documentation of required settings

## Extensibility

### Adding a New Tool

1. **Define domain interface:**
```typescript
// src/domain/interfaces/INewService.ts
export interface INewService {
  newMethod(): Promise<Data>;
}
```

2. **Create domain models:**
```typescript
// src/domain/models/NewData.ts
export class NewData {
  // ...
}
```

3. **Implement service:**
```typescript
// src/application/services/NewService.ts
export class NewService implements INewService {
  // ...
}
```

4. **Register in MCP server:**
```typescript
// src/infrastructure/mcp/MCPServer.ts
constructor(
  private readonly newService: INewService,
  // ...
) {}
```

5. **Wire dependencies:**
```typescript
// src/index.ts
const newService = new NewService(httpClient, logger);
const mcpServer = new MCPServer(..., newService);
```

## Performance Considerations

### HTTP Client Optimizations

- Connection pooling (via Axios)
- Request/response interceptors for logging
- Configurable timeouts per service
- Error retry logic (can be added)

### Caching Strategy (Future Enhancement)

```typescript
class CachedWeatherService implements IWeatherService {
  constructor(
    private readonly inner: IWeatherService,
    private readonly cache: ICache
  ) {}

  async getCurrentWeather(location: string | Coordinates): Promise<WeatherData> {
    const cached = await this.cache.get(location);
    if (cached) return cached;

    const weather = await this.inner.getCurrentWeather(location);
    await this.cache.set(location, weather, ttl);
    return weather;
  }
}
```

## Security Considerations

1. **API Key Management**: Stored in environment variables, never committed
2. **Input Validation**: All inputs validated with Zod schemas
3. **Error Messages**: Don't leak sensitive information
4. **HTTPS Only**: All external API calls use HTTPS
5. **Type Safety**: TypeScript strict mode prevents many runtime errors

## Monitoring and Observability

Current implementation provides:
- Structured logging with context
- Request/response logging
- Error logging with stack traces

Future enhancements could include:
- Metrics collection (request counts, latencies)
- Distributed tracing
- Health check endpoints
- Performance monitoring

## Conclusion

This architecture provides:

✅ **Maintainability**: Clear separation of concerns
✅ **Testability**: Dependency injection enables easy testing
✅ **Extensibility**: New features added without modifying existing code
✅ **Type Safety**: Full TypeScript coverage
✅ **Domain Focus**: Business logic separated from infrastructure
✅ **Best Practices**: SOLID principles and DDD patterns

The architecture is production-ready and can scale as requirements evolve.
