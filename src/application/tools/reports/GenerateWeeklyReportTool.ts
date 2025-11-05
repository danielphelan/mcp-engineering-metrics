/**
 * Generate Weekly Report Tool
 *
 * MCP tool for generating comprehensive markdown report for a week.
 * Includes all metrics and week-over-week comparison.
 *
 * Follows Single Responsibility Principle: Only handles weekly report generation.
 */

import { z } from 'zod';
import { MCPTool, createTextResult } from '../types.js';
import { IReportService } from '../../../domain/interfaces/IReportService.js';
import { QuarterLabel } from '../../../domain/value-objects/QuarterLabel.js';

/**
 * Schema for weekly report parameters
 */
const GenerateWeeklyReportSchema = z.object({
  week_start: z
    .string()
    .optional()
    .describe('Optional: ISO date for week start (YYYY-MM-DD). Defaults to most recent Monday.'),
  quarter: z.string().describe('Quarter label (e.g., "2025-Q1" or "2025-Q1-PI")'),
  repositories: z.array(z.string()).optional().describe('Optional: List of repository names'),
  jira_projects: z.array(z.string()).optional().describe('Optional: List of JIRA project keys'),
});

export type GenerateWeeklyReportArgs = z.infer<typeof GenerateWeeklyReportSchema>;

/**
 * Tool implementation for generating weekly engineering metrics reports
 */
export class GenerateWeeklyReportTool implements MCPTool<typeof GenerateWeeklyReportSchema> {
  readonly name = 'generate_weekly_report';
  readonly description =
    'Generate comprehensive markdown report for a week with all metrics and week-over-week comparison.';
  readonly schema = GenerateWeeklyReportSchema;

  constructor(private readonly reportService: IReportService) {}

  async handler(args: GenerateWeeklyReportArgs) {
    const report = await this.reportService.generateWeeklyReport({
      weekStart: args.week_start ? new Date(args.week_start) : undefined,
      quarter: QuarterLabel.fromString(args.quarter),
      repositories: args.repositories,
      jiraProjects: args.jira_projects,
    });

    return createTextResult(report);
  }
}
