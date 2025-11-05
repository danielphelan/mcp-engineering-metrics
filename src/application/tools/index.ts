/**
 * MCP Tool Registry
 *
 * Central registry for all MCP tools.
 * Follows Dependency Injection and Factory patterns.
 *
 * This is the "composition root" for tools - all tool instances are created here
 * with their required dependencies injected.
 */

import { MCPTool } from './types.js';
import { IJiraService } from '../../domain/interfaces/IJiraService.js';
import { IGitHubService } from '../../domain/interfaces/IGitHubService.js';
import { ISecurityService } from '../../domain/interfaces/ISecurityService.js';
import { IReportService } from '../../domain/interfaces/IReportService.js';

// JIRA Tools
import { GetStoryPointsTool } from './jira/GetStoryPointsTool.js';
import { GetDeploymentCountTool } from './jira/GetDeploymentCountTool.js';
import { GetBugRatioTool } from './jira/GetBugRatioTool.js';

// GitHub Tools
import { GetPRMetricsTool } from './github/GetPRMetricsTool.js';
import { GetGHASMetricsTool } from './github/GetGHASMetricsTool.js';

// Report Tools
import { GenerateWeeklyReportTool } from './reports/GenerateWeeklyReportTool.js';
import { GenerateQuarterlyReportTool } from './reports/GenerateQuarterlyReportTool.js';

/**
 * Create all MCP tools with injected dependencies
 *
 * This factory function follows the Dependency Injection pattern:
 * - Services are injected from outside
 * - Tools are instantiated with their required services
 * - Returns array of fully configured tools
 *
 * @param jiraService - JIRA integration service
 * @param githubService - GitHub integration service
 * @param securityService - GitHub Advanced Security service
 * @param reportService - Report generation service
 * @returns Array of all available MCP tools
 */
export function createTools(
  jiraService: IJiraService,
  githubService: IGitHubService,
  securityService: ISecurityService,
  reportService: IReportService
): MCPTool[] {
  return [
    // JIRA Tools
    new GetStoryPointsTool(jiraService),
    new GetDeploymentCountTool(jiraService),
    new GetBugRatioTool(jiraService),

    // GitHub Tools
    new GetPRMetricsTool(githubService),
    new GetGHASMetricsTool(securityService),

    // Report Tools
    new GenerateWeeklyReportTool(reportService),
    new GenerateQuarterlyReportTool(reportService),
  ];
}

/**
 * Get tool by name (useful for testing or direct invocation)
 *
 * @param tools - Array of tools
 * @param name - Tool name to find
 * @returns The matching tool or undefined
 */
export function getToolByName(tools: MCPTool[], name: string): MCPTool | undefined {
  return tools.find((tool) => tool.name === name);
}

// Re-export types for convenience
export * from './types.js';
