/**
 * JIRA Service Implementation
 *
 * Implements JIRA data retrieval using JIRA REST API.
 * Follows Single Responsibility and Open/Closed Principles.
 */

import { IJiraService } from '../../domain/interfaces/IJiraService.js';
import { IHttpClient } from '../../domain/interfaces/IHttpClient.js';
import { ILogger } from '../../domain/interfaces/ILogger.js';
import { StoryPointsMetrics, StoryPointsBreakdown } from '../../domain/models/StoryPointsMetrics.js';
import { DeploymentMetrics, Release } from '../../domain/models/DeploymentMetrics.js';
import { BugMetrics } from '../../domain/models/BugMetrics.js';
import { QuarterLabel } from '../../domain/value-objects/QuarterLabel.js';
import { DateRange } from '../../domain/value-objects/DateRange.js';

interface JiraIssue {
  key: string;
  fields: {
    summary: string;
    status: {
      name: string;
      statusCategory: { key: string };
    };
    customfield_10016?: number; // Story points custom field (may vary)
    issuetype: {
      name: string;
    };
    parent?: {
      fields: {
        customfield_10020?: string; // Defect classification
      };
    };
    created: string;
  };
}

interface JiraVersion {
  id: string;
  name: string;
  releaseDate?: string;
  released: boolean;
  projectId: number;
}

export class JiraService implements IJiraService {
  private readonly authHeader: string;

  constructor(
    private readonly httpClient: IHttpClient,
    private readonly logger: ILogger,
    private readonly jiraUrl: string,
    jiraEmail: string,
    jiraApiToken: string,
    private readonly defaultProjects?: string[]
  ) {
    // Create Basic Auth header
    const credentials = Buffer.from(`${jiraEmail}:${jiraApiToken}`).toString('base64');
    this.authHeader = `Basic ${credentials}`;
  }

  async getStoryPoints(quarterLabel: QuarterLabel, period?: DateRange): Promise<StoryPointsMetrics> {
    try {
      this.logger.info('Fetching story points from JIRA', {
        quarterLabel: quarterLabel.toString(),
        period: period?.toString(),
      });

      // Build JQL query
      let jql = `labels = "${quarterLabel.toString()}"`;

      if (period) {
        const startDate = period.startDate.toISOString().split('T')[0];
        const endDate = period.endDate.toISOString().split('T')[0];
        jql += ` AND created >= "${startDate}" AND created <= "${endDate}"`;
      }

      // Fetch issues
      const issues = await this.searchIssues(jql);

      // Calculate story points breakdown
      const breakdown: StoryPointsBreakdown = {
        done: 0,
        inProgress: 0,
        toDo: 0,
      };

      let totalPoints = 0;

      for (const issue of issues) {
        const points = issue.fields.customfield_10016 || 0;
        const statusCategory = issue.fields.status.statusCategory.key;

        totalPoints += points;

        if (statusCategory === 'done') {
          breakdown.done += points;
        } else if (statusCategory === 'indeterminate') {
          breakdown.inProgress += points;
        } else {
          breakdown.toDo += points;
        }
      }

      const effectivePeriod = period || DateRange.create(
        quarterLabel.getStartDate(),
        quarterLabel.getEndDate()
      );

      return StoryPointsMetrics.create({
        totalPoints,
        quarterLabel,
        period: effectivePeriod,
        breakdown,
      });
    } catch (error) {
      this.logger.error('Failed to fetch story points from JIRA', error as Error);
      throw new Error(`Failed to fetch story points: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getDeployments(period: DateRange, projects?: string[]): Promise<DeploymentMetrics> {
    try {
      this.logger.info('Fetching deployments from JIRA', {
        period: period.toString(),
        projects,
      });

      const projectKeys = projects || this.defaultProjects || [];
      const releases: Release[] = [];

      // Fetch versions/releases for each project
      for (const projectKey of projectKeys) {
        try {
          const response = await this.httpClient.get<JiraVersion[]>(
            `${this.jiraUrl}/rest/api/3/project/${projectKey}/versions`,
            {
              headers: {
                Authorization: this.authHeader,
                Accept: 'application/json',
              },
            }
          );

          // Filter released versions within the period
          for (const version of response.data) {
            if (version.released && version.releaseDate) {
              const releaseDate = new Date(version.releaseDate);

              if (period.contains(releaseDate)) {
                releases.push({
                  name: version.name,
                  project: projectKey,
                  date: releaseDate,
                });
              }
            }
          }
        } catch (error) {
          this.logger.warn(`Failed to fetch releases for project ${projectKey}`, {
            error: error instanceof Error ? error.message : 'Unknown',
          });
        }
      }

      // Sort releases by date
      releases.sort((a, b) => a.date.getTime() - b.date.getTime());

      return DeploymentMetrics.create({
        totalDeployments: releases.length,
        period,
        releases,
      });
    } catch (error) {
      this.logger.error('Failed to fetch deployments from JIRA', error as Error);
      throw new Error(`Failed to fetch deployments: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getBugMetrics(period: DateRange, projects?: string[]): Promise<BugMetrics> {
    try {
      this.logger.info('Fetching bug metrics from JIRA', {
        period: period.toString(),
        projects,
      });

      const startDate = period.startDate.toISOString().split('T')[0];
      const endDate = period.endDate.toISOString().split('T')[0];

      let projectFilter = '';
      if (projects && projects.length > 0) {
        projectFilter = ` AND project in (${projects.join(',')})`;
      }

      // Query for bugs
      const bugJQL = `issuetype = Bug AND created >= "${startDate}" AND created <= "${endDate}"${projectFilter}`;
      const bugs = await this.searchIssues(bugJQL);

      // Query for sub-tasks with defect classification
      // Note: This assumes a custom field for defect classification - adjust as needed
      const defectSubtaskJQL = `issuetype in subtaskIssueTypes() AND created >= "${startDate}" AND created <= "${endDate}"${projectFilter}`;
      const allSubtasks = await this.searchIssues(defectSubtaskJQL);

      // Filter sub-tasks that are defects (this logic may need customization)
      const defectSubtasks = allSubtasks.filter((issue) => {
        // Check if parent has defect classification or sub-task summary contains "defect" or "bug"
        const summary = issue.fields.summary.toLowerCase();
        return summary.includes('defect') || summary.includes('bug') || summary.includes('fix');
      });

      // Query for total tickets created in the period
      const totalJQL = `created >= "${startDate}" AND created <= "${endDate}"${projectFilter}`;
      const totalIssues = await this.searchIssues(totalJQL);

      return BugMetrics.create({
        bugs: bugs.length,
        defectSubtasks: defectSubtasks.length,
        totalTickets: totalIssues.length,
        period,
      });
    } catch (error) {
      this.logger.error('Failed to fetch bug metrics from JIRA', error as Error);
      throw new Error(`Failed to fetch bug metrics: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async searchIssues(jql: string, maxResults: number = 1000): Promise<JiraIssue[]> {
    const response = await this.httpClient.get<{ issues: JiraIssue[]; total: number }>(
      `${this.jiraUrl}/rest/api/3/search`,
      {
        headers: {
          Authorization: this.authHeader,
          Accept: 'application/json',
        },
        params: {
          jql,
          maxResults: String(maxResults),
          fields: 'summary,status,issuetype,customfield_10016,created,parent',
        },
      }
    );

    return response.data.issues;
  }
}
