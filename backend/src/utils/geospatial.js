const pointInRing = (point, ring) => {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = Number(ring[i].x ?? ring[i].lng ?? ring[i][0]);
    const yi = Number(ring[i].y ?? ring[i].lat ?? ring[i][1]);
    const xj = Number(ring[j].x ?? ring[j].lng ?? ring[j][0]);
    const yj = Number(ring[j].y ?? ring[j].lat ?? ring[j][1]);
    const intersects = ((yi > point.latitude) !== (yj > point.latitude))
      && (point.longitude < ((xj - xi) * (point.latitude - yi)) / ((yj - yi) || Number.EPSILON) + xi);
    if (intersects) inside = !inside;
  }
  return inside;
};

const zoneContains = (coordinates, point) => {
  const rings = coordinates?.type === 'Polygon'
    ? coordinates.coordinates
    : coordinates?.type === 'MultiPolygon'
      ? coordinates.coordinates.flat()
      : coordinates;
  if (!Array.isArray(rings) || !rings.length) return false;
  const normalizedRings = Array.isArray(rings[0]) ? rings : [rings];
  return pointInRing(point, normalizedRings[0])
    && !normalizedRings.slice(1).some((ring) => pointInRing(point, ring));
};

module.exports = { zoneContains };
