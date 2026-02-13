/**
 * Resource Lifecycle Manager Module
 *
 * Centralized automatic resource tracking and cleanup system.
 * Prevents memory leaks by tracking all resources and providing automatic cleanup.
 *
 * Features:
 * - Automatic resource registration
 * - Lifecycle hooks (onDestroy callbacks)
 * - Resource grouping and tagging
 * - Leak detection and diagnostics
 * - Parent-child resource relationships
 */

import { DEBUG } from './debug-config.mjs';

/**
 * Create a resource lifecycle manager
 * @param {string} name - Manager instance name for debugging
 * @returns {object} ResourceLifecycleManager instance
 */
export function createResourceLifecycleManager(name = 'default') {
    const resources = {
        markers: [],        // Leaflet markers
        layers: [],         // Leaflet layers (polylines, polygons, etc.)
        eventListeners: [], // DOM and Leaflet event listeners
        intervals: [],      // setInterval IDs
        timeouts: [],       // setTimeout IDs
        callbacks: [],      // Cleanup callbacks
        children: []        // Child resource managers
    };

    let destroyed = false;

    if (DEBUG.RESOURCE_MANAGER) console.log(`[RESOURCE MANAGER] Created: ${name}`);

    return {
        /**
         * Register a Leaflet marker for automatic cleanup
         * @param {object} marker - Leaflet marker instance
         * @param {object} map - Leaflet map instance
         * @param {string} tag - Optional tag for grouping
         * @returns {object} The marker (for chaining)
         */
        registerMarker(marker, map, tag = '') {
            if (destroyed) {
                console.warn(`[RESOURCE MANAGER] ${name}: Cannot register marker after destruction`);
                return marker;
            }

            if (!marker) return marker;

            resources.markers.push({ marker, map, tag, timestamp: Date.now() });
            if (DEBUG.RESOURCE_MANAGER) console.log(`[RESOURCE MANAGER] ${name}: Registered marker${tag ? ` [${tag}]` : ''} (total: ${resources.markers.length})`);
            return marker;
        },

        /**
         * Register a Leaflet layer for automatic cleanup
         * @param {object} layer - Leaflet layer instance
         * @param {object} map - Leaflet map instance
         * @param {string} tag - Optional tag for grouping
         * @returns {object} The layer (for chaining)
         */
        registerLayer(layer, map, tag = '') {
            if (destroyed) {
                console.warn(`[RESOURCE MANAGER] ${name}: Cannot register layer after destruction`);
                return layer;
            }

            if (!layer) return layer;

            resources.layers.push({ layer, map, tag, timestamp: Date.now() });
            if (DEBUG.RESOURCE_MANAGER) console.log(`[RESOURCE MANAGER] ${name}: Registered layer${tag ? ` [${tag}]` : ''} (total: ${resources.layers.length})`);
            return layer;
        },

        /**
         * Register an event listener for automatic cleanup
         * @param {object} target - Event target (DOM element, Leaflet object, etc.)
         * @param {string} event - Event name
         * @param {function} handler - Event handler function
         * @param {string} tag - Optional tag for grouping
         */
        registerEventListener(target, event, handler, tag = '') {
            if (destroyed) {
                console.warn(`[RESOURCE MANAGER] ${name}: Cannot register event listener after destruction`);
                return;
            }

            if (!target || !event || !handler) return;

            resources.eventListeners.push({ target, event, handler, tag, timestamp: Date.now() });
            if (DEBUG.RESOURCE_MANAGER) console.log(`[RESOURCE MANAGER] ${name}: Registered event listener [${event}]${tag ? ` [${tag}]` : ''} (total: ${resources.eventListeners.length})`);
        },

        /**
         * Register a setInterval for automatic cleanup
         * @param {function} callback - Interval callback
         * @param {number} delay - Interval delay in milliseconds
         * @param {string} tag - Optional tag for grouping
         * @returns {number} Interval ID
         */
        registerInterval(callback, delay, tag = '') {
            if (destroyed) {
                console.warn(`[RESOURCE MANAGER] ${name}: Cannot register interval after destruction`);
                return null;
            }

            const intervalId = setInterval(callback, delay);
            resources.intervals.push({ intervalId, tag, timestamp: Date.now() });
            if (DEBUG.RESOURCE_MANAGER) console.log(`[RESOURCE MANAGER] ${name}: Registered interval${tag ? ` [${tag}]` : ''} (total: ${resources.intervals.length})`);
            return intervalId;
        },

        /**
         * Register a setTimeout for automatic cleanup
         * @param {function} callback - Timeout callback
         * @param {number} delay - Timeout delay in milliseconds
         * @param {string} tag - Optional tag for grouping
         * @returns {number} Timeout ID
         */
        registerTimeout(callback, delay, tag = '') {
            if (destroyed) {
                console.warn(`[RESOURCE MANAGER] ${name}: Cannot register timeout after destruction`);
                return null;
            }

            const timeoutId = setTimeout(callback, delay);
            resources.timeouts.push({ timeoutId, tag, timestamp: Date.now() });
            if (DEBUG.RESOURCE_MANAGER) console.log(`[RESOURCE MANAGER] ${name}: Registered timeout${tag ? ` [${tag}]` : ''} (total: ${resources.timeouts.length})`);
            return timeoutId;
        },

        /**
         * Register a cleanup callback to be called on destroy
         * @param {function} callback - Cleanup callback
         * @param {string} tag - Optional tag for identification
         */
        registerCleanupCallback(callback, tag = '') {
            if (destroyed) {
                console.warn(`[RESOURCE MANAGER] ${name}: Cannot register cleanup callback after destruction`);
                return;
            }

            if (!callback || typeof callback !== 'function') return;

            resources.callbacks.push({ callback, tag, timestamp: Date.now() });
            if (DEBUG.RESOURCE_MANAGER) console.log(`[RESOURCE MANAGER] ${name}: Registered cleanup callback${tag ? ` [${tag}]` : ''} (total: ${resources.callbacks.length})`);
        },

        /**
         * Register a child resource manager for hierarchical cleanup
         * @param {object} childManager - Child ResourceLifecycleManager instance
         */
        registerChild(childManager) {
            if (destroyed) {
                console.warn(`[RESOURCE MANAGER] ${name}: Cannot register child after destruction`);
                return;
            }

            resources.children.push(childManager);
            if (DEBUG.RESOURCE_MANAGER) console.log(`[RESOURCE MANAGER] ${name}: Registered child manager (total: ${resources.children.length})`);
        },

        /**
         * Clean up all registered resources
         * @param {string} reason - Optional reason for cleanup (for logging)
         */
        cleanup(reason = 'manual') {
            if (destroyed) {
                console.warn(`[RESOURCE MANAGER] ${name}: Already destroyed`);
                return;
            }

            if (DEBUG.CLEANUP || DEBUG.RESOURCE_MANAGER) console.log(`[RESOURCE MANAGER] ${name}: Starting cleanup (reason: ${reason})...`);

            const startTime = Date.now();
            let cleanupCount = 0;

            // 1. Clean up child managers first
            resources.children.forEach((childManager, index) => {
                try {
                    if (childManager && typeof childManager.cleanup === 'function') {
                        childManager.cleanup('parent-destroyed');
                        cleanupCount++;
                    }
                } catch (error) {
                    console.error(`[RESOURCE MANAGER] ${name}: Error cleaning up child ${index}:`, error);
                }
            });
            resources.children = [];

            // 2. Clean up markers
            resources.markers.forEach(({ marker, map, tag }) => {
                try {
                    if (marker && map && map.hasLayer(marker)) {
                        map.removeLayer(marker);
                        cleanupCount++;
                        if (DEBUG.RESOURCE_MANAGER) console.log(`[RESOURCE MANAGER] ${name}: Removed marker${tag ? ` [${tag}]` : ''}`);
                    }
                } catch (error) {
                    console.error(`[RESOURCE MANAGER] ${name}: Error removing marker:`, error);
                }
            });
            resources.markers = [];

            // 3. Clean up layers
            resources.layers.forEach(({ layer, map, tag }) => {
                try {
                    if (layer && map && map.hasLayer(layer)) {
                        map.removeLayer(layer);
                        cleanupCount++;
                        if (DEBUG.RESOURCE_MANAGER) console.log(`[RESOURCE MANAGER] ${name}: Removed layer${tag ? ` [${tag}]` : ''}`);
                    }
                } catch (error) {
                    console.error(`[RESOURCE MANAGER] ${name}: Error removing layer:`, error);
                }
            });
            resources.layers = [];

            // 4. Clean up event listeners
            resources.eventListeners.forEach(({ target, event, handler, tag }) => {
                try {
                    if (target && event && handler) {
                        // Try Leaflet's .off() first, then fall back to removeEventListener
                        if (typeof target.off === 'function') {
                            target.off(event, handler);
                        } else if (typeof target.removeEventListener === 'function') {
                            target.removeEventListener(event, handler);
                        }
                        cleanupCount++;
                        if (DEBUG.RESOURCE_MANAGER) console.log(`[RESOURCE MANAGER] ${name}: Removed event listener [${event}]${tag ? ` [${tag}]` : ''}`);
                    }
                } catch (error) {
                    console.error(`[RESOURCE MANAGER] ${name}: Error removing event listener:`, error);
                }
            });
            resources.eventListeners = [];

            // 5. Clean up intervals
            resources.intervals.forEach(({ intervalId, tag }) => {
                try {
                    clearInterval(intervalId);
                    cleanupCount++;
                    if (DEBUG.RESOURCE_MANAGER) console.log(`[RESOURCE MANAGER] ${name}: Cleared interval${tag ? ` [${tag}]` : ''}`);
                } catch (error) {
                    console.error(`[RESOURCE MANAGER] ${name}: Error clearing interval:`, error);
                }
            });
            resources.intervals = [];

            // 6. Clean up timeouts
            resources.timeouts.forEach(({ timeoutId, tag }) => {
                try {
                    clearTimeout(timeoutId);
                    cleanupCount++;
                    if (DEBUG.RESOURCE_MANAGER) console.log(`[RESOURCE MANAGER] ${name}: Cleared timeout${tag ? ` [${tag}]` : ''}`);
                } catch (error) {
                    console.error(`[RESOURCE MANAGER] ${name}: Error clearing timeout:`, error);
                }
            });
            resources.timeouts = [];

            // 7. Execute cleanup callbacks
            resources.callbacks.forEach(({ callback, tag }) => {
                try {
                    callback();
                    cleanupCount++;
                    if (DEBUG.RESOURCE_MANAGER) console.log(`[RESOURCE MANAGER] ${name}: Executed cleanup callback${tag ? ` [${tag}]` : ''}`);
                } catch (error) {
                    console.error(`[RESOURCE MANAGER] ${name}: Error executing cleanup callback:`, error);
                }
            });
            resources.callbacks = [];

            destroyed = true;
            const duration = Date.now() - startTime;
            if (DEBUG.CLEANUP || DEBUG.RESOURCE_MANAGER) console.log(`[RESOURCE MANAGER] ${name}: Cleanup complete - ${cleanupCount} resources cleaned in ${duration}ms`);
        },

        /**
         * Get diagnostic information about registered resources
         * @returns {object} Resource statistics
         */
        getDiagnostics() {
            return {
                name,
                destroyed,
                markers: resources.markers.length,
                layers: resources.layers.length,
                eventListeners: resources.eventListeners.length,
                intervals: resources.intervals.length,
                timeouts: resources.timeouts.length,
                callbacks: resources.callbacks.length,
                children: resources.children.length,
                details: {
                    markers: resources.markers.map(r => ({ tag: r.tag, age: Date.now() - r.timestamp })),
                    layers: resources.layers.map(r => ({ tag: r.tag, age: Date.now() - r.timestamp })),
                    eventListeners: resources.eventListeners.map(r => ({ event: r.event, tag: r.tag, age: Date.now() - r.timestamp }))
                }
            };
        },

        /**
         * Check if manager has been destroyed
         * @returns {boolean} Destruction status
         */
        isDestroyed() {
            return destroyed;
        }
    };
}

/**
 * Global resource manager for application-wide resources
 */
export const globalResourceManager = createResourceLifecycleManager('global');

// Automatically cleanup on page unload
window.addEventListener('beforeunload', () => {
    if (DEBUG.CLEANUP || DEBUG.RESOURCE_MANAGER) {
        console.log('[RESOURCE MANAGER] Page unloading - triggering global cleanup');
    }
    globalResourceManager.cleanup('page-unload');
});
