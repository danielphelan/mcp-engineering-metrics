/**
 * Report Service Implementation
 *
 * Generates comprehensive weekly and quarterly reports.
 * Follows Single Responsibility Principle.
 */

import { IReportService, WeeklyReportOptions, QuarterlyReportOptions } from '../../domain/interfaces/IReportService.js';
import { IJiraService } from '../../domain/interfaces/IJiraService.js';
import { IGitHubService } from '../../domain/interfaces/IGitHubService.js';
import { ISecurityService } from '../../domain/interfaces/ISecurityService.js';
import { ILogger } from '../../domain/interfaces/ILogger.js';
import { DateRange } from '../../domain/value-objects/DateRange.js';
import { MetricTrend } from '../../domain/value-objects/MetricTrend.js';
import { StoryPointsMetrics } from '../../domain/models/StoryPointsMetrics.js';
import { PullRequestMetrics } from '../../domain/models/PullRequestMetrics.js';
import { DeploymentMetrics } from '../../domain/models/DeploymentMetrics.js';
import { BugMetrics } from '../../domain/models/BugMetrics.js';
import { SecurityMetrics } from '../../domain/models/SecurityMetrics.js';

interface WeeklyMetrics {
  storyPoints: StoryPointsMetrics;
  pullRequests: PullRequestMetrics;
  deployments: DeploymentMetrics;
  bugs: BugMetrics;
  security: SecurityMetrics;
}

export class ReportService implements IReportService {
  constructor(
    private readonly jiraService: IJiraService,
    private readonly githubService: IGitHubService,
    private readonly securityService: ISecurityService,
    private readonly logger: ILogger
  ) {}

