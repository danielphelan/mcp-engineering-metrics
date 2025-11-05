/**
 * Get PR Metrics Tool
 *
 * MCP tool for retrieving GitHub pull request statistics.
 * Returns created count, merged count, and merge rate.
 *
 * Follows Single Responsibility Principle: Only handles PR metrics.
 */

import { z } from 'zod';
import { MCPTool, createTextResult } from '../types.js';
import { IGitHubService } from '../../../domain/interfaces/IGitHubService.js';
import { DateRange } from '../../../domain/value-objects/DateRange.js';

/**
 * Schema for PR metrics query parameters
 */
const GetPRMetricsSchema = z.object({
  start_date: z.string().describe('Start date in ISO format (YYYY-MM-DD)'),
  end_date: z.string().describe('End date in ISO format (YYYY-MM-DD)'),
  repositories: z.array(z.string()).optional().describe('Optional: List of repository names to filter'),
});

export type GetPRMetricsArgs = z.infer<typeof GetPRMetricsSchema>;

/**
 * Tool implementation for retrieving GitHub PR metrics
 */
export class GetPRMetricsTool implements MCPTool<typeof GetPRMetricsSchema> {
  readonly name = 'get_pr_metrics';
  readonly description = 'Retrieve GitHub pull request statistics including created count, merged count, and merge rate.';
  readonly schema = GetPRMetricsSchema;

  constructor(private readonly githubService: IGitHubService) {}

  async handler(args: GetPRMetricsArgs) {
    const period = DateRange.fromISOStrings(args.start_date, args.end_date);
    const metrics = await this.githubService.getPullRequestMetrics(period, args.repositories);

    return createTextResult(JSON.stringify(metrics.toJSON(), null, 2));
  }
}
