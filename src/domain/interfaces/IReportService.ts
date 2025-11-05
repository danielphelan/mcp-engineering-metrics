/**
 * Report Service Interface
 *
 * Defines the contract for generating metrics reports.
 * Follows Interface Segregation Principle.
 */

import { QuarterLabel } from '../value-objects/QuarterLabel.js';

export interface WeeklyReportOptions {
  weekStart?: Date;
  quarter: QuarterLabel;
  repositories?: string[];
  jiraProjects?: string[];
}

export interface QuarterlyReportOptions {
  quarter: QuarterLabel;
  repositories?: string[];
  jiraProjects?: string[];
}

export interface IReportService {
  /**
   * Generate a comprehensive weekly metrics report in Markdown format
   * @param options - Report generation options
   * @returns Promise with Markdown report string
   */
  generateWeeklyReport(options: WeeklyReportOptions): Promise<string>;

  /**
   * Generate a quarterly summary with week-over-week trends in Markdown format
   * @param options - Report generation options
   * @returns Promise with Markdown report string
   */
  generateQuarterlyReport(options: QuarterlyReportOptions): Promise<string>;
}
