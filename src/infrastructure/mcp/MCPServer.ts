/**
 * MCP Server Implementation
 *
 * Main MCP server that exposes engineering metrics tools via streamable HTTP transport.
 * Follows Dependency Injection and Single Responsibility Principles.
 * Implements MCP Specification 2025-03-26 with streamable HTTP transport.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';

import { IJiraService } from '../../domain/interfaces/IJiraService.js';
import { IGitHubService } from '../../domain/interfaces/IGitHubService.js';
import { ISecurityService } from '../../domain/interfaces/ISecurityService.js';
import { IReportService } from '../../domain/interfaces/IReportService.js';
import { ILogger } from '../../domain/interfaces/ILogger.js';
import { QuarterLabel } from '../../domain/value-objects/QuarterLabel.js';
import { DateRange } from '../../domain/value-objects/DateRange.js';

/**
 * Storage for active transports by session ID
 */
interface TransportMap {
  [sessionId: string]: StreamableHTTPServerTransport;
}

export class MCPServer {
  private transports: TransportMap = {};

  constructor(
    private readonly jiraService: IJiraService,
    private readonly githubService: IGitHubService,
    private readonly securityService: ISecurityService,
    private readonly reportService: IReportService,
    private readonly logger: ILogger
  ) {}

  /**
   * Create and configure MCP server instance with all tools
   */
  private createServer(): McpServer {
    const server = new McpServer(
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

    // Register tool: get_story_points
    server.tool(
      'get_story_points',
      'Query JIRA for story points with quarterly label. Returns breakdown by status (Done, In Progress, To Do).',
      {
        quarter: z.string().describe('Quarter label (e.g., "2025-Q1" or "2025-Q1-PI")'),
        week_start: z.string().optional().describe('Optional: ISO date for specific week start (YYYY-MM-DD)'),
        week_end: z.string().optional().describe('Optional: ISO date for specific week end (YYYY-MM-DD)'),
      },
      async ({ quarter, week_start, week_end }) => {
        const quarterLabel = QuarterLabel.fromString(quarter);
        let period: DateRange | undefined;
        if (week_start && week_end) {
          period = DateRange.fromISOStrings(week_start, week_end);
        }
        const metrics = await this.jiraService.getStoryPoints(quarterLabel, period);
        return {
          content: [{ type: 'text', text: JSON.stringify(metrics.toJSON(), null, 2) }],
        };
      }
    );

    // Register tool: get_pr_metrics
    server.tool(
      'get_pr_metrics',
      'Retrieve GitHub pull request statistics including created count, merged count, and merge rate.',
      {
        start_date: z.string().describe('Start date in ISO format (YYYY-MM-DD)'),
        end_date: z.string().describe('End date in ISO format (YYYY-MM-DD)'),
        repositories: z.array(z.string()).optional().describe('Optional: List of repository names to filter'),
      },
      async ({ start_date, end_date, repositories }) => {
        const period = DateRange.fromISOStrings(start_date, end_date);
        const metrics = await this.githubService.getPullRequestMetrics(period, repositories);
        return {
          content: [{ type: 'text', text: JSON.stringify(metrics.toJSON(), null, 2) }],
        };
      }
    );

    // Register tool: get_deployment_count
    server.tool(
      'get_deployment_count',
      'Count JIRA releases deployed within a time period. Returns release names, projects, and dates.',
      {
        start_date: z.string().describe('Start date in ISO format (YYYY-MM-DD)'),
        end_date: z.string().describe('End date in ISO format (YYYY-MM-DD)'),
        projects: z.array(z.string()).optional().describe('Optional: List of JIRA project keys to filter'),
      },
      async ({ start_date, end_date, projects }) => {
        const period = DateRange.fromISOStrings(start_date, end_date);
        const metrics = await this.jiraService.getDeployments(period, projects);
        return {
          content: [{ type: 'text', text: JSON.stringify(metrics.toJSON(), null, 2) }],
        };
      }
    );

    // Register tool: get_bug_ratio
    server.tool(
      'get_bug_ratio',
      'Calculate defect rate from JIRA. Counts bugs and defect sub-tasks against total tickets created.',
      {
        start_date: z.string().describe('Start date in ISO format (YYYY-MM-DD)'),
        end_date: z.string().describe('End date in ISO format (YYYY-MM-DD)'),
        projects: z.array(z.string()).optional().describe('Optional: List of JIRA project keys to filter'),
      },
      async ({ start_date, end_date, projects }) => {
        const period = DateRange.fromISOStrings(start_date, end_date);
        const metrics = await this.jiraService.getBugMetrics(period, projects);
        return {
          content: [{ type: 'text', text: JSON.stringify(metrics.toJSON(), null, 2) }],
        };
      }
    );

    // Register tool: get_ghas_metrics
    server.tool(
      'get_ghas_metrics',
      'Retrieve GitHub Advanced Security metrics including critical/high vulnerabilities and secrets detected.',
      {
        repositories: z.array(z.string()).optional().describe('Optional: List of repository names to filter'),
        state: z.enum(['open', 'resolved']).optional().default('open').describe('Filter by alert state (default: "open")'),
      },
      async ({ repositories, state }) => {
        const metrics = await this.securityService.getSecurityMetrics(repositories, state);
        return {
          content: [{ type: 'text', text: JSON.stringify(metrics.toJSON(), null, 2) }],
        };
      }
    );

    // Register tool: generate_weekly_report
    server.tool(
      'generate_weekly_report',
      'Generate comprehensive markdown report for a week with all metrics and week-over-week comparison.',
      {
        week_start: z.string().optional().describe('Optional: ISO date for week start (YYYY-MM-DD). Defaults to most recent Monday.'),
        quarter: z.string().describe('Quarter label (e.g., "2025-Q1" or "2025-Q1-PI")'),
        repositories: z.array(z.string()).optional().describe('Optional: List of repository names'),
        jira_projects: z.array(z.string()).optional().describe('Optional: List of JIRA project keys'),
      },
      async ({ week_start, quarter, repositories, jira_projects }) => {
        const report = await this.reportService.generateWeeklyReport({
          weekStart: week_start ? new Date(week_start) : undefined,
          quarter: QuarterLabel.fromString(quarter),
          repositories,
          jiraProjects: jira_projects,
        });
        return {
          content: [{ type: 'text', text: report }],
        };
      }
    );

    // Register tool: generate_quarterly_summary
    server.tool(
      'generate_quarterly_summary',
      'Generate quarter-to-date summary with weekly trend tables showing progress over time.',
      {
        quarter: z.string().describe('Quarter label (e.g., "2025-Q1" or "2025-Q1-PI")'),
        repositories: z.array(z.string()).optional().describe('Optional: List of repository names'),
        jira_projects: z.array(z.string()).optional().describe('Optional: List of JIRA project keys'),
      },
      async ({ quarter, repositories, jira_projects }) => {
        const report = await this.reportService.generateQuarterlyReport({
          quarter: QuarterLabel.fromString(quarter),
          repositories,
          jiraProjects: jira_projects,
        });
        return {
          content: [{ type: 'text', text: report }],
        };
      }
    );

    return server;
  }

  /**
   * Start the HTTP server with streamable HTTP transport
   */
  async start(port: number, host: string, corsOrigins?: string[]): Promise<void> {
    const app = express();

    // Configure CORS with Mcp-Session-Id header exposure
    const corsOptions = {
      origin: corsOrigins && corsOrigins.length > 0 ? corsOrigins : '*',
      credentials: true,
      exposedHeaders: ['Mcp-Session-Id'],
    };
    app.use(cors(corsOptions));

    // Parse JSON bodies
    app.use(express.json());

    // Health check endpoint
    app.get('/health', (_req: Request, res: Response) => {
      res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        activeSessions: Object.keys(this.transports).length,
      });
    });

