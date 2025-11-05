/**
 * Get GHAS Metrics Tool
 *
 * MCP tool for retrieving GitHub Advanced Security metrics.
 * Returns critical/high vulnerabilities and secrets detected.
 *
 * Follows Single Responsibility Principle: Only handles GHAS security metrics.
 */

import { z } from 'zod';
import { MCPTool, createTextResult } from '../types.js';
import { ISecurityService } from '../../../domain/interfaces/ISecurityService.js';

/**
 * Schema for GHAS metrics query parameters
 */
const GetGHASMetricsSchema = z.object({
  repositories: z.array(z.string()).optional().describe('Optional: List of repository names to filter'),
  state: z
    .enum(['open', 'resolved'])
    .optional()
    .default('open')
    .describe('Filter by alert state (default: "open")'),
});

export type GetGHASMetricsArgs = z.infer<typeof GetGHASMetricsSchema>;

/**
 * Tool implementation for retrieving GHAS security metrics
 */
export class GetGHASMetricsTool implements MCPTool<typeof GetGHASMetricsSchema> {
  readonly name = 'get_ghas_metrics';
  readonly description =
    'Retrieve GitHub Advanced Security metrics including critical/high vulnerabilities and secrets detected.';
  readonly schema = GetGHASMetricsSchema;

  constructor(private readonly securityService: ISecurityService) {}

  async handler(args: GetGHASMetricsArgs) {
    const metrics = await this.securityService.getSecurityMetrics(args.repositories, args.state);

    return createTextResult(JSON.stringify(metrics.toJSON(), null, 2));
  }
}
