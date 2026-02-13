/**
 * GPS Map Main Entry Point
 *
 * Backward-compatible API for the refactored modular GPS map.
 * Maintains the same interface as original gps_map.js:
 * - window.EUCGPSMap(containerId) - Main factory function
 * - window.destroyEUCGPSMap() - Cleanup function
 */

import { initializeMap, createMapComponents, loadRouteData, clearMap } from './map-core.mjs';
import { setMapLayer } from './ui-controls.mjs';
import { createScissorsIcon } from './marker-manager.mjs';
import { createResourceLifecycleManager } from './resource-lifecycle-manager.mjs';
import { DEBUG } from './debug-config.mjs';

/**
 * Main GPS Map Factory (Backward Compatible)
 * @param {string} containerId - Container element ID
 * @returns {object} GPS Map API
 */
window.EUCGPSMap = function(containerId) {
    if (DEBUG.INIT) console.log(`[GPS MAP MAIN] Creating GPS map instance for: ${containerId}`);

    let components = null;
    let initialized = false;

    // Create resource lifecycle manager for automatic cleanup
    const resourceManager = createResourceLifecycleManager(`gps-map-${containerId}`);

    /**
     * Initialize the GPS map
     * @returns {boolean} Success status
     */
    function init() {
        if (initialized) {
            console.warn('[GPS MAP MAIN] Map already initialized');
            return true;  // Already initialized is a success state
        }

        try {
            if (DEBUG.INIT || DEBUG.MAP_CORE) console.log('[GPS MAP MAIN] Initializing map...');

            // Initialize map and create all components
            const { map, mapLayers } = initializeMap(containerId);
            components = createMapComponents(map, mapLayers, resourceManager);

            // Attach map click handler and register with resource manager
            const mapClickHandler = (e) => components.positionTracker.onMapClick(e);
            components.map.on('click', mapClickHandler);
            resourceManager.registerEventListener(components.map, 'click', mapClickHandler, 'map-click');

            initialized = true;
            if (DEBUG.INIT || DEBUG.MAP_CORE) console.log('[GPS MAP MAIN] Map initialized successfully');
            return true;
        } catch (error) {
            console.error('[GPS MAP MAIN] Failed to initialize map:', error);
            return false;
        }
    }

    /**
     * Set route data
     * @param {object} gpsRouteData - GPS route data
     * @returns {boolean} Success status
     */
    function setRouteData(gpsRouteData) {
        if (!initialized) {
            console.error('[GPS MAP MAIN] Map not initialized. Call init() first.');
            return false;
        }

        if (DEBUG.MAP_CORE) console.log('[GPS MAP MAIN] Setting route data:', gpsRouteData);

        if (!components.map) {
            console.error('[GPS MAP MAIN] Map not initialized');
            return false;
        }

        // Store route data
        components.setRouteData(gpsRouteData);

        // Load and render route
        const success = loadRouteData(
            gpsRouteData,
            components.map,
            components.markerRefs,
            components.markerManager,
            components.markerIcons,
            components.privacyFilter,
            components.routeRenderer,
            components.positionTracker,
            components.overlayState,
            components.panels,
            components.routeLegend
        );

        return success;
    }

    /**
     * Update position by data index
     * @param {number} dataIndex - Data point index
     * @param {object} options - Update options
     */
    function updatePosition(dataIndex, options = {}) {
        if (!initialized || !components) return;
        components.positionTracker.updatePosition(dataIndex, options);
    }

    /**
     * Update position by timestamp
     * @param {number} timestampMs - Timestamp in milliseconds
     * @param {object} options - Update options
     */
    function updatePositionByTimestamp(timestampMs, options = {}) {
        if (!initialized || !components) return;
        components.positionTracker.updatePositionByTimestamp(timestampMs, options);
    }

    /**
     * Clear all map elements
     */
    function clearMapElements() {
        if (!initialized || !components) return;

        clearMap(
            components.map,
            components.markerRefs,
            components.routeRenderer,
            components.popupManager,
            components.privacyFilter
        );
    }

    /**
     * Resize map (invalidate size)
     */
    function resize() {
        if (!initialized || !components || !components.map) return;

        if (DEBUG.MAP_CORE) console.log('[GPS MAP MAIN] Resizing map...');
        setTimeout(() => {
            components.map.invalidateSize();

            // Re-fit bounds if route data is available
            const routeData = components.routeData();
            if (routeData && routeData.bounds) {
                const bounds = L.latLngBounds(
                    [routeData.bounds.south, routeData.bounds.west],
                    [routeData.bounds.north, routeData.bounds.east]
                );
                components.map.fitBounds(bounds, { padding: [20, 20] });
                if (DEBUG.MAP_CORE) console.log('[GPS MAP MAIN] Re-fitting map bounds');
            }
        }, 100);
    }

    /**
     * Update time range markers
     * @param {number} startTimestamp - Start timestamp
     * @param {number} endTimestamp - End timestamp
     */
    function updateTimeRangeMarkers(startTimestamp, endTimestamp) {
        if (!initialized || !components || !components.map) return;

        const routeData = components.routeData();
        if (!routeData || !routeData.route_points) return;

        if (DEBUG.MAP_CORE) console.log(`[GPS MAP MAIN] Updating time range markers: ${startTimestamp} - ${endTimestamp}`);

        // Find GPS points for start and end timestamps
        const startPoint = findGPSPointByTimestamp(routeData.route_points, startTimestamp);
        const endPoint = findGPSPointByTimestamp(routeData.route_points, endTimestamp);

        if (!startPoint || !endPoint) {
            if (DEBUG.MAP_CORE) console.log('[GPS MAP MAIN] Could not find GPS points for timestamps');
            return;
        }

        // Remove existing time range markers
        if (components.markerRefs.timeRangeStartMarker) {
            components.map.removeLayer(components.markerRefs.timeRangeStartMarker);
            components.markerRefs.timeRangeStartMarker = null;
        }
        if (components.markerRefs.timeRangeEndMarker) {
            components.map.removeLayer(components.markerRefs.timeRangeEndMarker);
            components.markerRefs.timeRangeEndMarker = null;
        }

        // Check if trimming is actually happening
        const firstPointTime = routeData.route_points[0].timestamp;
        const lastPointTime = routeData.route_points[routeData.route_points.length - 1].timestamp;

        const isTrimmingStart = startTimestamp > (firstPointTime + 1000);
        if (isTrimmingStart) {
            components.markerRefs.timeRangeStartMarker = components.markerManager.registerMarker(
                L.marker([startPoint.lat, startPoint.lng], {
                    icon: createScissorsIcon('green'),
                    zIndexOffset: 2000
                }).addTo(components.map)
            );
        }

        const isTrimmingEnd = endTimestamp < (lastPointTime - 1000);
        if (isTrimmingEnd) {
            components.markerRefs.timeRangeEndMarker = components.markerManager.registerMarker(
                L.marker([endPoint.lat, endPoint.lng], {
                    icon: createScissorsIcon('red'),
                    zIndexOffset: 2000
                }).addTo(components.map)
            );
        }

        if (DEBUG.MAP_CORE) console.log(`[GPS MAP MAIN] Time range markers updated`);
    }

    /**
     * Clear time range markers
     */
    function clearTimeRangeMarkers() {
        if (!initialized || !components) return;

        if (components.markerRefs.timeRangeStartMarker) {
            components.map.removeLayer(components.markerRefs.timeRangeStartMarker);
            components.markerRefs.timeRangeStartMarker = null;
        }
        if (components.markerRefs.timeRangeEndMarker) {
            components.map.removeLayer(components.markerRefs.timeRangeEndMarker);
            components.markerRefs.timeRangeEndMarker = null;
        }

        if (DEBUG.MAP_CORE) console.log('[GPS MAP MAIN] Time range markers cleared');
    }

    /**
     * Show position at timestamp from graph (with popup pinning)
     * @param {number} timestampMs - Timestamp in milliseconds
     */
    function showAtTimestampFromGraph(timestampMs) {
        if (!initialized || !components) return;
        updatePositionByTimestamp(timestampMs, { showPopup: true, pin: 'graph' });
    }

    /**
     * Show position at index from graph (with popup pinning)
     * @param {number} index - Data point index
     */
    function showAtIndexFromGraph(index) {
        if (!initialized || !components) return;
        updatePosition(index, { showPopup: true, pin: 'graph' });
    }

    /**
     * Destroy map instance and clean up resources
     */
    function destroy() {
        if (DEBUG.CLEANUP || DEBUG.MAP_CORE) console.log(`[GPS MAP MAIN] Destroying map: ${containerId}`);

        if (!initialized || !components) {
            // Still cleanup the resource manager even if not initialized
            resourceManager.cleanup('destroy-called-before-init');
            return;
        }

        // Use resource manager for automatic cleanup
        // This will trigger all registered cleanup callbacks
        resourceManager.cleanup('user-destroy');

        // Manual cleanup for components that need explicit cleanup
        // (These should ideally be migrated to use resourceManager)
        clearMapElements();
        clearTimeRangeMarkers();

        if (components.popupManager) {
            components.popupManager.cleanup();
        }

        if (components.positionTracker) {
            components.positionTracker.cleanup();
        }

        // Remove all event listeners from map
        if (components.map) {
            // CRITICAL: Stop all interactions and animations BEFORE cleanup
            // This prevents in-progress event handlers from accessing removed DOM elements
            try {
                // Stop all animations and interactions
                components.map.stop();

                // Disable all interaction handlers to prevent new events during cleanup
                components.map.dragging?.disable();
                components.map.touchZoom?.disable();
                components.map.doubleClickZoom?.disable();
                components.map.scrollWheelZoom?.disable();
                components.map.boxZoom?.disable();
                components.map.keyboard?.disable();

                // Remove all event listeners
                components.map.off();

                // With Canvas rendering, skip individual layer removal to avoid context errors
                // Just destroy the map directly - all layers will be removed automatically
                // Remove the map instance
                components.map.remove();
            } catch (error) {
                console.error('[GPS MAP MAIN] Error during map cleanup:', error);
            }
        }

        // Clear all references
        components = null;
        initialized = false;

        if (DEBUG.CLEANUP || DEBUG.MAP_CORE) console.log(`[GPS MAP MAIN] Map ${containerId} destroyed`);
    }

    /**
     * Get resource diagnostics for leak detection
     * @returns {object} Resource statistics
     */
    function getDiagnostics() {
        return resourceManager.getDiagnostics();
    }

    /**
     * Helper: Find GPS point by timestamp
     * @private
     */
    function findGPSPointByTimestamp(routePoints, timestampMs) {
        if (!routePoints) return null;

        let closest = routePoints[0];
        let minDiff = Math.abs(routePoints[0].timestamp - timestampMs);

        for (let i = 1; i < routePoints.length; i++) {
            const diff = Math.abs(routePoints[i].timestamp - timestampMs);
            if (diff < minDiff) {
                minDiff = diff;
                closest = routePoints[i];
            }
        }

        return closest;
    }

    // Public API (backward compatible with original gps_map.js)
    return {
        init: init,
        setRouteData: setRouteData,
        updatePosition: updatePosition,
        updatePositionByTimestamp: updatePositionByTimestamp,
        clearMap: clearMapElements,
        resize: resize,
        updateTimeRangeMarkers: updateTimeRangeMarkers,
        clearTimeRangeMarkers: clearTimeRangeMarkers,
        showAtTimestampFromGraph: showAtTimestampFromGraph,
        showAtIndexFromGraph: showAtIndexFromGraph,

        // Switch map tile style (e.g. 'dark', 'grayscale', 'street')
        setMapStyle: function(styleName) {
            if (!initialized || !components) return;
            setMapLayer(styleName, components.map, components.mapLayers);
        },

        // Get render statistics for map segments
        getRenderStats: function() {
            if (!initialized || !components) {
                return {
                    totalRoutePoints: 0,
                    activeOverlay: null,
                    totalSegments: 0
                };
            }

            const routeData = components.routeData();
            if (!routeData || !routeData.route_points) {
                return {
                    totalRoutePoints: 0,
                    activeOverlay: null,
                    totalSegments: 0
                };
            }

            const segmentSize = Math.max(5, Math.floor(routeData.route_points.length / 200));
            const estimatedSegments = Math.ceil(routeData.route_points.length / segmentSize);

            return {
                totalRoutePoints: routeData.route_points.length,
                activeOverlay: components.routeRenderer?.getActiveOverlayId() ?? null,
                totalSegments: estimatedSegments,
                segmentSize: segmentSize
            };
        },
        destroy: destroy,

        // Resource management and diagnostics
        getDiagnostics: getDiagnostics,
        resourceManager: resourceManager  // Expose for advanced usage
    };
};

