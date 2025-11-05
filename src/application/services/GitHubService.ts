/**
 * GitHub Service Implementation
 *
 * Implements GitHub data retrieval using Octokit (GitHub REST API).
 * Follows Single Responsibility and Open/Closed Principles.
 */

import { Octokit } from '@octokit/rest';
import { IGitHubService } from '../../domain/interfaces/IGitHubService.js';
import { ILogger } from '../../domain/interfaces/ILogger.js';
import { PullRequestMetrics } from '../../domain/models/PullRequestMetrics.js';
import { DateRange } from '../../domain/value-objects/DateRange.js';

export class GitHubService implements IGitHubService {
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

  async getPullRequestMetrics(period: DateRange, repositories?: string[]): Promise<PullRequestMetrics> {
    try {
      this.logger.info('Fetching PR metrics from GitHub', {
        period: period.toString(),
        repositories,
      });

      const repos = repositories || this.defaultRepos || [];

      if (repos.length === 0) {
        this.logger.warn('No repositories configured for PR metrics');
        return PullRequestMetrics.create({
          created: 0,
          merged: 0,
          period,
          repositories: [],
        });
      }

      let totalCreated = 0;
      let totalMerged = 0;

      // Fetch PR metrics for each repository
      for (const repo of repos) {
        try {
          // Query for PRs created in period
          const createdPRs = await this.octokit.pulls.list({
            owner: this.org,
            repo,
            state: 'all',
            sort: 'created',
            direction: 'desc',
            per_page: 100,
          });

          // Filter by creation date
          const createdInPeriod = createdPRs.data.filter((pr) => {
            const createdDate = new Date(pr.created_at);
            return period.contains(createdDate);
          });

          totalCreated += createdInPeriod.length;

          // Count merged PRs
          const mergedInPeriod = createdInPeriod.filter((pr) => {
            if (!pr.merged_at) return false;
            const mergedDate = new Date(pr.merged_at);
            return period.contains(mergedDate);
          });

          totalMerged += mergedInPeriod.length;

          this.logger.debug(`PR metrics for ${repo}`, {
            created: createdInPeriod.length,
            merged: mergedInPeriod.length,
          });
        } catch (error) {
          this.logger.warn(`Failed to fetch PRs for repository ${repo}`, {
            error: error instanceof Error ? error.message : 'Unknown',
          });
        }
      }

      return PullRequestMetrics.create({
        created: totalCreated,
        merged: totalMerged,
        period,
        repositories: repos,
      });
    } catch (error) {
      this.logger.error('Failed to fetch PR metrics from GitHub', error as Error);
      throw new Error(`Failed to fetch PR metrics: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}
