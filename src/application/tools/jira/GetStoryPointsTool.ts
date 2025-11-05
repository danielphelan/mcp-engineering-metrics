/**
 * Get Story Points Tool
 *
 * MCP tool for querying JIRA story points with quarterly labels.
 * Returns breakdown by status (Done, In Progress, To Do).
 *
 * Follows Single Responsibility Principle: Only handles story points queries.
 */

import { z } from 'zod';
import { MCPTool, createTextResult } from '../types.js';
import { IJiraService } from '../../../domain/interfaces/IJiraService.js';
import { QuarterLabel } from '../../../domain/value-objects/QuarterLabel.js';
import { DateRange } from '../../../domain/value-objects/DateRange.js';

/**
 * Schema for story points query parameters
 */
const GetStoryPointsSchema = z.object({
  quarter: z.string().describe('Quarter label (e.g., "2025-Q1" or "2025-Q1-PI")'),
  week_start: z.string().optional().describe('Optional: ISO date for specific week start (YYYY-MM-DD)'),
  week_end: z.string().optional().describe('Optional: ISO date for specific week end (YYYY-MM-DD)'),
});

export type GetStoryPointsArgs = z.infer<typeof GetStoryPointsSchema>;

/**
 * Tool implementation for retrieving JIRA story points
 */
export class GetStoryPointsTool implements MCPTool<typeof GetStoryPointsSchema> {
  readonly name = 'get_story_points';
  readonly description = 'Query JIRA for story points with quarterly label. Returns breakdown by status (Done, In Progress, To Do).';
  readonly schema = GetStoryPointsSchema;

  constructor(private readonly jiraService: IJiraService) {}

  async handler(args: GetStoryPointsArgs) {
    const quarterLabel = QuarterLabel.fromString(args.quarter);

    let period: DateRange | undefined;
    if (args.week_start && args.week_end) {
      period = DateRange.fromISOStrings(args.week_start, args.week_end);
    }

    const metrics = await this.jiraService.getStoryPoints(quarterLabel, period);

    return createTextResult(JSON.stringify(metrics.toJSON(), null, 2));
  }
}