    // MCP POST endpoint - handles initialization and regular requests
    app.post('/mcp', async (req: Request, res: Response) => {
      const sessionId = req.headers['mcp-session-id'] as string | undefined;

      if (sessionId) {
        this.logger.debug('Received MCP request for session', { sessionId });
      }

      try {
        let transport: StreamableHTTPServerTransport;

        if (sessionId && this.transports[sessionId]) {
          // Reuse existing transport for this session
          transport = this.transports[sessionId];
        } else if (!sessionId && isInitializeRequest(req.body)) {
          // New initialization request - create new transport with session ID
          transport = new StreamableHTTPServerTransport({
            sessionIdGenerator: () => randomUUID(),
            onsessioninitialized: (newSessionId: string) => {
              this.logger.info('Session initialized', { sessionId: newSessionId });
              this.transports[newSessionId] = transport;
            },
          });

          // Set up cleanup handler when transport closes
          transport.onclose = () => {
            const sid = transport.sessionId;
            if (sid && this.transports[sid]) {
              this.logger.info('Transport closed, cleaning up session', { sessionId: sid });
              delete this.transports[sid];
            }
          };

          // Connect the transport to a new server instance
          const server = this.createServer();
          await server.connect(transport);
        } else {
          // Invalid request
          res.status(400).json({
            jsonrpc: '2.0',
            error: {
              code: -32000,
              message: 'Invalid request: missing session ID or not an initialization request',
            },
            id: null,
          });
          return;
        }

        // Handle the request with the transport
        await transport.handleRequest(req, res, req.body);
      } catch (error) {
        this.logger.error('Error handling MCP request', error as Error);
        if (!res.headersSent) {
          res.status(500).json({
            jsonrpc: '2.0',
            error: {
              code: -32603,
              message: 'Internal server error',
            },
            id: null,
          });
        }
      }
    });

