/**
 * Bug Metrics Domain Model
 *
 * Represents defect rate calculation from JIRA.
 */

import { DateRange } from '../value-objects/DateRange.js';

export class BugMetrics {
  constructor(
    public readonly bugs: number,
    public readonly defectSubtasks: number,
    public readonly totalTickets: number,
    public readonly period: DateRange
  ) {}

  static create(params: {
    bugs: number;
    defectSubtasks: number;
    totalTickets: number;
    period: DateRange;
  }): BugMetrics {
    return new BugMetrics(
      params.bugs,
      params.defectSubtasks,
      params.totalTickets,
      params.period
    );
  }

  getTotalDefects(): number {
    return this.bugs + this.defectSubtasks;
  }

  getDefectRate(): number {
    if (this.totalTickets === 0) return 0;
    return (this.getTotalDefects() / this.totalTickets) * 100;
  }

  toJSON(): Record<string, unknown> {
    return {
      bugs: this.bugs,
      defect_subtasks: this.defectSubtasks,
      total_defects: this.getTotalDefects(),
      total_tickets: this.totalTickets,
      defect_rate: parseFloat(this.getDefectRate().toFixed(1)),
      period: this.period.toString(),
    };
  }
}
