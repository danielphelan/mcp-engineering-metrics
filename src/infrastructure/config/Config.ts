/**
 * Configuration Management
 *
 * Centralized configuration with environment variable loading.
 * Follows Single Responsibility Principle.
 */

import { config } from 'dotenv';
import { z } from 'zod';

// Load environment variables
config();

const ConfigSchema = z.object({
  // JIRA Configuration
  jira: z.object({
    url: z.string().url('JIRA URL must be a valid URL'),
    email: z.string().email('JIRA email must be valid'),
    apiToken: z.string().min(1, 'JIRA API token is required'),
    projects: z.string().optional(), // Comma-separated list
  }),

  // GitHub Configuration
  github: z.object({
    token: z.string().min(1, 'GitHub token is required'),
    org: z.string().min(1, 'GitHub organization is required'),
    repos: z.string().optional(), // Comma-separated list
  }),

  // Server Configuration
  server: z.object({
    nodeEnv: z.enum(['development', 'production', 'test']).default('development'),
    logLevel: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  }),
});

export type AppConfig = z.infer<typeof ConfigSchema>;

export class Config {
  private static instance: AppConfig;

  static load(): AppConfig {
    if (!this.instance) {
      try {
        this.instance = ConfigSchema.parse({
          jira: {
            url: process.env.JIRA_URL,
            email: process.env.JIRA_EMAIL,
            apiToken: process.env.JIRA_API_TOKEN,
            projects: process.env.JIRA_PROJECTS,
          },
          github: {
            token: process.env.GITHUB_TOKEN,
            org: process.env.GITHUB_ORG,
            repos: process.env.GITHUB_REPOS,
          },
          server: {
            nodeEnv: process.env.NODE_ENV,
            logLevel: process.env.LOG_LEVEL,
          },
        });
      } catch (error) {
        if (error instanceof z.ZodError) {
          console.error('Configuration validation failed:');
          error.errors.forEach((err) => {
            console.error(`  - ${err.path.join('.')}: ${err.message}`);
          });
          throw new Error('Invalid configuration. Please check your environment variables.');
        }
        throw error;
      }
    }
    return this.instance;
  }

  static get(): AppConfig {
    if (!this.instance) {
      throw new Error('Configuration not loaded. Call Config.load() first.');
    }
    return this.instance;
  }
}
