/**
 * Story Points Metrics Domain Model
 *
 * Represents story points data from JIRA with quarterly label.
 */

import { QuarterLabel } from '../value-objects/QuarterLabel.js';
import { DateRange } from '../value-objects/DateRange.js';

export interface StoryPointsBreakdown {
  done: number;
  inProgress: number;
  toDo: number;
}

export class StoryPointsMetrics {
  constructor(
    public readonly totalPoints: number,
    public readonly quarterLabel: QuarterLabel,
    public readonly period: DateRange,
    public readonly breakdown: StoryPointsBreakdown
  ) {}

  static create(params: {
    totalPoints: number;
    quarterLabel: QuarterLabel;
    period: DateRange;
    breakdown: StoryPointsBreakdown;
  }): StoryPointsMetrics {
    return new StoryPointsMetrics(
      params.totalPoints,
      params.quarterLabel,
      params.period,
      params.breakdown
    );
  }

  getCompletionPercentage(): number {
    if (this.totalPoints === 0) return 0;
    return (this.breakdown.done / this.totalPoints) * 100;
  }

  toJSON(): Record<string, unknown> {
    return {
      total_points: this.totalPoints,
      label: this.quarterLabel.toString(),
      period: this.period.toString(),
      breakdown: {
        done: this.breakdown.done,
        in_progress: this.breakdown.inProgress,
        to_do: this.breakdown.toDo,
      },
      completion_percentage: parseFloat(this.getCompletionPercentage().toFixed(1)),
    };
  }
}
