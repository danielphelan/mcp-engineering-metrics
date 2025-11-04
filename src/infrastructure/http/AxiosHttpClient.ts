/**
 * Axios HTTP Client Implementation
 *
 * Concrete implementation of IHttpClient using Axios.
 * Follows Dependency Inversion Principle.
 */

import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import { IHttpClient, HttpResponse, HttpRequestConfig } from '../../domain/interfaces/IHttpClient.js';
import { ILogger } from '../../domain/interfaces/ILogger.js';

export class AxiosHttpClient implements IHttpClient {
  private axiosInstance: AxiosInstance;

  constructor(
    private readonly logger: ILogger,
    baseURL?: string,
    timeout: number = 10000
  ) {
    this.axiosInstance = axios.create({
      baseURL,
      timeout,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.setupInterceptors();
  }

  private setupInterceptors(): void {
    // Request interceptor
    this.axiosInstance.interceptors.request.use(
      (config) => {
        this.logger.debug('HTTP Request', {
          method: config.method?.toUpperCase(),
          url: config.url,
          params: config.params,
        });
        return config;
      },
      (error) => {
        this.logger.error('HTTP Request Error', error);
        return Promise.reject(error);
      }
    );

    // Response interceptor
    this.axiosInstance.interceptors.response.use(
      (response) => {
        this.logger.debug('HTTP Response', {
          status: response.status,
          url: response.config.url,
        });
        return response;
      },
      (error) => {
        this.logger.error('HTTP Response Error', error, {
          status: error.response?.status,
          url: error.config?.url,
        });
        return Promise.reject(error);
      }
    );
  }

  private mapConfig(config?: HttpRequestConfig): AxiosRequestConfig {
    return {
      headers: config?.headers,
      params: config?.params,
      timeout: config?.timeout,
    };
  }

  private mapResponse<T>(response: AxiosResponse<T>): HttpResponse<T> {
    return {
      data: response.data,
      status: response.status,
      statusText: response.statusText,
      headers: response.headers as Record<string, string>,
    };
  }

  async get<T = unknown>(url: string, config?: HttpRequestConfig): Promise<HttpResponse<T>> {
    const response = await this.axiosInstance.get<T>(url, this.mapConfig(config));
    return this.mapResponse(response);
  }

  async post<T = unknown>(url: string, data?: unknown, config?: HttpRequestConfig): Promise<HttpResponse<T>> {
    const response = await this.axiosInstance.post<T>(url, data, this.mapConfig(config));
    return this.mapResponse(response);
  }
}
