/**
 * Map Utilities Module
 *
 * Provides utility functions for:
 * - Color mapping (speed, PWM)
 * - Geometry calculations
 * - Data interpolation
 */

import { DEBUG } from './debug-config.mjs';

/**
 * Speed-to-color mapping function using absolute km/h thresholds
 * @param {number} speed - Speed in km/h
 * @param {number} maxSpeed - Maximum speed (unused, kept for API compatibility)
 * @returns {string} RGB color string
 */
export function getSpeedColor(speed, maxSpeed) {
    if (!speed || speed <= 0) return '#808080'; // Gray for no speed data

    // Define absolute speed thresholds in km/h (8-range system)
    if (speed <= 30) {
        // Green to Yellow (0-30 km/h)
        const t = speed / 30;
        const r = Math.round(0 + (255 * t));
        const g = 255;
        const b = 0;
        return `rgb(${r}, ${g}, ${b})`;
    } else if (speed <= 40) {
        // Yellow to Orange (30-40 km/h)
        const t = (speed - 30) / 10;
        const r = 255;
        const g = Math.round(255 - (90 * t)); // Yellow (255) to Orange (165)
        const b = 0;
        return `rgb(${r}, ${g}, ${b})`;
    } else if (speed <= 50) {
        // Orange to Red-Orange (40-50 km/h)
        const t = (speed - 40) / 10;
        const r = 255;
        const g = Math.round(165 - (96 * t)); // Orange (165) to Red-Orange (69)
        const b = 0;
        return `rgb(${r}, ${g}, ${b})`;
    } else if (speed <= 70) {
        // Red-Orange to Pure Red (50-70 km/h)
        const t = (speed - 50) / 20;
        const r = 255;
        const g = Math.round(69 - (69 * t)); // Red-Orange (69) to Pure Red (0)
        const b = 0;
        return `rgb(${r}, ${g}, ${b})`;
    } else if (speed <= 80) {
        // Red to Grey (70-80 km/h)
        const t = (speed - 70) / 10;
        const r = Math.round(255 - (127 * t)); // Red (255) to Grey (128)
        const g = Math.round(0 + (128 * t));   // Red (0) to Grey (128)
        const b = Math.round(0 + (128 * t));   // Red (0) to Grey (128)
        return `rgb(${r}, ${g}, ${b})`;
    } else if (speed <= 100) {
        // Grey to Dark Grey (80-100 km/h)
        const t = (speed - 80) / 20;
        const r = Math.round(128 - (64 * t)); // Grey (128) to Dark Grey (64)
        const g = Math.round(128 - (64 * t)); // Grey (128) to Dark Grey (64)
        const b = Math.round(128 - (64 * t)); // Grey (128) to Dark Grey (64)
        return `rgb(${r}, ${g}, ${b})`;
    } else if (speed <= 110) {
        // Dark Grey to Black (100-110 km/h)
        const t = (speed - 100) / 10;
        const r = Math.round(64 - (64 * t)); // Dark Grey (64) to Black (0)
        const g = Math.round(64 - (64 * t)); // Dark Grey (64) to Black (0)
        const b = Math.round(64 - (64 * t)); // Dark Grey (64) to Black (0)
        return `rgb(${r}, ${g}, ${b})`;
    } else {
        // Pure Black (110+ km/h)
        return `rgb(0, 0, 0)`;
    }
}

/**
 * PWM-to-color mapping function using percentage thresholds
 * @param {number} pwm - PWM percentage (0-100)
 * @returns {string} RGB color string
 */
export function getPWMColor(pwm, isFlipped = false) {
    if (pwm === null || pwm === undefined) {
        if (DEBUG.MAP_UTILS) console.log('[MAP UTILS] PWM null/undefined, using gray');
        return '#808080'; // Gray for no PWM data
    }

    // Clamp the value between 0 and 100
    let value = Math.max(0, Math.min(100, pwm));

    // Invert value if in flipped mode (Mode 2)
    // Mode 1 (Standard): Low PWM = safe (yellow), High PWM = danger (black)
    // Mode 2 (Inverted): High PWM = safe (yellow), Low PWM = danger (black)
    if (isFlipped) {
        value = 100 - value;
    }

    if (value <= 5) {
        // Black for 0-5% PWM (critical)
        return 'rgb(0, 0, 0)';
    } else if (value <= 10) {
        // Black to Dark Grey (5-10%)
        const t = (value - 5) / 5;
        const r = Math.round(0 + (64 * t)); // Black (0) to Dark Grey (64)
        const g = Math.round(0 + (64 * t)); // Black (0) to Dark Grey (64)
        const b = Math.round(0 + (64 * t)); // Black (0) to Dark Grey (64)
        return `rgb(${r}, ${g}, ${b})`;
    } else if (value <= 20) {
        // Dark Grey to Yellow (10-20%)
        const t = (value - 10) / 10;
        const r = Math.round(64 + (191 * t)); // Dark Grey (64) to Yellow (255)
        const g = Math.round(64 + (151 * t)); // Dark Grey (64) to Yellow (215)
        const b = Math.round(64 - (64 * t));  // Dark Grey (64) to Yellow (0)
        return `rgb(${r}, ${g}, ${b})`;
    } else {
        // Yellow for 20-100% PWM (good safety)
        return '#FFD700'; // Gold/Yellow
    }
}

