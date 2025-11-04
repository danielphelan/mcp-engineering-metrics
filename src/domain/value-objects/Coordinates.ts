/**
 * Coordinates Value Object
 *
 * Immutable representation of geographic coordinates.
 * Ensures valid latitude and longitude values.
 */

export class Coordinates {
  private constructor(
    public readonly latitude: number,
    public readonly longitude: number
  ) {
    this.validate();
  }

  static create(latitude: number, longitude: number): Coordinates {
    return new Coordinates(latitude, longitude);
  }

  private validate(): void {
    if (this.latitude < -90 || this.latitude > 90) {
      throw new Error(`Invalid latitude: ${this.latitude}. Must be between -90 and 90.`);
    }
    if (this.longitude < -180 || this.longitude > 180) {
      throw new Error(`Invalid longitude: ${this.longitude}. Must be between -180 and 180.`);
    }
  }

  equals(other: Coordinates): boolean {
    return this.latitude === other.latitude && this.longitude === other.longitude;
  }

  toString(): string {
    return `${this.latitude},${this.longitude}`;
  }

  toJSON(): { latitude: number; longitude: number } {
    return {
      latitude: this.latitude,
      longitude: this.longitude,
    };
  }
}
