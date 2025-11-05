/**
 * MetricTrend Value Object
 *
 * Represents the trend between two metric values.
 * Used for week-over-week or period-over-period comparisons.
 */

export enum TrendDirection {
  UP = 'up',
  DOWN = 'down',
  FLAT = 'flat',
}

export class MetricTrend {
  private constructor(
    public readonly previous: number,
    public readonly current: number,
    public readonly change: number,
    public readonly changePercent: number,
    public readonly direction: TrendDirection
  ) {}

  static create(previous: number, current: number): MetricTrend {
    const change = current - previous;
    let changePercent = 0;

    if (previous !== 0) {
      changePercent = (change / previous) * 100;
    } else if (current !== 0) {
      changePercent = 100; // 100% increase from 0
    }

    let direction = TrendDirection.FLAT;
    if (change > 0) {
      direction = TrendDirection.UP;
    } else if (change < 0) {
      direction = TrendDirection.DOWN;
    }

    return new MetricTrend(previous, current, change, changePercent, direction);
  }

  /**
   * Get formatted change string with sign
   */
  getFormattedChange(): string {
    const sign = this.change >= 0 ? '+' : '';
    return `${sign}${this.change}`;
  }

  /**
   * Get formatted percentage change with sign
   */
  getFormattedPercent(): string {
    const sign = this.changePercent >= 0 ? '+' : '';
    return `${sign}${this.changePercent.toFixed(1)}%`;
  }

  /**
   * Get trend emoji/arrow
   */
  getTrendArrow(): string {
    switch (this.direction) {
      case TrendDirection.UP:
        return '↗️';
      case TrendDirection.DOWN:
        return '↘️';
      case TrendDirection.FLAT:
        return '→';
    }
  }

  /**
   * Check if the trend is improving (context-dependent)
   * @param lowerIsBetter - For metrics like defect rate or vulnerabilities, lower is better
   */
  isImproving(lowerIsBetter: boolean = false): boolean {
    if (this.direction === TrendDirection.FLAT) return false;

    if (lowerIsBetter) {
      return this.direction === TrendDirection.DOWN;
    } else {
      return this.direction === TrendDirection.UP;
    }
  }

  toJSON(): {
    previous: number;
    current: number;
    change: number;
    changePercent: number;
    direction: TrendDirection;
    arrow: string;
  } {
    return {
      previous: this.previous,
      current: this.current,
      change: this.change,
      changePercent: parseFloat(this.changePercent.toFixed(1)),
      direction: this.direction,
      arrow: this.getTrendArrow(),
    };
  }
}
