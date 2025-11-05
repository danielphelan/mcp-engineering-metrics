/**
 * MCP Server Implementation
 *
 * Main MCP server that exposes engineering metrics tools via streamable HTTP transport.
 * Follows Dependency Injection and Single Responsibility Principles.
 * Implements MCP Specification 2025-03-26 with streamable HTTP transport.
 *
 * This class is now focused solely on:
 * - HTTP transport management
 * - Session lifecycle management
 * - MCP protocol handling
 *
 * Tool definitions are managed in src/application/tools/
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { randomUUID } from 'node:crypto';

import { IJiraService } from '../../domain/interfaces/IJiraService.js';
import { IGitHubService } from '../../domain/interfaces/IGitHubService.js';
import { ISecurityService } from '../../domain/interfaces/ISecurityService.js';
import { IReportService } from '../../domain/interfaces/IReportService.js';
import { ILogger } from '../../domain/interfaces/ILogger.js';
import { createTools } from '../../application/tools/index.js';

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
   *
   * Tools are defined in src/application/tools/ following SOLID principles.
   * This method simply creates the server and registers all tools from the registry.
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

    // Create all tools with injected dependencies
    const tools = createTools(
      this.jiraService,
      this.githubService,
      this.securityService,
      this.reportService
    );

    // Register all tools with the MCP server
    for (const tool of tools) {
      this.logger.debug('Registering MCP tool', { name: tool.name });
      // Extract the shape from ZodObject for MCP SDK compatibility
      const schemaShape = 'shape' in tool.schema ? (tool.schema as any).shape : tool.schema;
      server.tool(tool.name, tool.description, schemaShape, tool.handler.bind(tool));
    }

    this.logger.info('MCP tools registered', { count: tools.length });

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
