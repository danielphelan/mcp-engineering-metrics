/**
 * Weather Service Interface
 *
 * Defines the contract for weather data retrieval services.
 * Follows Interface Segregation Principle - focused on weather operations only.
 */

import { WeatherData } from '../models/WeatherData.js';
import { Coordinates } from '../value-objects/Coordinates.js';

export interface IWeatherService {
  /**
   * Get current weather data for a specific location
   * @param location City name or coordinates
   * @returns Promise with weather data
   */
  getCurrentWeather(location: string | Coordinates): Promise<WeatherData>;

  /**
   * Get weather forecast for a specific location
   * @param location City name or coordinates
   * @param days Number of days to forecast
   * @returns Promise with array of weather data
   */
  getForecast(location: string | Coordinates, days?: number): Promise<WeatherData[]>;
}
