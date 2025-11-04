/**
 * Vessel Data Domain Model
 *
 * Represents maritime vessel information from AIS (Automatic Identification System).
 * Immutable domain entity.
 */

import { Coordinates } from '../value-objects/Coordinates.js';

export enum VesselType {
  CARGO = 'cargo',
  TANKER = 'tanker',
  PASSENGER = 'passenger',
  FISHING = 'fishing',
  SAILING = 'sailing',
  PLEASURE = 'pleasure',
  TUG = 'tug',
  MILITARY = 'military',
  OTHER = 'other',
  UNKNOWN = 'unknown',
}

export enum NavigationStatus {
  UNDER_WAY = 'under_way',
  AT_ANCHOR = 'at_anchor',
  NOT_UNDER_COMMAND = 'not_under_command',
  RESTRICTED_MANEUVERABILITY = 'restricted_maneuverability',
  CONSTRAINED_BY_DRAUGHT = 'constrained_by_draught',
  MOORED = 'moored',
  AGROUND = 'aground',
  FISHING = 'fishing',
  SAILING = 'sailing',
  UNKNOWN = 'unknown',
}

export interface VesselPosition {
  coordinates: Coordinates;
  course: number; // degrees (0-359)
  heading: number; // degrees (0-359)
  speed: number; // knots
  timestamp: Date;
}

export interface VesselIdentification {
  mmsi: string; // Maritime Mobile Service Identity
  imo?: string; // International Maritime Organization number
  name: string;
  callSign?: string;
}

export interface VesselDimensions {
  length?: number; // meters
  width?: number; // meters
  draught?: number; // meters
}

export class VesselData {
  constructor(
    public readonly identification: VesselIdentification,
    public readonly position: VesselPosition,
    public readonly type: VesselType,
    public readonly status: NavigationStatus,
    public readonly dimensions?: VesselDimensions,
    public readonly destination?: string,
    public readonly eta?: Date,
    public readonly flag?: string // country code
  ) {}

  static create(params: {
    identification: VesselIdentification;
    position: VesselPosition;
    type: VesselType;
    status: NavigationStatus;
    dimensions?: VesselDimensions;
    destination?: string;
    eta?: Date;
    flag?: string;
  }): VesselData {
    return new VesselData(
      params.identification,
      params.position,
      params.type,
      params.status,
      params.dimensions,
      params.destination,
      params.eta,
      params.flag
    );
  }

  toJSON(): Record<string, unknown> {
    return {
      identification: this.identification,
      position: {
        ...this.position,
        coordinates: this.position.coordinates.toJSON(),
        timestamp: this.position.timestamp.toISOString(),
      },
      type: this.type,
      status: this.status,
      dimensions: this.dimensions,
      destination: this.destination,
      eta: this.eta?.toISOString(),
      flag: this.flag,
    };
  }

  /**
   * Check if vessel is moving
   */
  isMoving(): boolean {
    return this.position.speed > 0.5; // Moving if speed > 0.5 knots
  }

  /**
   * Check if vessel is stationary
   */
  isStationary(): boolean {
    return this.status === NavigationStatus.AT_ANCHOR ||
           this.status === NavigationStatus.MOORED ||
           this.position.speed <= 0.5;
  }
}