/**
 * Global cleanup function (Backward Compatible)
 * Destroys GPS map instance stored in window.gpsMap
 */
window.destroyEUCGPSMap = function() {
    if (DEBUG.CLEANUP) console.log('[GPS MAP CLEANUP] destroyEUCGPSMap() called');

    if (!window.gpsMap) {
        if (DEBUG.CLEANUP) console.log('[GPS MAP CLEANUP] No GPS map instance to destroy');
        return;
    }

    try {
        if (window.gpsMap && typeof window.gpsMap.destroy === 'function') {
            window.gpsMap.destroy();
            if (DEBUG.CLEANUP) console.log('[GPS MAP CLEANUP] GPS map instance destroyed');
        } else {
            console.warn('[GPS MAP CLEANUP] GPS map has no destroy method');
        }
    } catch (error) {
        console.error('[GPS MAP CLEANUP] Error destroying GPS map:', error);
    }

    // Clear the global reference
    window.gpsMap = null;
    if (DEBUG.CLEANUP) console.log('[GPS MAP CLEANUP] GPS map reference cleared');
};

/**
 * Initialize when DOM and dependencies are ready
 */
document.addEventListener('DOMContentLoaded', function() {
    if (DEBUG.INIT) console.log('[GPS MAP MAIN] DOM loaded, waiting for dependencies...');

    // Wait for init system to be ready
    if (typeof window.addInitCallback === 'function') {
        window.addInitCallback(function() {
            if (DEBUG.INIT) console.log('[GPS MAP MAIN] Dependencies ready, GPS map ready');
        });
    } else {
        if (DEBUG.INIT) console.log('[GPS MAP MAIN] Init system not available, GPS map ready');
    }
});

