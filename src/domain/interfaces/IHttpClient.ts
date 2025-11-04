/**
 * HTTP Client Interface
 *
 * Abstraction for HTTP operations.
 * Follows Dependency Inversion Principle - domain doesn't depend on concrete HTTP implementations.
 */

export interface HttpResponse<T = unknown> {
  data: T;
  status: number;
  statusText: string;
  headers: Record<string, string>;
}

export interface HttpRequestConfig {
  headers?: Record<string, string>;
  params?: Record<string, string | number | boolean>;
  timeout?: number;
}

export interface IHttpClient {
  /**
   * Perform GET request
   */
  get<T = unknown>(url: string, config?: HttpRequestConfig): Promise<HttpResponse<T>>;

  /**
   * Perform POST request
   */
  post<T = unknown>(url: string, data?: unknown, config?: HttpRequestConfig): Promise<HttpResponse<T>>;
}
