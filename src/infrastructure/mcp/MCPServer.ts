/**
 * MCP Server Implementation
 *
 * Main MCP server that exposes engineering metrics tools.
 * Follows Dependency Injection and Single Responsibility Principles.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';
import { IJiraService } from '../../domain/interfaces/IJiraService.js';
import { IGitHubService } from '../../domain/interfaces/IGitHubService.js';
import { ISecurityService } from '../../domain/interfaces/ISecurityService.js';
import { IReportService } from '../../domain/interfaces/IReportService.js';
import { ILogger } from '../../domain/interfaces/ILogger.js';
import { QuarterLabel } from '../../domain/value-objects/QuarterLabel.js';
import { DateRange } from '../../domain/value-objects/DateRange.js';
import { z } from 'zod';

export class MCPServer {
  private server: Server;

  constructor(
    private readonly jiraService: IJiraService,
    private readonly githubService: IGitHubService,
    private readonly securityService: ISecurityService,
    private readonly reportService: IReportService,
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
          case 'get_story_points':
            return await this.handleGetStoryPoints(args);

          case 'get_pr_metrics':
            return await this.handleGetPRMetrics(args);

          case 'get_deployment_count':
            return await this.handleGetDeploymentCount(args);

          case 'get_bug_ratio':
            return await this.handleGetBugRatio(args);

          case 'get_ghas_metrics':
            return await this.handleGetGHASMetrics(args);

          case 'generate_weekly_report':
            return await this.handleGenerateWeeklyReport(args);

          case 'generate_quarterly_summary':
            return await this.handleGenerateQuarterlySummary(args);

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
        name: 'get_story_points',
        description: 'Query JIRA for story points with quarterly label. Returns breakdown by status (Done, In Progress, To Do).',
        inputSchema: {
          type: 'object',
          properties: {
            quarter: {
              type: 'string',
              description: 'Quarter label (e.g., "2025-Q1" or "2025-Q1-PI")',
            },
            week_start: {
              type: 'string',
              description: 'Optional: ISO date for specific week start (YYYY-MM-DD)',
            },
            week_end: {
              type: 'string',
              description: 'Optional: ISO date for specific week end (YYYY-MM-DD)',
            },
          },
          required: ['quarter'],
        },
      },
      {
        name: 'get_pr_metrics',
        description: 'Retrieve GitHub pull request statistics including created count, merged count, and merge rate.',
        inputSchema: {
          type: 'object',
          properties: {
            start_date: {
              type: 'string',
              description: 'Start date in ISO format (YYYY-MM-DD)',
            },
            end_date: {
              type: 'string',
              description: 'End date in ISO format (YYYY-MM-DD)',
            },
            repositories: {
              type: 'array',
              items: { type: 'string' },
              description: 'Optional: List of repository names to filter',
            },
          },
          required: ['start_date', 'end_date'],
        },
      },
      {
        name: 'get_deployment_count',
        description: 'Count JIRA releases deployed within a time period. Returns release names, projects, and dates.',
        inputSchema: {
          type: 'object',
          properties: {
            start_date: {
              type: 'string',
              description: 'Start date in ISO format (YYYY-MM-DD)',
            },
            end_date: {
              type: 'string',
              description: 'End date in ISO format (YYYY-MM-DD)',
            },
            projects: {
              type: 'array',
              items: { type: 'string' },
              description: 'Optional: List of JIRA project keys to filter',
            },
          },
          required: ['start_date', 'end_date'],
        },
      },
      {
        name: 'get_bug_ratio',
        description: 'Calculate defect rate from JIRA. Counts bugs and defect sub-tasks against total tickets created.',
        inputSchema: {
          type: 'object',
          properties: {
            start_date: {
              type: 'string',
              description: 'Start date in ISO format (YYYY-MM-DD)',
            },
            end_date: {
              type: 'string',
              description: 'End date in ISO format (YYYY-MM-DD)',
            },
            projects: {
              type: 'array',
              items: { type: 'string' },
              description: 'Optional: List of JIRA project keys to filter',
            },
          },
          required: ['start_date', 'end_date'],
        },
      },
      {
        name: 'get_ghas_metrics',
        description: 'Retrieve GitHub Advanced Security metrics including critical/high vulnerabilities and secrets detected.',
        inputSchema: {
          type: 'object',
          properties: {
            repositories: {
              type: 'array',
              items: { type: 'string' },
              description: 'Optional: List of repository names to filter',
            },
            state: {
              type: 'string',
              enum: ['open', 'resolved'],
              description: 'Filter by alert state (default: "open")',
              default: 'open',
            },
          },
        },
      },
      {
        name: 'generate_weekly_report',
        description: 'Generate comprehensive markdown report for a week with all metrics and week-over-week comparison.',
        inputSchema: {
          type: 'object',
          properties: {
            week_start: {
              type: 'string',
              description: 'Optional: ISO date for week start (YYYY-MM-DD). Defaults to most recent Monday.',
            },
            quarter: {
              type: 'string',
              description: 'Quarter label (e.g., "2025-Q1" or "2025-Q1-PI")',
            },
            repositories: {
              type: 'array',
              items: { type: 'string' },
              description: 'Optional: List of repository names',
            },
            jira_projects: {
              type: 'array',
              items: { type: 'string' },
              description: 'Optional: List of JIRA project keys',
            },
          },
          required: ['quarter'],
        },
      },
      {
        name: 'generate_quarterly_summary',
        description: 'Generate quarter-to-date summary with weekly trend tables showing progress over time.',
        inputSchema: {
          type: 'object',
          properties: {
            quarter: {
              type: 'string',
              description: 'Quarter label (e.g., "2025-Q1" or "2025-Q1-PI")',
            },
            repositories: {
              type: 'array',
              items: { type: 'string' },
              description: 'Optional: List of repository names',
            },
            jira_projects: {
              type: 'array',
              items: { type: 'string' },
              description: 'Optional: List of JIRA project keys',
            },
          },
          required: ['quarter'],
        },
      },
    ];
  }

  private async handleGetStoryPoints(args: unknown) {
    const schema = z.object({
      quarter: z.string(),
      week_start: z.string().optional(),
      week_end: z.string().optional(),
    });

    const { quarter, week_start, week_end } = schema.parse(args);
    const quarterLabel = QuarterLabel.fromString(quarter);

    let period: DateRange | undefined;
    if (week_start && week_end) {
      period = DateRange.fromISOStrings(week_start, week_end);
    }

    const metrics = await this.jiraService.getStoryPoints(quarterLabel, period);

    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify(metrics.toJSON(), null, 2),
        },
      ],
    };
  }

  private async handleGetPRMetrics(args: unknown) {
    const schema = z.object({
      start_date: z.string(),
      end_date: z.string(),
      repositories: z.array(z.string()).optional(),
    });

    const { start_date, end_date, repositories } = schema.parse(args);
    const period = DateRange.fromISOStrings(start_date, end_date);

    const metrics = await this.githubService.getPullRequestMetrics(period, repositories);

    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify(metrics.toJSON(), null, 2),
        },
      ],
    };
  }

  private async handleGetDeploymentCount(args: unknown) {
    const schema = z.object({
      start_date: z.string(),
      end_date: z.string(),
      projects: z.array(z.string()).optional(),
    });

    const { start_date, end_date, projects } = schema.parse(args);
    const period = DateRange.fromISOStrings(start_date, end_date);

    const metrics = await this.jiraService.getDeployments(period, projects);

    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify(metrics.toJSON(), null, 2),
        },
      ],
    };
  }

  private async handleGetBugRatio(args: unknown) {
    const schema = z.object({
      start_date: z.string(),
      end_date: z.string(),
      projects: z.array(z.string()).optional(),
    });

    const { start_date, end_date, projects } = schema.parse(args);
    const period = DateRange.fromISOStrings(start_date, end_date);

    const metrics = await this.jiraService.getBugMetrics(period, projects);

    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify(metrics.toJSON(), null, 2),
        },
      ],
    };
  }

  private async handleGetGHASMetrics(args: unknown) {
    const schema = z.object({
      repositories: z.array(z.string()).optional(),
      state: z.enum(['open', 'resolved']).optional().default('open'),
    });

    const { repositories, state } = schema.parse(args);

    const metrics = await this.securityService.getSecurityMetrics(repositories, state);

    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify(metrics.toJSON(), null, 2),
        },
      ],
    };
  }

  private async handleGenerateWeeklyReport(args: unknown) {
    const schema = z.object({
      week_start: z.string().optional(),
      quarter: z.string(),
      repositories: z.array(z.string()).optional(),
      jira_projects: z.array(z.string()).optional(),
    });

    const { week_start, quarter, repositories, jira_projects } = schema.parse(args);

    const report = await this.reportService.generateWeeklyReport({
      weekStart: week_start ? new Date(week_start) : undefined,
      quarter: QuarterLabel.fromString(quarter),
      repositories,
      jiraProjects: jira_projects,
    });

    return {
      content: [
        {
          type: 'text' as const,
          text: report,
        },
      ],
    };
  }

  private async handleGenerateQuarterlySummary(args: unknown) {
    const schema = z.object({
      quarter: z.string(),
      repositories: z.array(z.string()).optional(),
      jira_projects: z.array(z.string()).optional(),
    });

    const { quarter, repositories, jira_projects } = schema.parse(args);

    const report = await this.reportService.generateQuarterlyReport({
      quarter: QuarterLabel.fromString(quarter),
      repositories,
      jiraProjects: jira_projects,
    });

    return {
      content: [
        {
          type: 'text' as const,
          text: report,
        },
      ],
    };
  }

  async start(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    this.logger.info('MCP Server started successfully');
  }
}
