/**
 * Get Deployment Count Tool
 *
 * MCP tool for counting JIRA releases deployed within a time period.
 * Returns release names, projects, and dates.
 *
 * Follows Single Responsibility Principle: Only handles deployment counting.
 */

import { z } from 'zod';
import { MCPTool, createTextResult } from '../types.js';
import { IJiraService } from '../../../domain/interfaces/IJiraService.js';
import { DateRange } from '../../../domain/value-objects/DateRange.js';

/**
 * Schema for deployment count query parameters
 */
const GetDeploymentCountSchema = z.object({
  start_date: z.string().describe('Start date in ISO format (YYYY-MM-DD)'),
  end_date: z.string().describe('End date in ISO format (YYYY-MM-DD)'),
  projects: z.array(z.string()).optional().describe('Optional: List of JIRA project keys to filter'),
});

export type GetDeploymentCountArgs = z.infer<typeof GetDeploymentCountSchema>;

/**
 * Tool implementation for retrieving JIRA deployment metrics
 */
export class GetDeploymentCountTool implements MCPTool<typeof GetDeploymentCountSchema> {
  readonly name = 'get_deployment_count';
  readonly description = 'Count JIRA releases deployed within a time period. Returns release names, projects, and dates.';
  readonly schema = GetDeploymentCountSchema;

  constructor(private readonly jiraService: IJiraService) {}

  async handler(args: GetDeploymentCountArgs) {
    const period = DateRange.fromISOStrings(args.start_date, args.end_date);
    const metrics = await this.jiraService.getDeployments(period, args.projects);

    return createTextResult(JSON.stringify(metrics.toJSON(), null, 2));
  }
}
