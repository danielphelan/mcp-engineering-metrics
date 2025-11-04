# MCP Engineering Metrics Server

A Model Context Protocol (MCP) server providing weather and maritime vessel tracking capabilities. Built with TypeScript following Domain-Driven Design (DDD) principles and SOLID best practices.

## Features

### Weather Tools
- **Current Weather**: Get real-time weather data for any location
- **Weather Forecast**: Get multi-day weather forecasts

### Maritime Tools
- **Vessel Lookup**: Find vessel information by MMSI number
- **Area Search**: Get all vessels within a geographic bounding box
- **Proximity Search**: Find vessels near a specific location

## Architecture

This project follows Domain-Driven Design with a clean architecture approach:

```
src/
├── domain/                  # Core business logic (framework-independent)
│   ├── interfaces/          # Abstractions (SOLID - Dependency Inversion)
│   │   ├── IWeatherService.ts
│   │   ├── IMaritimeService.ts
│   │   ├── IHttpClient.ts
│   │   └── ILogger.ts
│   ├── models/              # Domain entities
│   │   ├── WeatherData.ts
│   │   └── VesselData.ts
│   └── value-objects/       # Immutable domain objects
│       ├── Coordinates.ts
│       └── BoundingBox.ts
├── application/             # Application business rules
│   └── services/            # Service implementations
│       ├── OpenWeatherService.ts
│       └── MaritimeService.ts
└── infrastructure/          # External concerns & implementations
    ├── http/
    │   ├── AxiosHttpClient.ts
    │   └── ConsoleLogger.ts
    ├── config/
    │   └── Config.ts
    └── mcp/
        └── MCPServer.ts
```

### SOLID Principles Applied

1. **Single Responsibility Principle (SRP)**
   - Each class has one reason to change
   - Services handle only their specific domain (weather or maritime)
   - Logger handles only logging concerns

2. **Open/Closed Principle (OCP)**
   - Services are open for extension through interfaces
   - Closed for modification - new features through new implementations

3. **Liskov Substitution Principle (LSP)**
   - Any `IHttpClient` implementation can replace `AxiosHttpClient`
   - Service interfaces can be swapped without breaking consumers

4. **Interface Segregation Principle (ISP)**
   - Focused interfaces (IWeatherService, IMaritimeService)
   - No client depends on methods it doesn't use

5. **Dependency Inversion Principle (DIP)**
   - High-level modules (services) depend on abstractions (interfaces)
   - Low-level modules (HTTP client) depend on abstractions
   - Dependency injection in the composition root (index.ts)

## Prerequisites

- Node.js >= 18.0.0
- npm or yarn
- API keys for:
  - [OpenWeather API](https://openweathermap.org/api)
  - [AIS Hub API](https://www.aishub.net/) (or similar maritime data provider)

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

4. Edit `.env` and add your API keys:
```env
OPENWEATHER_API_KEY=your_openweather_api_key
MARITIME_API_KEY=your_maritime_api_key
```

5. Build the project:
```bash
npm run build
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

## MCP Configuration

Add this server to your MCP client configuration (e.g., Claude Desktop):

```json
{
  "mcpServers": {
    "mcp-engineering-metrics": {
      "command": "node",
      "args": ["/path/to/mcp-engineering-metrics/dist/index.js"],
      "env": {
        "OPENWEATHER_API_KEY": "your_key",
        "MARITIME_API_KEY": "your_key"
      }
    }
  }
}
```

## Available Tools

### 1. get_current_weather

Get current weather data for a location.

**Parameters:**
- `location` (string): City name (e.g., "London") or coordinates (e.g., "51.5074,-0.1278")

**Example:**
```json
{
  "location": "London"
}
```

### 2. get_weather_forecast

Get weather forecast for multiple days.

**Parameters:**
- `location` (string): City name or coordinates
- `days` (number, optional): Number of forecast days (default: 5, max: 5)

**Example:**
```json
{
  "location": "New York",
  "days": 3
}
```

### 3. get_vessel_by_mmsi

Get vessel information by MMSI number.

**Parameters:**
- `mmsi` (string): 9-digit MMSI number

**Example:**
```json
{
  "mmsi": "123456789"
}
```

### 4. get_vessels_in_area

Get all vessels within a geographic bounding box.

**Parameters:**
- `northLat` (number): Northern boundary latitude
- `westLon` (number): Western boundary longitude
- `southLat` (number): Southern boundary latitude
- `eastLon` (number): Eastern boundary longitude

**Example:**
```json
{
  "northLat": 52.0,
  "westLon": -1.0,
  "southLat": 51.0,
  "eastLon": 0.0
}
```

### 5. get_vessels_nearby

Get vessels near a specific location.

**Parameters:**
- `latitude` (number): Center point latitude
- `longitude` (number): Center point longitude
- `radiusKm` (number): Search radius in kilometers

**Example:**
```json
{
  "latitude": 51.5074,
  "longitude": -0.1278,
  "radiusKm": 50
}
```

## Project Structure Details

### Domain Layer
The domain layer contains the core business logic and is framework-independent:

- **Interfaces**: Define contracts for services and infrastructure
- **Models**: Represent business entities (WeatherData, VesselData)
- **Value Objects**: Immutable objects representing domain concepts (Coordinates, BoundingBox)

### Application Layer
Application services coordinate domain objects and implement use cases:

- **OpenWeatherService**: Weather data retrieval from OpenWeather API
- **MaritimeService**: Vessel tracking from AIS data providers

### Infrastructure Layer
External concerns and implementations:

- **HTTP Client**: Axios-based HTTP client with logging
- **Logger**: Console-based logging implementation
- **Configuration**: Environment-based configuration with validation
- **MCP Server**: Model Context Protocol server implementation

## Configuration Options

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `OPENWEATHER_API_KEY` | Yes | - | OpenWeather API key |
| `OPENWEATHER_BASE_URL` | No | `https://api.openweathermap.org/data/2.5` | OpenWeather API base URL |
| `MARITIME_API_KEY` | Yes | - | Maritime/AIS Hub API key |
| `MARITIME_BASE_URL` | No | `https://www.aishub.net/api` | Maritime API base URL |
| `NODE_ENV` | No | `development` | Environment (development/production/test) |
| `LOG_LEVEL` | No | `info` | Logging level (debug/info/warn/error) |

## Error Handling

The server implements comprehensive error handling:

- Invalid coordinates are rejected with validation errors
- API errors are logged and returned with meaningful messages
- Configuration errors are caught at startup
- All service errors are properly propagated

## Extending the Server

### Adding a New Service

1. **Define the interface** in `src/domain/interfaces/`
2. **Create domain models** in `src/domain/models/`
3. **Implement the service** in `src/application/services/`
4. **Register in MCP server** in `src/infrastructure/mcp/MCPServer.ts`
5. **Wire up dependencies** in `src/index.ts`

### Adding a New Tool

1. **Add tool definition** in `MCPServer.getToolDefinitions()`
2. **Add handler method** in `MCPServer` (e.g., `handleNewTool()`)
3. **Add case to switch statement** in `CallToolRequestSchema` handler

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

## Testing

Testing recommendations (infrastructure not included but recommended):

- **Unit Tests**: Test domain models and value objects
- **Integration Tests**: Test services with mocked HTTP clients
- **E2E Tests**: Test MCP server with real API calls

## License

MIT

## Contributing

Contributions are welcome! Please ensure:

1. Follow the existing architecture patterns
2. Maintain SOLID principles
3. Add appropriate error handling
4. Update documentation
5. Write tests for new features

## Support

For issues, questions, or contributions, please open an issue in the repository.
