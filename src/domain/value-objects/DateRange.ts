/**
 * DateRange Value Object
 *
 * Immutable representation of a date range for metrics queries.
 */

export class DateRange {
  private constructor(
    public readonly startDate: Date,
    public readonly endDate: Date
  ) {
    this.validate();
  }

  static create(startDate: Date, endDate: Date): DateRange {
    return new DateRange(startDate, endDate);
  }

  static fromISOStrings(startISO: string, endISO: string): DateRange {
    return new DateRange(new Date(startISO), new Date(endISO));
  }

  /**
   * Create a date range for a specific week starting on Monday
   */
  static forWeek(weekStart: Date): DateRange {
    const start = new Date(weekStart);
    start.setHours(0, 0, 0, 0);

    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    end.setHours(23, 59, 59, 999);

    return new DateRange(start, end);
  }

  /**
   * Create a date range for the current week (Monday-Sunday)
   */
  static currentWeek(): DateRange {
    const now = new Date();
    const dayOfWeek = now.getDay();
    const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;

    const monday = new Date(now);
    monday.setDate(monday.getDate() - daysToMonday);
    monday.setHours(0, 0, 0, 0);

    return DateRange.forWeek(monday);
  }

  /**
   * Create a date range for the previous week
   */
  static previousWeek(): DateRange {
    const currentWeek = DateRange.currentWeek();
    const previousMonday = new Date(currentWeek.startDate);
    previousMonday.setDate(previousMonday.getDate() - 7);

    return DateRange.forWeek(previousMonday);
  }

  private validate(): void {
    if (this.startDate >= this.endDate) {
      throw new Error('Start date must be before end date');
    }
  }

  getDurationInDays(): number {
    const diff = this.endDate.getTime() - this.startDate.getTime();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  }

  contains(date: Date): boolean {
    return date >= this.startDate && date <= this.endDate;
  }

  equals(other: DateRange): boolean {
    return (
      this.startDate.getTime() === other.startDate.getTime() &&
      this.endDate.getTime() === other.endDate.getTime()
    );
  }

  toString(): string {
    return `${this.startDate.toISOString().split('T')[0]} to ${this.endDate.toISOString().split('T')[0]}`;
  }

  toJSON(): { startDate: string; endDate: string; period: string } {
    return {
      startDate: this.startDate.toISOString(),
      endDate: this.endDate.toISOString(),
      period: this.toString(),
    };
  }
}
