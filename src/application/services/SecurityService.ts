/**
 * Security Service Implementation
 *
 * Implements GitHub Advanced Security (GHAS) data retrieval using Octokit.
 * Follows Single Responsibility and Open/Closed Principles.
 */

import { Octokit } from '@octokit/rest';
import { ISecurityService } from '../../domain/interfaces/ISecurityService.js';
import { ILogger } from '../../domain/interfaces/ILogger.js';
import { SecurityMetrics } from '../../domain/models/SecurityMetrics.js';

export class SecurityService implements ISecurityService {
  private readonly octokit: Octokit;

  constructor(
    private readonly logger: ILogger,
    private readonly org: string,
    githubToken: string,
    private readonly defaultRepos?: string[]
  ) {
    this.octokit = new Octokit({
      auth: githubToken,
    });
  }

  async getSecurityMetrics(repositories?: string[], state: 'open' | 'resolved' = 'open'): Promise<SecurityMetrics> {
    try {
      this.logger.info('Fetching security metrics from GHAS', {
        repositories,
        state,
      });

      const repos = repositories || this.defaultRepos || [];

      if (repos.length === 0) {
        this.logger.warn('No repositories configured for security metrics');
        return SecurityMetrics.create({
          criticalVulnerabilities: 0,
          highVulnerabilities: 0,
          secretsDetected: 0,
          timestamp: new Date(),
          repositories: [],
        });
      }

      let criticalCount = 0;
      let highCount = 0;
      let secretsCount = 0;

      // Fetch security alerts for each repository
      for (const repo of repos) {
        try {
          // Fetch Dependabot alerts (vulnerabilities)
          const alerts = await this.octokit.dependabot.listAlertsForRepo({
            owner: this.org,
            repo,
            state,
            per_page: 100,
          });

          // Count by severity
          for (const alert of alerts.data) {
            if (alert.security_advisory?.severity === 'critical') {
              criticalCount++;
            } else if (alert.security_advisory?.severity === 'high') {
              highCount++;
            }
          }

          // Fetch secret scanning alerts
          try {
            const secrets = await this.octokit.secretScanning.listAlertsForRepo({
              owner: this.org,
              repo,
              state,
              per_page: 100,
            });

            secretsCount += secrets.data.length;
          } catch (_secretError) {
            // Secret scanning may not be enabled for all repos
            this.logger.debug(`Secret scanning not available for ${repo}`);
          }

          this.logger.debug(`Security metrics for ${repo}`, {
            critical: criticalCount,
            high: highCount,
            secrets: secretsCount,
          });
        } catch (error) {
          this.logger.warn(`Failed to fetch security alerts for repository ${repo}`, {
            error: error instanceof Error ? error.message : 'Unknown',
          });
        }
      }

      return SecurityMetrics.create({
        criticalVulnerabilities: criticalCount,
        highVulnerabilities: highCount,
        secretsDetected: secretsCount,
        timestamp: new Date(),
        repositories: repos,
      });
    } catch (error) {
      this.logger.error('Failed to fetch security metrics from GHAS', error as Error);
      throw new Error(`Failed to fetch security metrics: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}