/**
 * Elevation-to-color mapping function using normalized values
 * Maps elevation from min to max across a blue gradient
 * @param {number} elevation - Elevation in meters
 * @param {number} minElevation - Minimum elevation in dataset
 * @param {number} maxElevation - Maximum elevation in dataset
 * @returns {string} RGB color string
 */
export function getElevationColor(elevation, minElevation, maxElevation) {
    if (elevation === null || elevation === undefined) {
        return '#808080'; // Gray for no elevation data
    }

    // Normalize elevation to 0-1 range
    const range = maxElevation - minElevation;
    if (range === 0) {
        return 'rgb(100, 149, 237)'; // Cornflower blue for flat terrain
    }

    const normalized = (elevation - minElevation) / range;

    // Light blue (low) to dark blue (high)
    // Light blue: rgb(173, 216, 230) - #ADD8E6
    // Dark blue: rgb(0, 0, 139) - #00008B

    const r = Math.round(173 - (173 * normalized)); // 173 to 0
    const g = Math.round(216 - (216 * normalized)); // 216 to 0
    const b = Math.round(230 - (91 * normalized));  // 230 to 139

    return `rgb(${r}, ${g}, ${b})`;
}

/**
 * Battery-to-color mapping function (0-100%)
 * Maps battery percentage across a green gradient
 * @param {number} battery - Battery percentage (0-100)
 * @returns {string} RGB color string
 */
export function getBatteryColor(battery) {
    if (battery === null || battery === undefined) {
        return '#808080'; // Gray for no battery data
    }

    // Clamp between 0 and 100
    const value = Math.max(0, Math.min(100, battery));

    // Normalize to 0-1 range (0% = 0, 100% = 1)
    const normalized = value / 100;

    // Very light green/white (low) to green (high)
    // 0% battery: rgb(240, 255, 240) - Very light green/white-ish
    // 100% battery: rgb(34, 139, 34) - Forest green

    const r = Math.round(240 - (206 * normalized)); // 240 to 34
    const g = Math.round(255 - (116 * normalized)); // 255 to 139
    const b = Math.round(240 - (206 * normalized)); // 240 to 34

    return `rgb(${r}, ${g}, ${b})`;
}

/**
 * Convert hex color to rgba with opacity
 * @param {string} hex - Hex color code
 * @param {number} opacity - Opacity value (0-1)
 * @returns {string} RGBA color string
 */
export function hexToRgba(hex, opacity) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

/**
 * Return the closest point on segment AB to point P (all LatLng).
 * Uses planar approximation on map CRS.
 * @param {object} p - Point LatLng
 * @param {object} a - Segment start LatLng
 * @param {object} b - Segment end LatLng
 * @param {object} map - Leaflet map instance
 * @returns {object} Closest point LatLng
 */
export function closestPointOnSegment(p, a, b, map) {
    const pPt = map.latLngToLayerPoint(p);
    const aPt = map.latLngToLayerPoint(a);
    const bPt = map.latLngToLayerPoint(b);
    const ab = bPt.subtract(aPt);
    const ap = pPt.subtract(aPt);
    const abLen2 = (ab.x * ab.x) + (ab.y * ab.y);
    let t = 0;
    if (abLen2 > 0) {
        const apDotAb = (ap.x * ab.x) + (ap.y * ab.y);
        t = apDotAb / abLen2;
    }
    t = Math.max(0, Math.min(1, t));
    const proj = new L.Point(aPt.x + ab.x * t, aPt.y + ab.y * t);
    return map.layerPointToLatLng(proj);
}

/**
 * Calculate position on line segment (0.0 to 1.0)
 * @param {object} point - Point LatLng
 * @param {object} lineStart - Line start LatLng
 * @param {object} lineEnd - Line end LatLng
 * @param {object} map - Leaflet map instance
 * @returns {number} Position on line segment (0-1)
 */
