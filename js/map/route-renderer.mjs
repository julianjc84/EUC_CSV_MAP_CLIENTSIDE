/**
 * Route Renderer Module
 *
 * Handles route rendering on the map:
 * - Data-driven route overlays from EUCOverlayConfig.routes
 * - Lazy generation with per-overlay cache
 * - Generic segment creation for any numeric field
 * - Hit area for mouse tracking
 */

import { createGenericRouteSegments, getSpeedColor, getPWMColor, getElevationColor, getBatteryColor } from './map-utils.mjs';
import { DEBUG } from './debug-config.mjs';

// Color functions lookup — used by overlays with colorMode: 'custom'
const COLOR_FUNCTIONS = {
    getSpeedColor,
    getPWMColor,
    getElevationColor,
    getBatteryColor
};

/**
 * Create route renderer
 * @param {object} map - Leaflet map instance
 * @param {object} overlayState - Overlay visibility state
 * @returns {object} RouteRenderer instance
 */
export function createRouteRenderer(map, overlayState) {
    // Cache keyed by overlay ID: { [id]: { polylines: [], rawSegments: [], min, max } }
    const segmentCache = {};
    let routeHitPolyline = null;
    let cachedRoutePoints = null;
    let activeOverlayId = null;

    /**
     * Find the currently active route overlay ID from overlayState
     */
    function findActiveOverlayId() {
        const routeConfig = window.EUCOverlayConfig?.routes || {};
        for (const id of Object.keys(routeConfig)) {
            if (overlayState[id]) return id;
        }
        return null;
    }

    /**
     * Generate route segments for a given overlay and add to map
     */
    function generateRoute(overlayId) {
        if (!cachedRoutePoints) return;

        const routeConfig = window.EUCOverlayConfig?.routes || {};
        const config = routeConfig[overlayId];
        if (!config) {
            console.warn(`[ROUTE RENDERER] No config for overlay: ${overlayId}`);
            return;
        }

        // Check cache
        if (segmentCache[overlayId]) {
            // Already generated — just add polylines to map
            segmentCache[overlayId].polylines.forEach(seg => {
                if (!map.hasLayer(seg)) map.addLayer(seg);
            });
            if (DEBUG.ROUTE_RENDERER) console.log(`[ROUTE RENDERER] ${overlayId}: using cached segments`);
        } else {
            // Generate segments
            const result = createGenericRouteSegments(cachedRoutePoints, config, COLOR_FUNCTIONS);

            // Create polylines
            const polylines = [];
            result.segments.forEach(segmentData => {
                const polyline = L.polyline(segmentData.coords, {
                    color: segmentData.color,
                    weight: 8,
                    opacity: 0.8,
                    interactive: false
                }).addTo(map);
                polylines.push(polyline);
            });

            // Cache
            segmentCache[overlayId] = {
                polylines: polylines,
                rawSegments: result.segments,
                min: result.min,
                max: result.max
            };

            if (DEBUG.ROUTE_RENDERER) console.log(`[ROUTE RENDERER] ${overlayId}: generated ${polylines.length} segments`);
        }

        // ALWAYS set currentRouteSegments for hover interpolation (fixes bug where only speed route worked)
        activeOverlayId = overlayId;
        window.currentRouteSegments = segmentCache[overlayId].rawSegments;
    }

    return {
        /**
         * Render route with lazy-generated segments
         * @param {Array} routePoints - Filtered GPS route points
         * @returns {object} Route data including hit polyline
         */
        renderRoute(routePoints) {
            this.clearRoute();

            if (routePoints.length < 2) {
                if (DEBUG.ROUTE_RENDERER) console.log('[ROUTE RENDERER] Not enough GPS points for route');
                return null;
            }

            cachedRoutePoints = routePoints;

            const routeCoords = routePoints.map(point => [point.lat, point.lng]);

            // Generate only the currently active overlay
            const active = findActiveOverlayId();
            if (active) {
                generateRoute(active);
            }

            if (DEBUG.ROUTE_RENDERER) console.log('[ROUTE RENDERER] Lazy generation: only active route generated');

            // Invisible wide hit area for mouse tracking
            routeHitPolyline = L.polyline(routeCoords, {
                color: 'transparent',
                weight: 40,
                opacity: 0,
                interactive: true
            }).addTo(map);

            if (DEBUG.ROUTE_RENDERER) console.log('[ROUTE RENDERER] Route hit polyline created:', !!routeHitPolyline);

            return {
                hitPolyline: routeHitPolyline
            };
        },

        /**
         * Update overlay visibility — generic for any overlay ID
         * @param {string} overlayId - Overlay identifier from config
         * @param {boolean} isVisible - Visibility state
         */
        updateOverlayVisibility(overlayId, isVisible) {
            if (!cachedRoutePoints) {
                console.warn('[ROUTE RENDERER] No route data available for lazy generation');
                return;
            }

            if (isVisible) {
                generateRoute(overlayId);
            } else {
                // Hide: remove polylines from map (keep in cache)
                if (segmentCache[overlayId]) {
                    segmentCache[overlayId].polylines.forEach(seg => {
                        if (map.hasLayer(seg)) map.removeLayer(seg);
                    });
                }
            }
        },

        /**
         * Get the active overlay ID
         * @returns {string|null}
         */
        getActiveOverlayId() {
            return activeOverlayId;
        },

        /**
         * Get stats for the active overlay (for legend display)
         * @returns {object|null} { min, max, config }
         */
        getActiveOverlayStats() {
            if (!activeOverlayId) return null;
            const cached = segmentCache[activeOverlayId];
            if (!cached) return null;
            const routeConfig = window.EUCOverlayConfig?.routes || {};
            return {
                min: cached.min,
                max: cached.max,
                config: routeConfig[activeOverlayId]
            };
        },

        /**
         * Clear all route segments and hit polyline
         */
        clearRoute() {
            // Remove all cached polylines from map
            for (const id of Object.keys(segmentCache)) {
                segmentCache[id].polylines.forEach(segment => {
                    try {
                        if (segment._renderer && segment._renderer._drawing === false) {
                            segment._renderer._drawing = true;
                        }
                        map.removeLayer(segment);
                    } catch (err) {
                        if (DEBUG.ROUTE_RENDERER) console.log('[ROUTE RENDERER] Layer removal error (expected during destroy):', err.message);
                    }
                });
                delete segmentCache[id];
            }

            // Clear hit polyline
            if (routeHitPolyline) {
                try {
                    map.removeLayer(routeHitPolyline);
                } catch (err) {
                    if (DEBUG.ROUTE_RENDERER) console.log('[ROUTE RENDERER] Hit polyline removal error (expected during destroy):', err.message);
                }
                routeHitPolyline = null;
            }

            // Clear global segment reference
            window.currentRouteSegments = null;
            cachedRoutePoints = null;
            activeOverlayId = null;
        },

        /**
         * Get hit polyline for event binding
         * @returns {object} Leaflet polyline
         */
        getHitPolyline() {
            return routeHitPolyline;
        }
    };
}
