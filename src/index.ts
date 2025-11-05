#!/usr/bin/env node

/**
 * MCP Engineering Metrics Server
 *
 * Entry point for the MCP server with dependency injection setup.
 * Follows Dependency Injection and Composition Root patterns.
 */

import { MCPServer } from './infrastructure/mcp/MCPServer.js';
import { JiraService } from './application/services/JiraService.js';
import { GitHubService } from './application/services/GitHubService.js';
import { SecurityService } from './application/services/SecurityService.js';
import { ReportService } from './application/services/ReportService.js';
import { AxiosHttpClient } from './infrastructure/http/AxiosHttpClient.js';
import { PinoLogger } from './infrastructure/http/PinoLogger.js';
import { Config } from './infrastructure/config/Config.js';
import { LogLevel } from './domain/interfaces/ILogger.js';

async function main() {
  try {
    // Load configuration
    const config = Config.load();

    // Create logger (Pino for production-ready structured logging)
    const logger = new PinoLogger(config.server.logLevel as LogLevel, config.server.nodeEnv);

    logger.info('Starting MCP Engineering Metrics Server', {
      version: '1.0.0',
      environment: config.server.nodeEnv,
    });

    // Create HTTP client for JIRA
    const jiraHttpClient = new AxiosHttpClient(logger, config.jira.url, 15000);

    // Parse optional configuration lists
    const jiraProjects = config.jira.projects?.split(',').map((p) => p.trim());
    const githubRepos = config.github.repos?.split(',').map((r) => r.trim());

    // Create service instances
    const jiraService = new JiraService(
      jiraHttpClient,
      logger,
      config.jira.url,
      config.jira.email,
      config.jira.apiToken,
      jiraProjects
    );

    const githubService = new GitHubService(
      logger,
      config.github.org,
      config.github.token,
      githubRepos
    );

    const securityService = new SecurityService(
      logger,
      config.github.org,
      config.github.token,
      githubRepos
    );

    const reportService = new ReportService(
      jiraService,
      githubService,
      securityService,
      logger
    );

    // Create and start MCP server
    const mcpServer = new MCPServer(
      jiraService,
      githubService,
      securityService,
      reportService,
      logger
    );

    // Parse CORS origins
    const corsOrigins = config.server.corsOrigins
      ? config.server.corsOrigins.split(',').map((origin) => origin.trim())
      : undefined;

    await mcpServer.start(config.server.port, config.server.host, corsOrigins);

    logger.info('MCP Server is ready to accept HTTP requests', {
      port: config.server.port,
      host: config.server.host,
    });

    // Handle graceful shutdown
    process.on('SIGINT', async () => {
      logger.info('Received SIGINT, shutting down gracefully');
      await mcpServer.cleanup();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      logger.info('Received SIGTERM, shutting down gracefully');
      await mcpServer.cleanup();
      process.exit(0);
    });
  } catch (error) {
    console.error('Failed to start MCP server:', error);
    process.exit(1);
  }
}

main();