export function calculatePositionOnLineSegment(point, lineStart, lineEnd, map) {
    const startPt = map.latLngToLayerPoint(lineStart);
    const endPt = map.latLngToLayerPoint(lineEnd);
    const pointPt = map.latLngToLayerPoint(point);

    const lineVec = endPt.subtract(startPt);
    const pointVec = pointPt.subtract(startPt);

    if (lineVec.x === 0 && lineVec.y === 0) return 0;

    const lineLength2 = (lineVec.x * lineVec.x) + (lineVec.y * lineVec.y);
    const projection = ((pointVec.x * lineVec.x) + (pointVec.y * lineVec.y)) / lineLength2;

    return Math.max(0, Math.min(1, projection));
}

/**
 * Interpolate data at a specific position within a segment
 * @param {object} segment - Segment object with segmentPoints
 * @param {number} position - Position within segment (0-1)
 * @returns {object} Interpolated GPS point data
 */
export function interpolateDataAtSegmentPosition(segment, position) {
    const segmentPoints = segment.segmentPoints;
    if (!segmentPoints || segmentPoints.length === 0) return null;

    // If position is 0, return first point; if 1, return last point
    if (position <= 0) return segmentPoints[0];
    if (position >= 1) return segmentPoints[segmentPoints.length - 1];

    // Find the two points to interpolate between
    const exactIndex = position * (segmentPoints.length - 1);
    const lowerIndex = Math.floor(exactIndex);
    const upperIndex = Math.min(lowerIndex + 1, segmentPoints.length - 1);
    const localPosition = exactIndex - lowerIndex;

    if (lowerIndex === upperIndex) return segmentPoints[lowerIndex];

    const point1 = segmentPoints[lowerIndex];
    const point2 = segmentPoints[upperIndex];

    // Interpolate all numeric values
    const interpolatedPoint = {
        lat: point1.lat + (point2.lat - point1.lat) * localPosition,
        lng: point1.lng + (point2.lng - point1.lng) * localPosition,
        timestamp: Math.round(point1.timestamp + (point2.timestamp - point1.timestamp) * localPosition),
        index: Math.round(point1.index + (point2.index - point1.index) * localPosition)
    };

    // Interpolate all the data fields
    const fields = ['speed', 'altitude', 'wheel_speed', 'battery', 'pwm', 'power',
                   'energy_consumption', 'voltage', 'current', 'distance', 'temp', 'temp_motor', 'temp_batt',
                   'tilt', 'roll'];

    fields.forEach(field => {
        const val1 = point1[field];
        const val2 = point2[field];
        if (val1 !== null && val1 !== undefined && val2 !== null && val2 !== undefined) {
            interpolatedPoint[field] = val1 + (val2 - val1) * localPosition;
        } else {
            interpolatedPoint[field] = val1 !== null && val1 !== undefined ? val1 : val2;
        }
    });

    return interpolatedPoint;
}

/**
 * Interpolate between color stops for a normalized 0-1 value.
 * @param {number} value - Raw data value
 * @param {number} min - Data minimum
 * @param {number} max - Data maximum
 * @param {Array} colorStops - Array of [position, [r,g,b]] pairs, position 0-1
 * @returns {string} rgb() color string
 */
export function interpolateColorScale(value, min, max, colorStops) {
    if (value === null || value === undefined) return '#808080';

    const range = max - min;
    const t = range === 0 ? 0.5 : Math.max(0, Math.min(1, (value - min) / range));

    // Find the two stops to interpolate between
    let lower = colorStops[0];
    let upper = colorStops[colorStops.length - 1];
    for (let i = 0; i < colorStops.length - 1; i++) {
        if (t >= colorStops[i][0] && t <= colorStops[i + 1][0]) {
            lower = colorStops[i];
            upper = colorStops[i + 1];
            break;
        }
    }

    const segRange = upper[0] - lower[0];
    const segT = segRange === 0 ? 0 : (t - lower[0]) / segRange;

    const r = Math.round(lower[1][0] + (upper[1][0] - lower[1][0]) * segT);
    const g = Math.round(lower[1][1] + (upper[1][1] - lower[1][1]) * segT);
    const b = Math.round(lower[1][2] + (upper[1][2] - lower[1][2]) * segT);

    return `rgb(${r}, ${g}, ${b})`;
}

/**
 * Interpolate diverging color scale centered on 0.
 * Maps value to 0-1 where 0.5 = zero, using absMax = Math.max(|min|, |max|).
 * @param {number} value - Raw data value (can be negative)
 * @param {number} min - Data minimum
 * @param {number} max - Data maximum
 * @param {Array} colorStops - Array of [position, [r,g,b]] pairs
 * @returns {string} rgb() color string
 */
export function interpolateDivergingColorScale(value, min, max, colorStops) {
    if (value === null || value === undefined) return '#808080';

    const absMax = Math.max(Math.abs(min), Math.abs(max));
    if (absMax === 0) return interpolateColorScale(value, 0, 1, colorStops);

    // Map value to 0-1 where 0.5 = zero
    const normalized = (value / absMax) * 0.5 + 0.5;
    // Use interpolateColorScale with 0-1 range directly (value IS the normalized position)
    return interpolateColorScale(normalized, 0, 1, colorStops);
}

