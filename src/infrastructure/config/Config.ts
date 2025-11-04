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
  // OpenWeather Configuration
  openweather: z.object({
    apiKey: z.string().min(1, 'OpenWeather API key is required'),
    baseUrl: z.string().url().default('https://api.openweathermap.org/data/2.5'),
  }),

  // Maritime Configuration
  maritime: z.object({
    apiKey: z.string().min(1, 'Maritime API key is required'),
    baseUrl: z.string().url().default('https://www.aishub.net/api'),
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
          openweather: {
            apiKey: process.env.OPENWEATHER_API_KEY,
            baseUrl: process.env.OPENWEATHER_BASE_URL,
          },
          maritime: {
            apiKey: process.env.MARITIME_API_KEY,
            baseUrl: process.env.MARITIME_BASE_URL,
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