  async generateWeeklyReport(options: WeeklyReportOptions): Promise<string> {
    try {
      this.logger.info('Generating weekly report', { options });

      const weekStart = options.weekStart || DateRange.currentWeek().startDate;
      const currentWeek = DateRange.forWeek(weekStart);
      const previousWeek = DateRange.previousWeek();

      // Fetch current week metrics
      const currentMetrics = await this.fetchWeeklyMetrics(currentWeek, options);

      // Fetch previous week metrics for comparison
      const previousMetrics = await this.fetchWeeklyMetrics(previousWeek, options);

      // Generate report
      return this.formatWeeklyReport(currentMetrics, previousMetrics, options);
    } catch (error) {
      this.logger.error('Failed to generate weekly report', error as Error);
      throw new Error(`Failed to generate weekly report: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async generateQuarterlyReport(options: QuarterlyReportOptions): Promise<string> {
    try {
      this.logger.info('Generating quarterly report', { options });

      const quarterStart = options.quarter.getStartDate();
      const quarterEnd = options.quarter.getEndDate();
      const now = new Date();

      // Calculate weeks in quarter up to now
      const weeks: DateRange[] = [];
      const currentMonday = new Date(quarterStart);

      // Find first Monday of quarter
      while (currentMonday.getDay() !== 1) {
        currentMonday.setDate(currentMonday.getDate() + 1);
      }

      // Generate list of weeks
      while (currentMonday <= now && currentMonday <= quarterEnd) {
        weeks.push(DateRange.forWeek(new Date(currentMonday)));
        currentMonday.setDate(currentMonday.getDate() + 7);
      }

      // Fetch metrics for each week
      const weeklyMetrics: WeeklyMetrics[] = [];
      for (const week of weeks) {
        const metrics = await this.fetchWeeklyMetrics(week, options);
        weeklyMetrics.push(metrics);
      }

      // Generate report
      return this.formatQuarterlyReport(weeklyMetrics, weeks, options);
    } catch (error) {
      this.logger.error('Failed to generate quarterly report', error as Error);
      throw new Error(`Failed to generate quarterly report: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async fetchWeeklyMetrics(week: DateRange, options: WeeklyReportOptions | QuarterlyReportOptions): Promise<WeeklyMetrics> {
    const quarter = options.quarter;

    const [storyPoints, pullRequests, deployments, bugs, security] = await Promise.all([
      this.jiraService.getStoryPoints(quarter, week),
      this.githubService.getPullRequestMetrics(week, options.repositories),
      this.jiraService.getDeployments(week, options.jiraProjects),
      this.jiraService.getBugMetrics(week, options.jiraProjects),
      this.securityService.getSecurityMetrics(options.repositories, 'open'),
    ]);

    return {
      storyPoints,
      pullRequests,
      deployments,
      bugs,
      security,
    };
  }

  private formatWeeklyReport(current: WeeklyMetrics, previous: WeeklyMetrics, options: WeeklyReportOptions): string {
    const period = current.storyPoints.period;
    const quarter = options.quarter.toString();

    // Calculate trends
    const storyPointsTrend = MetricTrend.create(previous.storyPoints.breakdown.done, current.storyPoints.breakdown.done);
    const prTrend = MetricTrend.create(previous.pullRequests.merged, current.pullRequests.merged);
    const deploymentTrend = MetricTrend.create(previous.deployments.totalDeployments, current.deployments.totalDeployments);
    const defectRateTrend = MetricTrend.create(previous.bugs.getDefectRate(), current.bugs.getDefectRate());
    const vulnTrend = MetricTrend.create(previous.security.criticalVulnerabilities, current.security.criticalVulnerabilities);

    const report = `# Weekly Engineering Metrics Report

**Week of**: ${this.formatDate(period.startDate)} - ${this.formatDate(period.endDate)}
**Quarter**: ${quarter}
**Generated**: ${new Date().toISOString()}

---

## 📊 Story Points

**Total Points (${quarter} label)**: ${current.storyPoints.totalPoints} points

| Status | Points | Percentage |
|--------|--------|------------|
| ✅ Done | ${current.storyPoints.breakdown.done} | ${((current.storyPoints.breakdown.done / current.storyPoints.totalPoints) * 100).toFixed(1)}% |
| 🔄 In Progress | ${current.storyPoints.breakdown.inProgress} | ${((current.storyPoints.breakdown.inProgress / current.storyPoints.totalPoints) * 100).toFixed(1)}% |
| 📋 To Do | ${current.storyPoints.breakdown.toDo} | ${((current.storyPoints.breakdown.toDo / current.storyPoints.totalPoints) * 100).toFixed(1)}% |

---

## 💻 Pull Requests

- **Created**: ${current.pullRequests.created} PRs
- **Merged**: ${current.pullRequests.merged} PRs
- **Merge Rate**: ${current.pullRequests.getMergeRate().toFixed(1)}%

---

## 🚀 Deployments

**Total Releases**: ${current.deployments.totalDeployments}

${current.deployments.releases.length > 0 ? `
| Release | Project | Date |
|---------|---------|------|
${current.deployments.releases.map(r => `| ${r.name} | ${r.project} | ${this.formatDate(r.date)} |`).join('\n')}
` : '_No deployments this week_'}

---

## 🐛 Quality Metrics

### Defect Rate
- **Bugs**: ${current.bugs.bugs}
- **Defect Sub-tasks**: ${current.bugs.defectSubtasks}
- **Total Defects**: ${current.bugs.getTotalDefects()}
- **Total Tickets Created**: ${current.bugs.totalTickets}
- **Defect Rate**: **${current.bugs.getDefectRate().toFixed(1)}%**

### Security (GHAS)
- 🔴 **Critical Vulnerabilities**: ${current.security.criticalVulnerabilities} open
- 🟠 **High Vulnerabilities**: ${current.security.highVulnerabilities} open
- 🔐 **Secrets Detected**: ${current.security.secretsDetected} open

---

## 📈 Week-over-Week Comparison

| Metric | This Week | Last Week | Change |
|--------|-----------|-----------|--------|
| Story Points (Done) | ${current.storyPoints.breakdown.done} | ${previous.storyPoints.breakdown.done} | ${storyPointsTrend.getFormattedPercent()} ${storyPointsTrend.getTrendArrow()} |
| PRs Merged | ${current.pullRequests.merged} | ${previous.pullRequests.merged} | ${prTrend.getFormattedPercent()} ${prTrend.getTrendArrow()} |
| Deployments | ${current.deployments.totalDeployments} | ${previous.deployments.totalDeployments} | ${deploymentTrend.getFormattedPercent()} ${deploymentTrend.getTrendArrow()} |
| Defect Rate | ${current.bugs.getDefectRate().toFixed(1)}% | ${previous.bugs.getDefectRate().toFixed(1)}% | ${defectRateTrend.getFormattedChange()} ${defectRateTrend.getTrendArrow()} |
| Critical Vulns | ${current.security.criticalVulnerabilities} | ${previous.security.criticalVulnerabilities} | ${vulnTrend.getFormattedPercent()} ${vulnTrend.getTrendArrow()} |

---

*Report generated by Engineering Metrics MCP Server*
`;

    return report;
  }

  private formatQuarterlyReport(weeklyMetrics: WeeklyMetrics[], weeks: DateRange[], options: QuarterlyReportOptions): string {
    const quarter = options.quarter;

    // Calculate totals
    const totalStoryPoints = weeklyMetrics.reduce((sum, m) => sum + m.storyPoints.breakdown.done, 0);
    const totalPRsMerged = weeklyMetrics.reduce((sum, m) => sum + m.pullRequests.merged, 0);
    const totalDeployments = weeklyMetrics.reduce((sum, m) => sum + m.deployments.totalDeployments, 0);
    const avgDefectRate = weeklyMetrics.reduce((sum, m) => sum + m.bugs.getDefectRate(), 0) / weeklyMetrics.length;

    const report = `# Quarterly Engineering Metrics Summary

**Quarter**: ${quarter.toString()} (${this.getQuarterMonths(quarter.quarter)})
**Label**: ${quarter.toString()}
**Generated**: ${new Date().toISOString()}

---

## 📊 Quarter-to-Date Totals

- **Total Story Points Completed**: ${totalStoryPoints} points
- **Total PRs Merged**: ${totalPRsMerged}
- **Total Deployments**: ${totalDeployments}
- **Average Defect Rate**: ${avgDefectRate.toFixed(1)}%

---

## 📈 Weekly Trends

### Story Points (Done)
| Week Starting | Points | Trend |
|---------------|--------|-------|
${this.formatTrendTable(weeklyMetrics, weeks, (m) => m.storyPoints.breakdown.done)}

### Pull Requests (Merged)
| Week Starting | Count | Trend |
|---------------|-------|-------|
${this.formatTrendTable(weeklyMetrics, weeks, (m) => m.pullRequests.merged)}

### Defect Rate
| Week Starting | Rate | Trend |
|---------------|------|-------|
${this.formatTrendTable(weeklyMetrics, weeks, (m) => m.bugs.getDefectRate(), true, '%')}

### Security Vulnerabilities (Critical + High)
| Week Starting | Count | Trend |
|---------------|-------|-------|
${this.formatTrendTable(weeklyMetrics, weeks, (m) => m.security.getTotalCriticalAndHigh())}

---

## 🎯 Key Insights

- **Velocity**: Average ${(totalStoryPoints / weeklyMetrics.length).toFixed(1)} story points completed per week
- **Throughput**: Average ${(totalPRsMerged / weeklyMetrics.length).toFixed(1)} PRs merged per week
- **Deployment Frequency**: ${(totalDeployments / weeklyMetrics.length).toFixed(1)} deployments per week
- **Quality**: Defect rate averaging ${avgDefectRate.toFixed(1)}%

---

*Report generated by Engineering Metrics MCP Server*
`;

    return report;
  }

  private formatTrendTable(metrics: WeeklyMetrics[], weeks: DateRange[], getValue: (m: WeeklyMetrics) => number, asPercentage: boolean = false, suffix: string = ''): string {
    const rows: string[] = [];

    for (let i = 0; i < metrics.length; i++) {
      const value = getValue(metrics[i]);
      const formattedValue = asPercentage ? value.toFixed(1) + suffix : value.toString();

      let trend = '—';
      if (i > 0) {
        const previousValue = getValue(metrics[i - 1]);
        const metricTrend = MetricTrend.create(previousValue, value);
        trend = `${metricTrend.getFormattedPercent()} ${metricTrend.getTrendArrow()}`;
      }

      rows.push(`| ${this.formatDate(weeks[i].startDate)} | ${formattedValue} | ${trend} |`);
    }

    return rows.join('\n');
  }

  private formatDate(date: Date): string {
    return date.toISOString().split('T')[0];
  }

  private getQuarterMonths(quarter: number): string {
    const months = [
      'January - March',
      'April - June',
      'July - September',
      'October - December',
    ];
    return months[quarter - 1];
  }
}
