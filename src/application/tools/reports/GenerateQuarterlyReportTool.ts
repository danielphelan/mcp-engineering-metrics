/**
 * Generate Quarterly Summary Tool
 *
 * MCP tool for generating quarter-to-date summary.
 * Includes weekly trend tables showing progress over time.
 *
 * Follows Single Responsibility Principle: Only handles quarterly report generation.
 */

import { z } from 'zod';
import { MCPTool, createTextResult } from '../types.js';
import { IReportService } from '../../../domain/interfaces/IReportService.js';
import { QuarterLabel } from '../../../domain/value-objects/QuarterLabel.js';

/**
 * Schema for quarterly report parameters
 */
const GenerateQuarterlyReportSchema = z.object({
  quarter: z.string().describe('Quarter label (e.g., "2025-Q1" or "2025-Q1-PI")'),
  repositories: z.array(z.string()).optional().describe('Optional: List of repository names'),
  jira_projects: z.array(z.string()).optional().describe('Optional: List of JIRA project keys'),
});

export type GenerateQuarterlyReportArgs = z.infer<typeof GenerateQuarterlyReportSchema>;

/**
 * Tool implementation for generating quarterly engineering metrics summaries
 */
export class GenerateQuarterlyReportTool implements MCPTool<typeof GenerateQuarterlyReportSchema> {
  readonly name = 'generate_quarterly_summary';
  readonly description = 'Generate quarter-to-date summary with weekly trend tables showing progress over time.';
  readonly schema = GenerateQuarterlyReportSchema;

  constructor(private readonly reportService: IReportService) {}

  async handler(args: GenerateQuarterlyReportArgs) {
    const report = await this.reportService.generateQuarterlyReport({
      quarter: QuarterLabel.fromString(args.quarter),
      repositories: args.repositories,
      jiraProjects: args.jira_projects,
    });

    return createTextResult(report);
  }
}
