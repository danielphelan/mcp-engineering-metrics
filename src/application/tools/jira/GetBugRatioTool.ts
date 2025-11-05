/**
 * Get Bug Ratio Tool
 *
 * MCP tool for calculating defect rate from JIRA.
 * Counts bugs and defect sub-tasks against total tickets created.
 *
 * Follows Single Responsibility Principle: Only handles bug metrics.
 */

import { z } from 'zod';
import { MCPTool, createTextResult } from '../types.js';
import { IJiraService } from '../../../domain/interfaces/IJiraService.js';
import { DateRange } from '../../../domain/value-objects/DateRange.js';

/**
 * Schema for bug ratio query parameters
 */
const GetBugRatioSchema = z.object({
  start_date: z.string().describe('Start date in ISO format (YYYY-MM-DD)'),
  end_date: z.string().describe('End date in ISO format (YYYY-MM-DD)'),
  projects: z.array(z.string()).optional().describe('Optional: List of JIRA project keys to filter'),
});

export type GetBugRatioArgs = z.infer<typeof GetBugRatioSchema>;

/**
 * Tool implementation for retrieving JIRA bug metrics
 */
export class GetBugRatioTool implements MCPTool<typeof GetBugRatioSchema> {
  readonly name = 'get_bug_ratio';
  readonly description = 'Calculate defect rate from JIRA. Counts bugs and defect sub-tasks against total tickets created.';
  readonly schema = GetBugRatioSchema;

  constructor(private readonly jiraService: IJiraService) {}

  async handler(args: GetBugRatioArgs) {
    const period = DateRange.fromISOStrings(args.start_date, args.end_date);
    const metrics = await this.jiraService.getBugMetrics(period, args.projects);

    return createTextResult(JSON.stringify(metrics.toJSON(), null, 2));
  }
}
