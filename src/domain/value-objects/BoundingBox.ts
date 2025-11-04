/**
 * BoundingBox Value Object
 *
 * Immutable representation of a geographic bounding box.
 * Used for area-based queries.
 */

import { Coordinates } from './Coordinates.js';

export class BoundingBox {
  private constructor(
    public readonly northWest: Coordinates,
    public readonly southEast: Coordinates
  ) {
    this.validate();
  }

  static create(northWest: Coordinates, southEast: Coordinates): BoundingBox {
    return new BoundingBox(northWest, southEast);
  }

  static fromCoordinates(
    northLat: number,
    westLon: number,
    southLat: number,
    eastLon: number
  ): BoundingBox {
    return new BoundingBox(
      Coordinates.create(northLat, westLon),
      Coordinates.create(southLat, eastLon)
    );
  }

  private validate(): void {
    if (this.northWest.latitude <= this.southEast.latitude) {
      throw new Error('North latitude must be greater than south latitude');
    }
    // Note: We allow crossing the antimeridian
  }

  contains(point: Coordinates): boolean {
    const latInRange = point.latitude <= this.northWest.latitude &&
                      point.latitude >= this.southEast.latitude;

    // Handle antimeridian crossing
    let lonInRange: boolean;
    if (this.northWest.longitude <= this.southEast.longitude) {
      lonInRange = point.longitude >= this.northWest.longitude &&
                   point.longitude <= this.southEast.longitude;
    } else {
      lonInRange = point.longitude >= this.northWest.longitude ||
                   point.longitude <= this.southEast.longitude;
    }

    return latInRange && lonInRange;
  }

  toJSON(): { northWest: { latitude: number; longitude: number }; southEast: { latitude: number; longitude: number } } {
    return {
      northWest: this.northWest.toJSON(),
      southEast: this.southEast.toJSON(),
    };
  }
}
