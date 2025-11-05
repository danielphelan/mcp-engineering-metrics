/**
 * Security Service Interface
 *
 * Defines the contract for GitHub Advanced Security (GHAS) data retrieval.
 * Follows Interface Segregation Principle.
 */

import { SecurityMetrics } from '../models/SecurityMetrics.js';

export interface ISecurityService {
  /**
   * Get current security metrics from GitHub Advanced Security
   * @param repositories - Optional list of repository names to filter
   * @param state - Filter by alert state ('open' or 'resolved')
   * @returns Promise with security metrics
   */
  getSecurityMetrics(repositories?: string[], state?: 'open' | 'resolved'): Promise<SecurityMetrics>;
}
