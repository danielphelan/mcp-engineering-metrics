/**
 * Pull Request Metrics Domain Model
 *
 * Represents GitHub PR activity metrics for a given period.
 */

import { DateRange } from '../value-objects/DateRange.js';

export class PullRequestMetrics {
  constructor(
    public readonly created: number,
    public readonly merged: number,
    public readonly period: DateRange,
    public readonly repositories: string[]
  ) {}

  static create(params: {
    created: number;
    merged: number;
    period: DateRange;
    repositories: string[];
  }): PullRequestMetrics {
    return new PullRequestMetrics(
      params.created,
      params.merged,
      params.period,
      params.repositories
    );
  }

  getMergeRate(): number {
    if (this.created === 0) return 0;
    return (this.merged / this.created) * 100;
  }

  toJSON(): Record<string, unknown> {
    return {
      created: this.created,
      merged: this.merged,
      merge_rate: parseFloat(this.getMergeRate().toFixed(1)),
      period: this.period.toString(),
      repositories: this.repositories,
    };
  }
}