    // MCP GET endpoint - handles SSE streams for resumability
    app.get('/mcp', async (req: Request, res: Response) => {
      const sessionId = req.headers['mcp-session-id'] as string | undefined;

      if (!sessionId || !this.transports[sessionId]) {
        res.status(400).send('Invalid or missing session ID');
        return;
      }

      const lastEventId = req.headers['last-event-id'];
      if (lastEventId) {
        this.logger.info('Client reconnecting with Last-Event-ID', { sessionId, lastEventId });
      } else {
        this.logger.info('Establishing new SSE stream', { sessionId });
      }

      try {
        const transport = this.transports[sessionId];
        await transport.handleRequest(req, res);
      } catch (error) {
        this.logger.error('Error handling SSE stream', error as Error, { sessionId });
        if (!res.headersSent) {
          res.status(500).send('Error establishing SSE stream');
        }
      }
    });

    // MCP DELETE endpoint - handles session termination
    app.delete('/mcp', async (req: Request, res: Response) => {
      const sessionId = req.headers['mcp-session-id'] as string | undefined;

      if (!sessionId || !this.transports[sessionId]) {
        res.status(400).send('Invalid or missing session ID');
        return;
      }

      this.logger.info('Received session termination request', { sessionId });

      try {
        const transport = this.transports[sessionId];
        await transport.handleRequest(req, res);
      } catch (error) {
        this.logger.error('Error handling session termination', error as Error, { sessionId });
        if (!res.headersSent) {
          res.status(500).send('Error processing session termination');
        }
      }
    });

    // Error handling middleware
    app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
      this.logger.error('HTTP server error', err);
      res.status(500).json({
        error: 'Internal server error',
        message: err.message,
      });
    });

    // Start HTTP server
    return new Promise((resolve) => {
      app.listen(port, host, () => {
        this.logger.info('MCP HTTP Server started with streamable HTTP transport', {
          port,
          host,
          endpoints: {
            health: `http://${host}:${port}/health`,
            mcp: `http://${host}:${port}/mcp`,
          },
          specification: '2025-03-26',
        });
        resolve();
      });
    });
  }

  /**
   * Clean up all active sessions
   */
  async cleanup(): Promise<void> {
    this.logger.info('Cleaning up MCP server sessions', { count: Object.keys(this.transports).length });

    for (const sessionId in this.transports) {
      try {
        this.logger.debug('Closing transport for session', { sessionId });
        await this.transports[sessionId].close();
        delete this.transports[sessionId];
      } catch (error) {
        this.logger.error('Error closing transport', error as Error, { sessionId });
      }
    }
  }
}
