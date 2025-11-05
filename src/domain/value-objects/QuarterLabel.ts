/**
 * QuarterLabel Value Object
 *
 * Immutable representation of a quarterly label (e.g., "2025-Q1-PI").
 * Used for tracking story points and other quarterly metrics.
 */

export class QuarterLabel {
  private constructor(
    public readonly year: number,
    public readonly quarter: number,
    public readonly label: string
  ) {
    this.validate();
  }

  static create(year: number, quarter: number): QuarterLabel {
    if (quarter < 1 || quarter > 4) {
      throw new Error('Quarter must be between 1 and 4');
    }
    const label = `${year}-Q${quarter}-PI`;
    return new QuarterLabel(year, quarter, label);
  }

  static fromString(quarterString: string): QuarterLabel {
    // Parse format: "2025-Q1" or "2025-Q1-PI"
    const match = quarterString.match(/^(\d{4})-Q([1-4])(-PI)?$/);
    if (!match) {
      throw new Error(`Invalid quarter format: ${quarterString}. Expected format: YYYY-QX or YYYY-QX-PI`);
    }

    const year = parseInt(match[1], 10);
    const quarter = parseInt(match[2], 10);

    return QuarterLabel.create(year, quarter);
  }

  static current(): QuarterLabel {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth(); // 0-11
    const quarter = Math.floor(month / 3) + 1;

    return QuarterLabel.create(year, quarter);
  }

  static previous(): QuarterLabel {
    const current = QuarterLabel.current();
    if (current.quarter === 1) {
      return QuarterLabel.create(current.year - 1, 4);
    }
    return QuarterLabel.create(current.year, current.quarter - 1);
  }

  private validate(): void {
    if (this.year < 2020 || this.year > 2100) {
      throw new Error(`Invalid year: ${this.year}`);
    }
    if (this.quarter < 1 || this.quarter > 4) {
      throw new Error(`Invalid quarter: ${this.quarter}`);
    }
  }

  /**
   * Get the start date of this quarter
   */
  getStartDate(): Date {
    const month = (this.quarter - 1) * 3;
    return new Date(this.year, month, 1, 0, 0, 0, 0);
  }

  /**
   * Get the end date of this quarter
   */
  getEndDate(): Date {
    const month = this.quarter * 3;
    const lastDay = new Date(this.year, month, 0).getDate();
    return new Date(this.year, month - 1, lastDay, 23, 59, 59, 999);
  }

  equals(other: QuarterLabel): boolean {
    return this.label === other.label;
  }

  toString(): string {
    return this.label;
  }

  toJSON(): { year: number; quarter: number; label: string } {
    return {
      year: this.year,
      quarter: this.quarter,
      label: this.label,
    };
  }
}
