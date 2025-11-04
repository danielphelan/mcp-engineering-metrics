/**
 * OpenWeather Service Implementation
 *
 * Implements weather data retrieval from OpenWeather API.
 * Follows Single Responsibility and Open/Closed Principles.
 */

import { IWeatherService } from '../../domain/interfaces/IWeatherService.js';
import { IHttpClient } from '../../domain/interfaces/IHttpClient.js';
import { ILogger } from '../../domain/interfaces/ILogger.js';
import { WeatherData, Temperature, WeatherCondition, Wind, Atmosphere } from '../../domain/models/WeatherData.js';
import { Coordinates } from '../../domain/value-objects/Coordinates.js';

interface OpenWeatherResponse {
  coord: {
    lon: number;
    lat: number;
  };
  weather: Array<{
    main: string;
    description: string;
    icon: string;
  }>;
  main: {
    temp: number;
    feels_like: number;
    temp_min: number;
    temp_max: number;
    pressure: number;
    humidity: number;
  };
  visibility: number;
  wind: {
    speed: number;
    deg: number;
    gust?: number;
  };
  clouds: {
    all: number;
  };
  rain?: {
    '1h'?: number;
    '3h'?: number;
  };
  snow?: {
    '1h'?: number;
    '3h'?: number;
  };
  dt: number;
  name: string;
}

interface OpenWeatherForecastResponse {
  list: Array<OpenWeatherResponse & { dt_txt: string }>;
}

export class OpenWeatherService implements IWeatherService {
  constructor(
    private readonly httpClient: IHttpClient,
    private readonly logger: ILogger,
    private readonly apiKey: string
  ) {}

  async getCurrentWeather(location: string | Coordinates): Promise<WeatherData> {
    try {
      this.logger.info('Fetching current weather', { location: location.toString() });

      const params = this.buildLocationParams(location);
      params.appid = this.apiKey;
      params.units = 'metric';

      const response = await this.httpClient.get<OpenWeatherResponse>('/weather', { params });

      return this.mapToWeatherData(response.data);
    } catch (error) {
      this.logger.error('Failed to fetch current weather', error as Error, { location: location.toString() });
      throw new Error(`Failed to fetch weather data: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getForecast(location: string | Coordinates, days: number = 5): Promise<WeatherData[]> {
    try {
      this.logger.info('Fetching weather forecast', { location: location.toString(), days });

      const params = this.buildLocationParams(location);
      params.appid = this.apiKey;
      params.units = 'metric';
      params.cnt = String(days * 8); // 8 forecasts per day (3-hour intervals)

      const response = await this.httpClient.get<OpenWeatherForecastResponse>('/forecast', { params });

      return response.data.list.map((item) => this.mapToWeatherData(item));
    } catch (error) {
      this.logger.error('Failed to fetch weather forecast', error as Error, { location: location.toString() });
      throw new Error(`Failed to fetch forecast data: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private buildLocationParams(location: string | Coordinates): Record<string, string> {
    if (typeof location === 'string') {
      return { q: location };
    } else {
      return {
        lat: String(location.latitude),
        lon: String(location.longitude),
      };
    }
  }

  private mapToWeatherData(data: OpenWeatherResponse): WeatherData {
    const coordinates = Coordinates.create(data.coord.lat, data.coord.lon);

    const condition: WeatherCondition = {
      main: data.weather[0].main,
      description: data.weather[0].description,
      icon: data.weather[0].icon,
    };

    const temperature: Temperature = {
      current: data.main.temp,
      feelsLike: data.main.feels_like,
      min: data.main.temp_min,
      max: data.main.temp_max,
      unit: 'celsius',
    };

    const wind: Wind = {
      speed: data.wind.speed,
      direction: data.wind.deg,
      gust: data.wind.gust,
    };

    const atmosphere: Atmosphere = {
      pressure: data.main.pressure,
      humidity: data.main.humidity,
      visibility: data.visibility,
    };

    return WeatherData.create({
      location: data.name,
      coordinates,
      timestamp: new Date(data.dt * 1000),
      condition,
      temperature,
      wind,
      atmosphere,
      clouds: data.clouds.all,
      rain: data.rain?.['1h'] || data.rain?.['3h'],
      snow: data.snow?.['1h'] || data.snow?.['3h'],
    });
  }
}
