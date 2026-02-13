// assets/00-init.js - Chart Synchronization System

// Initialize global namespace for the application
window.EUC_DASH = window.EUC_DASH || {};

// Enhanced Debug System with granular controls
// Enable via: localStorage.EUC_DASH_DEBUG = 'sync,gps' or 'all' or '1'
(function() {
    // Load debug settings
    var stored = null;
    try { stored = window.localStorage ? localStorage.getItem('EUC_DASH_DEBUG') : null; } catch (e) { stored = null; }

    // Debug categories with individual controls
    window.EUC_DASH.DEBUG_CATEGORIES = {
        SYNC: false,     // Chart/Map synchronization
        GPS: false,      // GPS mapping and route tracking
        CANVAS: false,   // Canvas chart rendering
        INIT: false,     // Initialization and setup
        PERFORMANCE: false, // Performance metrics and timing
        POPUP: false     // Popup positioning and edge detection
    };

    // Parse debug settings
    if (stored) {
        if (stored === '1' || stored === 'true' || stored === 'all') {
            // Enable all categories
            Object.keys(window.EUC_DASH.DEBUG_CATEGORIES).forEach(function(cat) {
                window.EUC_DASH.DEBUG_CATEGORIES[cat] = true;
            });
        } else {
            // Enable specific categories (comma-separated)
            var categories = stored.toLowerCase().split(',');
            categories.forEach(function(cat) {
                var upperCat = cat.trim().toUpperCase();
                if (window.EUC_DASH.DEBUG_CATEGORIES.hasOwnProperty(upperCat)) {
                    window.EUC_DASH.DEBUG_CATEGORIES[upperCat] = true;
                }
            });
        }
    }

    // Legacy flag for compatibility
    window.EUC_DASH.DEBUG = Object.values(window.EUC_DASH.DEBUG_CATEGORIES).some(Boolean);

    // Enhanced console filtering with categories
    var PREFIX_TO_CATEGORY = {
        '[SYNC]': 'SYNC',
        '[GPS]': 'GPS',
        '[GPS MAP]': 'GPS',
        '[CANVAS]': 'CANVAS',
        '[INIT]': 'INIT',
        '[PERF]': 'PERFORMANCE',
        '[POPUP]': 'POPUP'
    };

    var originalConsole = {
        log: console.log.bind(console),
        info: console.info.bind(console),
        warn: console.warn.bind(console),
        error: console.error.bind(console)
    };

    function shouldFilter(args) {
        if (!args || args.length === 0) return false;
        var first = args[0];
        if (typeof first !== 'string') return false;
        var text = first.trim();

        // Check each prefix and its category
        for (var prefix in PREFIX_TO_CATEGORY) {
            if (text.indexOf(prefix) === 0) {
                var category = PREFIX_TO_CATEGORY[prefix];
                return !window.EUC_DASH.DEBUG_CATEGORIES[category];
            }
        }
        return false;
    }

    console.log = function() { if (shouldFilter(arguments)) return; originalConsole.log.apply(console, arguments); };
    console.info = function() { if (shouldFilter(arguments)) return; originalConsole.info.apply(console, arguments); };
    console.warn = function() { if (shouldFilter(arguments)) return; originalConsole.warn.apply(console, arguments); };
    // Never filter errors
    console.error = function() { originalConsole.error.apply(console, arguments); };

    // Expose for debugging
    window.EUC_DASH._console = originalConsole;
    // Enhanced tracing and debug utilities
    window.EUC_DASH.syncTrace = [];
    window.EUC_DASH.dumpSyncTrace = function(max = 50) {
        var buf = window.EUC_DASH.syncTrace;
        var slice = buf.slice(-max);
        console.table(slice);
        return slice;
    };

    // Performance diagnostics helper
    window.EUC_DASH.perfStats = {
        syncTimes: [],
        maxSamples: 100
    };

    window.EUC_DASH.addPerfSample = function(totalTime, chartTime, mapTime) {
        this.perfStats.syncTimes.push({
            timestamp: Date.now(),
            total: totalTime,
            charts: chartTime,
            map: mapTime
        });
        if (this.perfStats.syncTimes.length > this.perfStats.maxSamples) {
            this.perfStats.syncTimes.shift();
        }
    };

    window.EUC_DASH.getPerfStats = function() {
        const times = this.perfStats.syncTimes;
        if (times.length === 0) {
            return { message: 'No performance data collected yet. Enable PERFORMANCE debug and move mouse over charts.' };
        }

        const totals = times.map(t => t.total);
        const charts = times.map(t => t.charts);
        const maps = times.map(t => t.map);

        const avg = arr => arr.reduce((a, b) => a + b, 0) / arr.length;
        const max = arr => Math.max(...arr);
        const min = arr => Math.min(...arr);

        return {
            samples: times.length,
            total: {
                avg: avg(totals).toFixed(2) + 'ms',
                max: max(totals).toFixed(2) + 'ms',
                min: min(totals).toFixed(2) + 'ms'
            },
            charts: {
                avg: avg(charts).toFixed(2) + 'ms',
                max: max(charts).toFixed(2) + 'ms',
                min: min(charts).toFixed(2) + 'ms'
            },
            map: {
                avg: avg(maps).toFixed(2) + 'ms',
                max: max(maps).toFixed(2) + 'ms',
                min: min(maps).toFixed(2) + 'ms'
            },
            recommendation: max(totals) < 16 ? '✅ Performance is good (<16ms, 60fps)' :
                           max(totals) < 33 ? '⚠️ Performance acceptable (16-33ms, 30-60fps)' :
                           '❌ Performance poor (>33ms, <30fps) - consider optimization'
        };
    };

    // Debug helper functions
    window.EUC_DASH.enableDebug = function(categories) {
        if (!categories || categories === 'all') {
            Object.keys(window.EUC_DASH.DEBUG_CATEGORIES).forEach(function(cat) {
                window.EUC_DASH.DEBUG_CATEGORIES[cat] = true;
            });
            localStorage.setItem('EUC_DASH_DEBUG', 'all');
        } else {
            var cats = categories.split(',');
            cats.forEach(function(cat) {
                var upperCat = cat.trim().toUpperCase();
                if (window.EUC_DASH.DEBUG_CATEGORIES.hasOwnProperty(upperCat)) {
                    window.EUC_DASH.DEBUG_CATEGORIES[upperCat] = true;
                }
            });
            localStorage.setItem('EUC_DASH_DEBUG', categories);
        }
        console.log('Debug categories enabled:', window.EUC_DASH.DEBUG_CATEGORIES);
    };

    window.EUC_DASH.disableDebug = function() {
        Object.keys(window.EUC_DASH.DEBUG_CATEGORIES).forEach(function(cat) {
            window.EUC_DASH.DEBUG_CATEGORIES[cat] = false;
        });
        localStorage.removeItem('EUC_DASH_DEBUG');
        console.log('All debug logging disabled');
    };

    window.EUC_DASH.debugStatus = function() {
        console.log('=== EUC DASH Debug Status ===');
        Object.keys(window.EUC_DASH.DEBUG_CATEGORIES).forEach(function(cat) {
            var status = window.EUC_DASH.DEBUG_CATEGORIES[cat] ? '✅ ON' : '❌ OFF';
            console.log(cat + ': ' + status);
        });
        console.log('Usage: EUC_DASH.enableDebug("sync,gps") or EUC_DASH.enableDebug("all")');
    };
})();