/**
 * Generic route segment creation — replaces all 4 bespoke create*RouteSegments functions.
 * @param {Array} routePoints - Array of GPS route points
 * @param {object} overlayConfig - Route overlay config entry from EUCOverlayConfig.routes
 * @param {object} colorFunctions - Map of function name to function (getSpeedColor, etc.)
 * @returns {object} { segments: [...], min, max }
 */
export function createGenericRouteSegments(routePoints, overlayConfig, colorFunctions) {
    const segmentSize = Math.max(5, Math.floor(routePoints.length / 200));
    const segments = [];

    // Extract all values for this field to compute min/max
    const allValues = routePoints
        .map(p => p[overlayConfig.field])
        .filter(v => v !== null && v !== undefined);

    if (allValues.length === 0) {
        if (DEBUG.MAP_UTILS) console.log(`[MAP UTILS] No data for field: ${overlayConfig.field}`);
        return { segments: [], min: 0, max: 0 };
    }

    // For PWM: filter out false readings > 100%
    const filteredValues = overlayConfig.field === 'pwm'
        ? allValues.filter(v => v <= 100)
        : allValues;

    const min = Math.min(...filteredValues);
    const max = Math.max(...filteredValues);

    // Detect flip state from first route point (for PWM)
    const isFlipped = routePoints.length > 0 && routePoints[0].pwmFlipped;

    if (DEBUG.MAP_UTILS) console.log(`[MAP UTILS] Creating ${overlayConfig.id} segments: field=${overlayConfig.field}, min=${min.toFixed(1)}, max=${max.toFixed(1)}, segmentSize=${segmentSize}`);

    for (let i = 0; i < routePoints.length - segmentSize; i += segmentSize) {
        const segmentPoints = routePoints.slice(i, i + segmentSize + 1);

        // Calculate average value for this segment
        let values;
        if (overlayConfig.field === 'pwm') {
            values = segmentPoints.map(p => p[overlayConfig.field]).filter(v => v !== null && v !== undefined && v <= 100);
        } else {
            values = segmentPoints.map(p => p[overlayConfig.field]).filter(v => v !== null && v !== undefined);
        }
        const avg = values.length > 0 ? values.reduce((sum, v) => sum + v, 0) / values.length : null;

        // Compute color based on colorMode
        let color;
        if (avg === null) {
            color = '#808080';
        } else if (overlayConfig.colorMode === 'custom') {
            const fn = colorFunctions[overlayConfig.colorFn];
            if (overlayConfig.needsMinMax) {
                color = fn(avg, min, max);
            } else if (overlayConfig.needsPWMFlip) {
                color = fn(avg, isFlipped);
            } else {
                color = fn(avg);
            }
        } else if (overlayConfig.colorMode === 'diverging') {
            color = interpolateDivergingColorScale(avg, min, max, overlayConfig.colorStops);
        } else {
            color = interpolateColorScale(avg, min, max, overlayConfig.colorStops);
        }

        const segmentCoords = segmentPoints.map(p => [p.lat, p.lng]);

        segments.push({
            coords: segmentCoords,
            value: avg,
            color: color,
            startIndex: i,
            endIndex: Math.min(i + segmentSize, routePoints.length - 1),
            startPoint: segmentPoints[0],
            endPoint: segmentPoints[segmentPoints.length - 1],
            segmentPoints: segmentPoints
        });
    }

    if (DEBUG.MAP_UTILS) console.log(`[MAP UTILS] Created ${segments.length} ${overlayConfig.id} segments`);
    return { segments, min, max };
}

/**
 * Projects a cursor LatLng to the nearest point along the route polyline
 * @param {object} cursorLatLng - Cursor position LatLng
 * @param {Array} routePoints - Array of GPS route points
 * @param {object} map - Leaflet map instance
 * @returns {object} Nearest point LatLng on the route
 */
export function projectToPolyline(cursorLatLng, routePoints, map) {
    if (!routePoints || routePoints.length < 2) return null;

    let bestPoint = null;
    let bestDist = Infinity;

    for (let i = 0; i < routePoints.length - 1; i++) {
        const p1 = L.latLng(routePoints[i].lat, routePoints[i].lng);
        const p2 = L.latLng(routePoints[i + 1].lat, routePoints[i + 1].lng);
        const p = closestPointOnSegment(cursorLatLng, p1, p2, map);
        const d = map.distance(cursorLatLng, p);
        if (d < bestDist) {
            bestDist = d;
            bestPoint = p;
        }
    }
    return bestPoint;
}
