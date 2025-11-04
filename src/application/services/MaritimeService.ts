/**
 * Maritime Service Implementation
 *
 * Implements vessel tracking using AIS Hub API (or similar maritime data provider).
 * Follows Single Responsibility and Open/Closed Principles.
 */

import { IMaritimeService } from '../../domain/interfaces/IMaritimeService.js';
import { IHttpClient } from '../../domain/interfaces/IHttpClient.js';
import { ILogger } from '../../domain/interfaces/ILogger.js';
import {
  VesselData,
  VesselType,
  NavigationStatus,
  VesselIdentification,
  VesselPosition,
  VesselDimensions,
} from '../../domain/models/VesselData.js';
import { Coordinates } from '../../domain/value-objects/Coordinates.js';
import { BoundingBox } from '../../domain/value-objects/BoundingBox.js';

interface AISHubVesselResponse {
  MMSI: string;
  IMO?: string;
  NAME: string;
  CALLSIGN?: string;
  TYPE?: number;
  NAVSTAT?: number;
  LAT: number;
  LON: number;
  COURSE: number;
  HEADING: number;
  SPEED: number;
  TIME: string;
  A?: number; // Distance to bow
  B?: number; // Distance to stern
  C?: number; // Distance to port
  D?: number; // Distance to starboard
  DRAUGHT?: number;
  DESTINATION?: string;
  ETA?: string;
  COUNTRY?: string;
}

export class MaritimeService implements IMaritimeService {
  constructor(
    private readonly httpClient: IHttpClient,
    private readonly logger: ILogger,
    private readonly apiKey: string
  ) {}

  async getVesselByMMSI(mmsi: string): Promise<VesselData | null> {
    try {
      this.logger.info('Fetching vessel by MMSI', { mmsi });

      const params = {
        username: this.apiKey,
        format: '1',
        mmsi,
      };

      const response = await this.httpClient.get<AISHubVesselResponse[]>('', { params });

      if (!response.data || response.data.length === 0) {
        this.logger.warn('Vessel not found', { mmsi });
        return null;
      }

      return this.mapToVesselData(response.data[0]);
    } catch (error) {
      this.logger.error('Failed to fetch vessel by MMSI', error as Error, { mmsi });
      throw new Error(`Failed to fetch vessel data: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getVesselsInArea(boundingBox: BoundingBox): Promise<VesselData[]> {
    try {
      this.logger.info('Fetching vessels in area', { boundingBox: boundingBox.toJSON() });

      const params = {
        username: this.apiKey,
        format: '1',
        latmin: String(boundingBox.southEast.latitude),
        latmax: String(boundingBox.northWest.latitude),
        lonmin: String(boundingBox.northWest.longitude),
        lonmax: String(boundingBox.southEast.longitude),
      };

      const response = await this.httpClient.get<AISHubVesselResponse[]>('', { params });

      if (!response.data || response.data.length === 0) {
        this.logger.info('No vessels found in area');
        return [];
      }

      return response.data.map((vessel) => this.mapToVesselData(vessel));
    } catch (error) {
      this.logger.error('Failed to fetch vessels in area', error as Error);
      throw new Error(`Failed to fetch vessels in area: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getVesselsNearby(coordinates: Coordinates, radiusKm: number): Promise<VesselData[]> {
    try {
      this.logger.info('Fetching vessels nearby', {
        coordinates: coordinates.toJSON(),
        radiusKm,
      });

      // Convert radius to approximate lat/lon degrees
      // 1 degree ≈ 111km at equator
      const degreeOffset = radiusKm / 111;

      const boundingBox = BoundingBox.fromCoordinates(
        coordinates.latitude + degreeOffset,
        coordinates.longitude - degreeOffset,
        coordinates.latitude - degreeOffset,
        coordinates.longitude + degreeOffset
      );

      return await this.getVesselsInArea(boundingBox);
    } catch (error) {
      this.logger.error('Failed to fetch nearby vessels', error as Error);
      throw new Error(`Failed to fetch nearby vessels: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private mapToVesselData(data: AISHubVesselResponse): VesselData {
    const coordinates = Coordinates.create(data.LAT, data.LON);

    const identification: VesselIdentification = {
      mmsi: data.MMSI,
      imo: data.IMO,
      name: data.NAME,
      callSign: data.CALLSIGN,
    };

    const position: VesselPosition = {
      coordinates,
      course: data.COURSE,
      heading: data.HEADING,
      speed: data.SPEED,
      timestamp: new Date(data.TIME),
    };

    const type = this.mapVesselType(data.TYPE);
    const status = this.mapNavigationStatus(data.NAVSTAT);

    let dimensions: VesselDimensions | undefined;
    if (data.A !== undefined && data.B !== undefined && data.C !== undefined && data.D !== undefined) {
      dimensions = {
        length: data.A + data.B,
        width: data.C + data.D,
        draught: data.DRAUGHT,
      };
    }

    let eta: Date | undefined;
    if (data.ETA) {
      try {
        eta = new Date(data.ETA);
      } catch {
        // Invalid ETA, ignore
      }
    }

    return VesselData.create({
      identification,
      position,
      type,
      status,
      dimensions,
      destination: data.DESTINATION,
      eta,
      flag: data.COUNTRY,
    });
  }

  private mapVesselType(type?: number): VesselType {
    if (!type) return VesselType.UNKNOWN;

    // AIS ship type codes (simplified mapping)
    if (type >= 70 && type <= 79) return VesselType.CARGO;
    if (type >= 80 && type <= 89) return VesselType.TANKER;
    if (type >= 60 && type <= 69) return VesselType.PASSENGER;
    if (type === 30) return VesselType.FISHING;
    if (type >= 36 && type <= 37) return VesselType.SAILING;
    if (type >= 31 && type <= 32) return VesselType.TUG;
    if (type >= 35) return VesselType.MILITARY;
    if (type >= 40 && type <= 49) return VesselType.PLEASURE;

    return VesselType.OTHER;
  }

  private mapNavigationStatus(status?: number): NavigationStatus {
    if (!status) return NavigationStatus.UNKNOWN;

    // AIS navigation status codes
    const statusMap: Record<number, NavigationStatus> = {
      0: NavigationStatus.UNDER_WAY,
      1: NavigationStatus.AT_ANCHOR,
      2: NavigationStatus.NOT_UNDER_COMMAND,
      3: NavigationStatus.RESTRICTED_MANEUVERABILITY,
      4: NavigationStatus.CONSTRAINED_BY_DRAUGHT,
      5: NavigationStatus.MOORED,
      6: NavigationStatus.AGROUND,
      7: NavigationStatus.FISHING,
      8: NavigationStatus.SAILING,
    };

    return statusMap[status] || NavigationStatus.UNKNOWN;
  }
}
