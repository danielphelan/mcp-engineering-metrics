/**
 * Deployment Metrics Domain Model
 *
 * Represents deployment/release frequency from JIRA.
 */

import { DateRange } from '../value-objects/DateRange.js';

export interface Release {
  name: string;
  project: string;
  date: Date;
}

export class DeploymentMetrics {
  constructor(
    public readonly totalDeployments: number,
    public readonly period: DateRange,
    public readonly releases: Release[]
  ) {}

  static create(params: {
    totalDeployments: number;
    period: DateRange;
    releases: Release[];
  }): DeploymentMetrics {
    return new DeploymentMetrics(
      params.totalDeployments,
      params.period,
      params.releases
    );
  }

  getDeploymentFrequency(): number {
    const days = this.period.getDurationInDays();
    if (days === 0) return 0;
    return this.totalDeployments / (days / 7); // Per week
  }

  toJSON(): Record<string, unknown> {
    return {
      total_deployments: this.totalDeployments,
      period: this.period.toString(),
      releases: this.releases.map((r) => ({
        name: r.name,
        project: r.project,
        date: r.date.toISOString().split('T')[0],
      })),
      frequency_per_week: parseFloat(this.getDeploymentFrequency().toFixed(1)),
    };
  }
}
