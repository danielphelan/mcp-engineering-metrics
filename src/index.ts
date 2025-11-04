#!/usr/bin/env node

/**
 * MCP Engineering Metrics Server
 *
 * Entry point for the MCP server with dependency injection setup.
 * Follows Dependency Injection and Composition Root patterns.
 */

import { MCPServer } from './infrastructure/mcp/MCPServer.js';
import { OpenWeatherService } from './application/services/OpenWeatherService.js';
import { MaritimeService } from './application/services/MaritimeService.js';
import { AxiosHttpClient } from './infrastructure/http/AxiosHttpClient.js';
import { ConsoleLogger } from './infrastructure/http/ConsoleLogger.js';
import { Config } from './infrastructure/config/Config.js';
import { LogLevel } from './domain/interfaces/ILogger.js';

async function main() {
  try {
    // Load configuration
    const config = Config.load();

    // Create logger
    const logger = new ConsoleLogger(config.server.logLevel as LogLevel);

    logger.info('Starting MCP Engineering Metrics Server', {
      version: '1.0.0',
      environment: config.server.nodeEnv,
    });

    // Create HTTP clients for each service
    const weatherHttpClient = new AxiosHttpClient(
      logger,
      config.openweather.baseUrl,
      10000
    );

    const maritimeHttpClient = new AxiosHttpClient(
      logger,
      config.maritime.baseUrl,
      15000
    );

    // Create service instances
    const weatherService = new OpenWeatherService(
      weatherHttpClient,
      logger,
      config.openweather.apiKey
    );

    const maritimeService = new MaritimeService(
      maritimeHttpClient,
      logger,
      config.maritime.apiKey
    );

    // Create and start MCP server
    const mcpServer = new MCPServer(weatherService, maritimeService, logger);
    await mcpServer.start();

    logger.info('MCP Server is ready to accept requests');

    // Handle graceful shutdown
    process.on('SIGINT', () => {
      logger.info('Received SIGINT, shutting down gracefully');
      process.exit(0);
    });

    process.on('SIGTERM', () => {
      logger.info('Received SIGTERM, shutting down gracefully');
      process.exit(0);
    });
  } catch (error) {
    console.error('Failed to start MCP server:', error);
    process.exit(1);
  }
}

main();
