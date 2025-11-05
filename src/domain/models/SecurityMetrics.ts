/**
 * Security Metrics Domain Model
 *
 * Represents GitHub Advanced Security (GHAS) vulnerability data.
 */

export class SecurityMetrics {
  constructor(
    public readonly criticalVulnerabilities: number,
    public readonly highVulnerabilities: number,
    public readonly secretsDetected: number,
    public readonly timestamp: Date,
    public readonly repositories: string[]
  ) {}

  static create(params: {
    criticalVulnerabilities: number;
    highVulnerabilities: number;
    secretsDetected: number;
    timestamp: Date;
    repositories: string[];
  }): SecurityMetrics {
    return new SecurityMetrics(
      params.criticalVulnerabilities,
      params.highVulnerabilities,
      params.secretsDetected,
      params.timestamp,
      params.repositories
    );
  }

  getTotalCriticalAndHigh(): number {
    return this.criticalVulnerabilities + this.highVulnerabilities;
  }

  hasCriticalIssues(): boolean {
    return this.criticalVulnerabilities > 0 || this.secretsDetected > 0;
  }

  toJSON(): Record<string, unknown> {
    return {
      critical_vulnerabilities: this.criticalVulnerabilities,
      high_vulnerabilities: this.highVulnerabilities,
      secrets_detected: this.secretsDetected,
      total_critical_and_high: this.getTotalCriticalAndHigh(),
      timestamp: this.timestamp.toISOString(),
      repositories: this.repositories,
    };
  }
}
