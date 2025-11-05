/**
 * JIRA Service Interface
 *
 * Defines the contract for JIRA data retrieval services.
 * Follows Interface Segregation Principle.
 */

import { StoryPointsMetrics } from '../models/StoryPointsMetrics.js';
import { DeploymentMetrics } from '../models/DeploymentMetrics.js';
import { BugMetrics } from '../models/BugMetrics.js';
import { QuarterLabel } from '../value-objects/QuarterLabel.js';
import { DateRange } from '../value-objects/DateRange.js';

export interface IJiraService {
  /**
   * Get story points for issues with a specific quarterly label
   * @param quarterLabel - The quarterly label (e.g., "2025-Q1-PI")
   * @param period - Optional date range to filter within the quarter
   * @returns Promise with story points metrics
   */
  getStoryPoints(quarterLabel: QuarterLabel, period?: DateRange): Promise<StoryPointsMetrics>;

  /**
   * Get deployment/release count for a time period
   * @param period - Date range for the query
   * @param projects - Optional list of JIRA project keys to filter
   * @returns Promise with deployment metrics
   */
  getDeployments(period: DateRange, projects?: string[]): Promise<DeploymentMetrics>;

  /**
   * Get bug metrics (defect rate) for a time period
   * @param period - Date range for the query
   * @param projects - Optional list of JIRA project keys to filter
   * @returns Promise with bug metrics
   */
  getBugMetrics(period: DateRange, projects?: string[]): Promise<BugMetrics>;
}
