/**
 * GitHub Service Interface
 *
 * Defines the contract for GitHub data retrieval services.
 * Follows Interface Segregation Principle.
 */

import { PullRequestMetrics } from '../models/PullRequestMetrics.js';
import { DateRange } from '../value-objects/DateRange.js';

export interface IGitHubService {
  /**
   * Get pull request metrics for a time period
   * @param period - Date range for the query
   * @param repositories - Optional list of repository names to filter
   * @returns Promise with PR metrics
   */
  getPullRequestMetrics(period: DateRange, repositories?: string[]): Promise<PullRequestMetrics>;
}
