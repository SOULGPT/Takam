/**
 * Haversine Midpoint Utility
 * Calculates the geographic center between two sets of coordinates.
 */

export interface Coordinate {
  latitude: number;
  longitude: number;
}

export function calculateMidpoint(coord1: Coordinate, coord2: Coordinate): Coordinate {
  const toRad = (n: number) => (n * Math.PI) / 180;
  const toDeg = (n: number) => (n * 180) / Math.PI;

  const lat1 = toRad(coord1.latitude);
  const lng1 = toRad(coord1.longitude);
  const lat2 = toRad(coord2.latitude);
  const lng2 = toRad(coord2.longitude);

  const dLng = lng2 - lng1;

  const Bx = Math.cos(lat2) * Math.cos(dLng);
  const By = Math.cos(lat2) * Math.sin(dLng);

  const lat3 = Math.atan2(
    Math.sin(lat1) + Math.sin(lat2),
    Math.sqrt((Math.cos(lat1) + Bx) * (Math.cos(lat1) + Bx) + By * By)
  );
  const lng3 = lng1 + Math.atan2(By, Math.cos(lat1) + Bx);

  return {
    latitude: toDeg(lat3),
    longitude: toDeg(lng3),
  };
}
