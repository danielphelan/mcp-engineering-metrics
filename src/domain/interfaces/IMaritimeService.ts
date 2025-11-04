/**
 * Maritime Service Interface
 *
 * Defines the contract for maritime vessel tracking services.
 * Follows Interface Segregation Principle - focused on vessel tracking operations.
 */

import { VesselData } from '../models/VesselData.js';
import { Coordinates } from '../value-objects/Coordinates.js';
import { BoundingBox } from '../value-objects/BoundingBox.js';

export interface IMaritimeService {
  /**
   * Get vessel information by MMSI (Maritime Mobile Service Identity)
   * @param mmsi Vessel's MMSI number
   * @returns Promise with vessel data
   */
  getVesselByMMSI(mmsi: string): Promise<VesselData | null>;

  /**
   * Get vessels within a geographic area
   * @param boundingBox Geographic bounding box
   * @returns Promise with array of vessels
   */
  getVesselsInArea(boundingBox: BoundingBox): Promise<VesselData[]>;

  /**
   * Get vessels near a specific coordinate
   * @param coordinates Center point
   * @param radiusKm Radius in kilometers
   * @returns Promise with array of vessels
   */
  getVesselsNearby(coordinates: Coordinates, radiusKm: number): Promise<VesselData[]>;
}
