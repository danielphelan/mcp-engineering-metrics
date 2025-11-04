/**
 * MCP Server Implementation
 *
 * Main MCP server that exposes weather and maritime tools.
 * Follows Dependency Injection and Single Responsibility Principles.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';
import { IWeatherService } from '../../domain/interfaces/IWeatherService.js';
import { IMaritimeService } from '../../domain/interfaces/IMaritimeService.js';
import { ILogger } from '../../domain/interfaces/ILogger.js';
import { Coordinates } from '../../domain/value-objects/Coordinates.js';
import { BoundingBox } from '../../domain/value-objects/BoundingBox.js';
import { z } from 'zod';

export class MCPServer {
  private server: Server;

  constructor(
    private readonly weatherService: IWeatherService,
    private readonly maritimeService: IMaritimeService,
    private readonly logger: ILogger
  ) {
    this.server = new Server(
      {
        name: 'mcp-engineering-metrics',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupHandlers();
  }

  private setupHandlers(): void {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: this.getToolDefinitions(),
      };
    });

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        this.logger.info('Tool called', { tool: name, args });

        switch (name) {
          case 'get_current_weather':
            return await this.handleGetCurrentWeather(args);

          case 'get_weather_forecast':
            return await this.handleGetWeatherForecast(args);

          case 'get_vessel_by_mmsi':
            return await this.handleGetVesselByMMSI(args);

          case 'get_vessels_in_area':
            return await this.handleGetVesselsInArea(args);

          case 'get_vessels_nearby':
            return await this.handleGetVesselsNearby(args);

          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error) {
        this.logger.error('Tool execution failed', error as Error, { tool: name });
        return {
          content: [
            {
              type: 'text' as const,
              text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
            },
          ],
        };
      }
    });
  }

  private getToolDefinitions(): Tool[] {
    return [
      {
        name: 'get_current_weather',
        description: 'Get current weather data for a specific location. You can provide either a city name or coordinates (latitude, longitude).',
        inputSchema: {
          type: 'object',
          properties: {
            location: {
              type: 'string',
              description: 'City name (e.g., "London", "New York") or coordinates in format "lat,lon" (e.g., "51.5074,-0.1278")',
            },
          },
          required: ['location'],
        },
      },
      {
        name: 'get_weather_forecast',
        description: 'Get weather forecast for a specific location. Provides forecast data for the specified number of days.',
        inputSchema: {
          type: 'object',
          properties: {
            location: {
              type: 'string',
              description: 'City name or coordinates in format "lat,lon"',
            },
            days: {
              type: 'number',
              description: 'Number of days to forecast (default: 5, max: 5)',
              default: 5,
            },
          },
          required: ['location'],
        },
      },
      {
        name: 'get_vessel_by_mmsi',
        description: 'Get detailed information about a specific maritime vessel using its MMSI (Maritime Mobile Service Identity) number.',
        inputSchema: {
          type: 'object',
          properties: {
            mmsi: {
              type: 'string',
              description: 'The 9-digit MMSI number of the vessel',
            },
          },
          required: ['mmsi'],
        },
      },
      {
        name: 'get_vessels_in_area',
        description: 'Get all vessels within a specific geographic area defined by a bounding box.',
        inputSchema: {
          type: 'object',
          properties: {
            northLat: {
              type: 'number',
              description: 'Northern boundary latitude (-90 to 90)',
            },
            westLon: {
              type: 'number',
              description: 'Western boundary longitude (-180 to 180)',
            },
            southLat: {
              type: 'number',
              description: 'Southern boundary latitude (-90 to 90)',
            },
            eastLon: {
              type: 'number',
              description: 'Eastern boundary longitude (-180 to 180)',
            },
          },
          required: ['northLat', 'westLon', 'southLat', 'eastLon'],
        },
      },
      {
        name: 'get_vessels_nearby',
        description: 'Get vessels near a specific location within a given radius.',
        inputSchema: {
          type: 'object',
          properties: {
            latitude: {
              type: 'number',
              description: 'Center point latitude (-90 to 90)',
            },
            longitude: {
              type: 'number',
              description: 'Center point longitude (-180 to 180)',
            },
            radiusKm: {
              type: 'number',
              description: 'Search radius in kilometers',
            },
          },
          required: ['latitude', 'longitude', 'radiusKm'],
        },
      },
    ];
  }

  private async handleGetCurrentWeather(args: unknown) {
    const schema = z.object({
      location: z.string(),
    });

    const { location } = schema.parse(args);
    const parsedLocation = this.parseLocation(location);
    const weather = await this.weatherService.getCurrentWeather(parsedLocation);

    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify(weather.toJSON(), null, 2),
        },
      ],
    };
  }

  private async handleGetWeatherForecast(args: unknown) {
    const schema = z.object({
      location: z.string(),
      days: z.number().optional().default(5),
    });

    const { location, days } = schema.parse(args);
    const parsedLocation = this.parseLocation(location);
    const forecast = await this.weatherService.getForecast(parsedLocation, days);

    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify(forecast.map((w) => w.toJSON()), null, 2),
        },
      ],
    };
  }

  private async handleGetVesselByMMSI(args: unknown) {
    const schema = z.object({
      mmsi: z.string(),
    });

    const { mmsi } = schema.parse(args);
    const vessel = await this.maritimeService.getVesselByMMSI(mmsi);

    if (!vessel) {
      return {
        content: [
          {
            type: 'text' as const,
            text: `No vessel found with MMSI: ${mmsi}`,
          },
        ],
      };
    }

    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify(vessel.toJSON(), null, 2),
        },
      ],
    };
  }

  private async handleGetVesselsInArea(args: unknown) {
    const schema = z.object({
      northLat: z.number(),
      westLon: z.number(),
      southLat: z.number(),
      eastLon: z.number(),
    });

    const { northLat, westLon, southLat, eastLon } = schema.parse(args);
    const boundingBox = BoundingBox.fromCoordinates(northLat, westLon, southLat, eastLon);
    const vessels = await this.maritimeService.getVesselsInArea(boundingBox);

    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify(
            {
              count: vessels.length,
              vessels: vessels.map((v) => v.toJSON()),
            },
            null,
            2
          ),
        },
      ],
    };
  }

  private async handleGetVesselsNearby(args: unknown) {
    const schema = z.object({
      latitude: z.number(),
      longitude: z.number(),
      radiusKm: z.number(),
    });

    const { latitude, longitude, radiusKm } = schema.parse(args);
    const coordinates = Coordinates.create(latitude, longitude);
    const vessels = await this.maritimeService.getVesselsNearby(coordinates, radiusKm);

    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify(
            {
              count: vessels.length,
              searchCenter: coordinates.toJSON(),
              radiusKm,
              vessels: vessels.map((v) => v.toJSON()),
            },
            null,
            2
          ),
        },
      ],
    };
  }

  private parseLocation(location: string): string | Coordinates {
    // Check if location is in "lat,lon" format
    const coordPattern = /^(-?\d+\.?\d*),\s*(-?\d+\.?\d*)$/;
    const match = location.match(coordPattern);

    if (match) {
      const lat = parseFloat(match[1]);
      const lon = parseFloat(match[2]);
      return Coordinates.create(lat, lon);
    }

    return location;
  }

  async start(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    this.logger.info('MCP Server started successfully');
  }
}