// Centralized event and state synchronization system for all components
window.eucChartSync = {
    charts: {},
    gpsMap: null,

    // Register a chart instance
    registerChart: function(chartId, chartInstance) {
        this.charts[chartId] = chartInstance;
        console.log('[SYNC] Registered chart:', chartId);
    },

    // Register the GPS map instance
    registerGPSMap: function(mapInstance) {
        this.gpsMap = mapInstance;
        console.log('[SYNC] Registered GPS map');
    },

    // Synchronize hover-in events across all components (supports index or {index, timestamp})
    syncHover: function(dataIndexOrObj, sourceId) {
        const perfStart = performance.now();
        var index = (typeof dataIndexOrObj === 'object' && dataIndexOrObj !== null) ? dataIndexOrObj.index : dataIndexOrObj;
        var timestamp = (typeof dataIndexOrObj === 'object' && dataIndexOrObj !== null) ? dataIndexOrObj.timestamp : undefined;
        if (window.EUC_DASH && window.EUC_DASH.syncTrace) {
            window.EUC_DASH.syncTrace.push({
                when: Date.now(),
                type: 'hover_in',
                source: sourceId,
                index: index,
                timestamp: timestamp
            });
        }

        // Sync with all other charts
        var chartsSynced = 0;
        const chartSyncStart = performance.now();
        Object.keys(this.charts).forEach(chartId => {
            if (chartId !== sourceId) {
                const chart = this.charts[chartId];
                if (chart) {
                    // Prefer timestamp method if available, otherwise use index method
                    if (timestamp && typeof chart.syncHoverTs === 'function') {
                        chart.syncHoverTs(timestamp);
                        chartsSynced++;
                    } else if (typeof chart.syncHover === 'function') {
                        chart.syncHover(index);
                        chartsSynced++;
                    } else {
                        console.warn(`[SYNC] ❌ Chart ${chartId} has no sync methods available`);
                    }
                } else {
                    console.warn(`[SYNC] ⚠️ Chart ${chartId} is null or undefined`);
                }
            }
        });
        const chartSyncTime = performance.now() - chartSyncStart;

        // Sync with the GPS map (always show popup when syncing from graphs)
        const mapSyncStart = performance.now();
        if (this.gpsMap && sourceId !== 'gps-map') {
            if (timestamp && typeof this.gpsMap.updatePositionByTimestamp === 'function') {
                this.gpsMap.updatePositionByTimestamp(timestamp, { centerIfNearEdge: true, showPopup: true });
            } else if (typeof this.gpsMap.updatePosition === 'function') {
                this.gpsMap.updatePosition(index, { centerIfNearEdge: true, showPopup: true });
            } else {
                console.warn(`[SYNC] ⚠️ GPS map has no updatePosition methods available`);
            }
        } else if (!this.gpsMap) {
            console.warn(`[SYNC] ⚠️ GPS map not registered`);
        }
        const mapSyncTime = performance.now() - mapSyncStart;

        const totalTime = performance.now() - perfStart;

        // Only log if performance is poor (>33ms = <30fps)
        if (totalTime > 33) {
            console.log(`[PERF] Sync total: ${totalTime.toFixed(2)}ms (charts: ${chartSyncTime.toFixed(2)}ms, map: ${mapSyncTime.toFixed(2)}ms)`);
        }

        // Collect performance stats
        if (window.EUC_DASH && window.EUC_DASH.addPerfSample) {
            window.EUC_DASH.addPerfSample(totalTime, chartSyncTime, mapSyncTime);
        }
    },

    // Synchronize hover-out events across all components
    syncHoverOut: function(sourceId) {
        if (window.EUC_DASH && window.EUC_DASH.syncTrace) {
            window.EUC_DASH.syncTrace.push({
                when: Date.now(),
                type: 'hover_out',
                source: sourceId
            });
        }

        // Sync with all other charts
        var chartsCleared = 0;
        Object.keys(this.charts).forEach(chartId => {
            if (chartId !== sourceId) {
                const chart = this.charts[chartId];
                if (chart && typeof chart.syncHoverOut === 'function') {
                    chart.syncHoverOut();
                    chartsCleared++;
                }
            }
        });

        // Sync with the GPS map (reset position and hide popup)
        if (this.gpsMap && sourceId !== 'gps-map' && typeof this.gpsMap.updatePosition === 'function') {
            this.gpsMap.updatePosition(-1, { hidePopup: true });
        }
    },

    // Broadcast overlay state changes from GPS map to all charts
    broadcastOverlayChange: function(overlayId, isVisible) {

        // Use window.eucCharts instead of this.charts (they have different objects)
        if (window.eucCharts) {
            Object.keys(window.eucCharts).forEach(chartId => {
                const chart = window.eucCharts[chartId];
                if (chart && typeof chart.updateOverlayVisibility === 'function') {
                    chart.updateOverlayVisibility(overlayId, isVisible);
                } else {
                    console.warn(`[SYNC] Chart ${chartId} doesn't have updateOverlayVisibility method`);
                }
            });
        } else {
            console.warn(`[SYNC] window.eucCharts not available`);
        }
    },

    // Initialize sync system (called from app.js after charts are created)
    init: function() {
        console.log('[SYNC] Chart synchronization system initialized');
        console.log('[SYNC] Registered charts:', Object.keys(this.charts));
        console.log('[SYNC] GPS map registered:', !!this.gpsMap);
        return true;
    },

    // Cleanup all charts and reset sync system
    cleanup: function() {
        console.log('[SYNC] Cleaning up charts and sync system...');

        // Destroy all registered charts
        Object.keys(this.charts).forEach(chartId => {
            const chart = this.charts[chartId];
            if (chart && typeof chart.destroy === 'function') {
                try {
                    chart.destroy();
                    console.log('[SYNC] Destroyed chart:', chartId);
                } catch (err) {
                    console.warn('[SYNC] Error destroying chart:', chartId, err);
                }
            }
        });

        // Clear chart registry
        this.charts = {};
        this.gpsMap = null;

        console.log('[SYNC] Cleanup complete');
    }
};

// Alias for compatibility with app.js
window.EUCChartSync = window.eucChartSync;

console.log('[INIT] Global sync system (eucChartSync) initialized.');

// Suppress Leaflet canvas errors during map destruction (non-fatal timing issues)
window.addEventListener('error', function(event) {
    // Check if error is from Leaflet canvas renderer during cleanup
    if (event.error &&
        event.error.message &&
        (event.error.message.includes("Cannot read properties of undefined (reading 'save')") ||
         event.error.message.includes("Cannot read properties of undefined (reading 'restore')")) &&
        event.filename && event.filename.includes('leaflet')) {

        // Suppress this specific error - it's a harmless timing issue
        // when clearing canvas layers during map destruction
        console.log('[INIT] Suppressed non-fatal Leaflet canvas error during map cleanup');
        event.preventDefault();
        return true;
    }
});