// Export for ES6 module usage
export default window.EUCGPSMap;

/**
 * Diagnostic helper methods exposed to window for debugging
 */
window.EUCGPSMapDiagnostics = {
    /**
     * Get resource diagnostics for the current GPS map instance
     * @returns {object|null} Resource statistics or null if no instance
     */
    getResourceDiagnostics() {
        if (window.gpsMapInstance && typeof window.gpsMapInstance.getDiagnostics === 'function') {
            return window.gpsMapInstance.getDiagnostics();
        }
        console.warn('[DIAGNOSTICS] No GPS map instance found');
        return null;
    },

    /**
     * Print formatted resource diagnostics to console
     */
    printDiagnostics() {
        const diag = this.getResourceDiagnostics();
        if (!diag) return;

        console.log('=== GPS Map Resource Diagnostics ===');
        console.log(`Manager: ${diag.name}`);
        console.log(`Destroyed: ${diag.destroyed}`);
        console.log(`\nResource Counts:`);
        console.log(`  - Markers: ${diag.markers}`);
        console.log(`  - Layers: ${diag.layers}`);
        console.log(`  - Event Listeners: ${diag.eventListeners}`);
        console.log(`  - Intervals: ${diag.intervals}`);
        console.log(`  - Timeouts: ${diag.timeouts}`);
        console.log(`  - Cleanup Callbacks: ${diag.callbacks}`);
        console.log(`  - Child Managers: ${diag.children}`);

        if (diag.details) {
            console.log(`\nDetailed Information:`);
            if (diag.details.markers.length > 0) {
                console.log(`\nMarkers (${diag.details.markers.length}):`);
                console.table(diag.details.markers);
            }
            if (diag.details.layers.length > 0) {
                console.log(`\nLayers (${diag.details.layers.length}):`);
                console.table(diag.details.layers);
            }
            if (diag.details.eventListeners.length > 0) {
                console.log(`\nEvent Listeners (${diag.details.eventListeners.length}):`);
                console.table(diag.details.eventListeners);
            }
        }

        console.log('\nUsage: EUCGPSMapDiagnostics.printDiagnostics()');
    },

    /**
     * Check for potential resource leaks
     * @returns {object} Leak detection results
     */
    checkForLeaks() {
        const diag = this.getResourceDiagnostics();
        if (!diag) return { hasLeaks: false, message: 'No GPS map instance' };

        const leaks = [];
        const warnings = [];

        // Check for old resources (> 5 minutes)
        if (diag.details) {
            const FIVE_MINUTES = 5 * 60 * 1000;

            diag.details.markers.forEach((marker, index) => {
                if (marker.age > FIVE_MINUTES) {
                    warnings.push(`Marker ${index} (${marker.tag}) is ${Math.round(marker.age / 60000)} minutes old`);
                }
            });

            diag.details.eventListeners.forEach((listener, index) => {
                if (listener.age > FIVE_MINUTES) {
                    warnings.push(`Event listener ${index} (${listener.event}) is ${Math.round(listener.age / 60000)} minutes old`);
                }
            });
        }

        // Check for unusually high resource counts
        if (diag.markers > 50) leaks.push(`High marker count: ${diag.markers} (expected < 50)`);
        if (diag.layers > 100) leaks.push(`High layer count: ${diag.layers} (expected < 100)`);
        if (diag.eventListeners > 20) leaks.push(`High event listener count: ${diag.eventListeners} (expected < 20)`);
        if (diag.intervals > 5) leaks.push(`High interval count: ${diag.intervals} (expected < 5)`);

        const hasLeaks = leaks.length > 0;
        const hasWarnings = warnings.length > 0;

        console.log('=== Resource Leak Detection ===');
        if (hasLeaks) {
            console.error('⚠️ Potential leaks detected:');
            leaks.forEach(leak => console.error(`  - ${leak}`));
        } else {
            console.log('✅ No obvious leaks detected');
        }

        if (hasWarnings) {
            console.warn('\n⚠️ Warnings:');
            warnings.forEach(warning => console.warn(`  - ${warning}`));
        }

        return { hasLeaks, leaks, warnings };
    }
};

// Diagnostic tools silently available: window.EUCGPSMapDiagnostics
