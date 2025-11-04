/**
 * Weather Data Domain Model
 *
 * Represents weather information for a specific location and time.
 * Immutable domain entity.
 */

import { Coordinates } from '../value-objects/Coordinates.js';

export interface WeatherCondition {
  main: string;
  description: string;
  icon?: string;
}

export interface Temperature {
  current: number;
  feelsLike: number;
  min: number;
  max: number;
  unit: 'celsius' | 'fahrenheit' | 'kelvin';
}

export interface Wind {
  speed: number;
  direction: number; // degrees
  gust?: number;
}

export interface Atmosphere {
  pressure: number; // hPa
  humidity: number; // percentage
  visibility?: number; // meters
}

export class WeatherData {
  constructor(
    public readonly location: string,
    public readonly coordinates: Coordinates,
    public readonly timestamp: Date,
    public readonly condition: WeatherCondition,
    public readonly temperature: Temperature,
    public readonly wind: Wind,
    public readonly atmosphere: Atmosphere,
    public readonly clouds?: number, // percentage
    public readonly rain?: number, // mm
    public readonly snow?: number // mm
  ) {}

  static create(params: {
    location: string;
    coordinates: Coordinates;
    timestamp: Date;
    condition: WeatherCondition;
    temperature: Temperature;
    wind: Wind;
    atmosphere: Atmosphere;
    clouds?: number;
    rain?: number;
    snow?: number;
  }): WeatherData {
    return new WeatherData(
      params.location,
      params.coordinates,
      params.timestamp,
      params.condition,
      params.temperature,
      params.wind,
      params.atmosphere,
      params.clouds,
      params.rain,
      params.snow
    );
  }

  toJSON(): Record<string, unknown> {
    return {
      location: this.location,
      coordinates: this.coordinates.toJSON(),
      timestamp: this.timestamp.toISOString(),
      condition: this.condition,
      temperature: this.temperature,
      wind: this.wind,
      atmosphere: this.atmosphere,
      clouds: this.clouds,
      rain: this.rain,
      snow: this.snow,
    };
  }
}
