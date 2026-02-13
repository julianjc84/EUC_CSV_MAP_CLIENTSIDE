/**
 * Map Core Module
 *
 * Core map functionality and coordination:
 * - Map initialization
 * - Layer management
 * - Route data loading
 * - Component coordination
 * - Cleanup and destroy
 */

import { createMarkerManager, createMarkerStyles, createScissorsIcon } from './marker-manager.mjs';
import { createPrivacyFilter } from './privacy-filter.mjs';
import { createPopupManager } from './popup-manager.mjs';
import { createRouteRenderer } from './route-renderer.mjs';
import { createPositionTracker } from './position-tracker.mjs';
import { createMapControls, createCollapsiblePanels, togglePanel, setMapLayer, createRouteLegend } from './ui-controls.mjs';
import { DEBUG } from './debug-config.mjs';

/**
 * Initialize Leaflet map with tile layers
 * @param {string} containerId - Map container element ID
 * @returns {object} Map instance and layers
 */
export function initializeMap(containerId) {

    // Create map instance
    const map = L.map(containerId, {
        center: [37.7749, -122.4194], // Default: San Francisco
        zoom: 13,
        zoomControl: false,
        scrollWheelZoom: false,  // Disabled by default
        preferCanvas: true  // Use canvas renderer for better performance with many route segments
    });

    // Create tile layers
    const streetLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19
    });

    const grayscaleLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        attribution: '© OpenStreetMap contributors, © CARTO',
        maxZoom: 19
    });

    const satelliteLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        attribution: '© Esri',
        maxZoom: 19
    });

    const cyclosmLayer = L.tileLayer('https://{s}.tile-cyclosm.openstreetmap.fr/cyclosm/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors, © CyclOSM',
        maxZoom: 20
    });

    const transportLayer = L.tileLayer('https://{s}.tile.thunderforest.com/transport/{z}/{x}/{y}.png?apikey=YOUR_API_KEY', {
        attribution: '© OpenStreetMap contributors, © Thunderforest',
        maxZoom: 22
    });

    const topoLayer = L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors, © OpenTopoMap',
        maxZoom: 17
    });

    const humanitarianLayer = L.tileLayer('https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors, © Humanitarian OSM Team',
        maxZoom: 20
    });

    const darkLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '© OpenStreetMap contributors, © CARTO',
        maxZoom: 19
    });

    const terrainLayer = L.tileLayer('https://stamen-tiles-{s}.a.ssl.fastly.net/terrain/{z}/{x}/{y}.jpg', {
        attribution: '© Stamen Design, © OpenStreetMap contributors',
        maxZoom: 18
    });

    // Add default layer (check for dark mode preference)
    const isDarkMode = document.body.classList.contains('dark-mode');
    const defaultLayer = isDarkMode ? darkLayer : grayscaleLayer;
    const defaultLayerName = isDarkMode ? 'dark' : 'grayscale';
    defaultLayer.addTo(map);

    const mapLayers = {
        street: streetLayer,
        grayscale: grayscaleLayer,
        satellite: satelliteLayer,
        cyclosm: cyclosmLayer,
        transport: transportLayer,
        topo: topoLayer,
        humanitarian: humanitarianLayer,
        dark: darkLayer,
        terrain: terrainLayer,
        current: defaultLayerName
    };

    // Add scale control (distance indicator) in bottom left
    L.control.scale({
        position: 'bottomleft',
        metric: true,
        imperial: false,
        maxWidth: 150
    }).addTo(map);

    // Add zoom level indicator in bottom left
    const zoomControl = L.control({ position: 'bottomleft' });
    zoomControl.onAdd = function(map) {
        const div = L.DomUtil.create('div', 'zoom-level-indicator');
        div.style.cssText = `
            background: rgba(255, 255, 255, 0.9);
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 12px;
            font-weight: bold;
            color: #333;
            box-shadow: 0 1px 5px rgba(0,0,0,0.4);
            margin-bottom: 5px;
        `;
        div.innerHTML = 'Zoom: ' + map.getZoom();

        map.on('zoomend', function() {
            div.innerHTML = 'Zoom: ' + map.getZoom();
        });

        return div;
    };
    zoomControl.addTo(map);


    return { map, mapLayers };
}

/**
 * Create all map components
 * @param {object} map - Leaflet map instance
 * @param {object} mapLayers - Map layers object
 * @returns {object} All component instances
 */
export function createMapComponents(map, mapLayers) {
    // Initialize state objects — route overlays are config-driven
    const overlayState = {};
    const routeConfig = window.EUCOverlayConfig?.routes || {};
    const routeIds = Object.keys(routeConfig);
    routeIds.forEach((id, i) => {
        overlayState[id] = (i === 0); // First route active by default
    });
    // Marker overlays remain hardcoded
    overlayState.maxSpeed = true;
    overlayState.zeroSafety = true;
    overlayState.maxElevation = true;
    overlayState.minElevation = true;
    overlayState.maxMotorTemp = true;
    overlayState.maxControllerTemp = true;
    overlayState.maxBatteryTemp = true;
    overlayState.maxPower = true;
    overlayState.maxCurrent = true;
    overlayState.minBattery = true;
    overlayState.safetyMarginMin = true;
    overlayState.minVoltage = true;
    overlayState.maxTilt = true;
    overlayState.minTilt = true;
    overlayState.maxRoll = true;
    overlayState.minRoll = true;

    const privacyState = {
        enabled: false,
        hideStart: true,
        hideEnd: true,
        zoneSize: 100  // Number of points to hide from start/end
    };

    const markerRefs = {
        currentMarker: null,
        startMarker: null,
        endMarker: null,
        timeRangeStartMarker: null,
        timeRangeEndMarker: null
    };

    let mouseZoomEnabled = false;
    let routeData = null;

    // Create component instances
    const markerManager = createMarkerManager();
    const markerIcons = createMarkerStyles();
    const popupManager = createPopupManager(map);
    const privacyFilter = createPrivacyFilter(privacyState);
    const routeRenderer = createRouteRenderer(map, overlayState);
    const positionTracker = createPositionTracker(map, { markerRefs, popupManager });

    // Create route legend control
    const routeLegend = createRouteLegend(map);

    // Component coordination callbacks
    const callbacks = {
        zoomToFitTrack: () => {
            if (routeData && routeData.bounds) {
                const bounds = L.latLngBounds(
                    [routeData.bounds.south, routeData.bounds.west],
                    [routeData.bounds.north, routeData.bounds.east]
                );
                map.fitBounds(bounds, { padding: [20, 20] });
            }
        },

        zoomIn: () => {
            map.zoomIn();
        },

        zoomOut: () => {
            map.zoomOut();
        },

        toggleMouseZoom: () => {
            mouseZoomEnabled = !mouseZoomEnabled;
            const button = document.querySelector('[data-btn-id="toggle-mouse-zoom"]');

            if (mouseZoomEnabled) {
                map.scrollWheelZoom.enable();
                // Set active state (green)
                if (button) {
                    button.classList.add('active');
                    button.style.background = 'rgba(76, 175, 80, 0.8)';
                    button.style.borderColor = 'rgba(76, 175, 80, 1.0)';
                    button.style.color = 'white';
                }
            } else {
                map.scrollWheelZoom.disable();
                // Set inactive state (dark)
                if (button) {
                    button.classList.remove('active');
                    button.style.background = 'rgba(0, 0, 0, 0.8)';
                    button.style.borderColor = 'rgba(255,255,255,1.0)';
                    button.style.color = 'white';
                }
            }
        },

        toggleMapViewsPanel: () => {
            const panel = document.getElementById('map-views-panel');
            const button = document.querySelector('[data-btn-id="toggle-map-views"]');
            togglePanel(panel, button);
        },

        toggleRoutesPanel: () => {
            const panel = document.getElementById('routes-overlay-panel');
            const button = document.querySelector('[data-btn-id="toggle-routes"]');
            togglePanel(panel, button);
        },

        toggleOverlaysPanel: () => {
            const panel = document.getElementById('overlays-panel');
            const button = document.querySelector('[data-btn-id="toggle-overlays"]');
            togglePanel(panel, button);
        },

        togglePrivacyPanel: () => {
            const panel = document.getElementById('privacy-panel');
            const button = document.querySelector('[data-btn-id="toggle-privacy"]');
            togglePanel(panel, button);
        },

        updateRouteOverlay: (overlayId, isVisible) => {
            routeRenderer.updateOverlayVisibility(overlayId, isVisible);
        },

        onLegendUpdate: (overlayId) => {
            if (routeLegend) routeLegend.update(overlayId, routeRenderer);
        },

        getRouteOverlayState: () => {
            return overlayState;
        },

        updateMarkerOverlay: (overlayId, isVisible) => {
            // Update marker visibility based on overlay state
            const markerMap = {
                'maxSpeed': 'maxSpeedMarker',
                'zeroSafety': 'zeroSafetyMarkers',
                'maxElevation': 'maxElevationMarker',
                'minElevation': 'minElevationMarker',
                'maxMotorTemp': 'maxMotorTempMarker',
                'maxControllerTemp': 'maxControllerTempMarker',
                'maxBatteryTemp': 'maxBatteryTempMarker',
                'maxPower': 'maxPowerMarker',
                'maxCurrent': 'maxCurrentMarker',
                'minBattery': 'minBatteryMarker',
                'safetyMarginMin': 'safetyMarginMinMarker',
                'minVoltage': 'minVoltageMarker',
                'maxTilt': 'maxTiltMarker',
                'minTilt': 'minTiltMarker',
                'maxRoll': 'maxRollMarker',
                'minRoll': 'minRollMarker'
            };

            const markerName = markerMap[overlayId];
            if (markerName && window[markerName]) {
                if (Array.isArray(window[markerName])) {
                    // Handle marker arrays (like zeroSafetyMarkers)
                    window[markerName].forEach(marker => {
                        if (isVisible) {
                            if (!map.hasLayer(marker)) {
                                map.addLayer(marker);
                            }
                        } else {
                            if (map.hasLayer(marker)) {
                                map.removeLayer(marker);
                            }
                        }
                    });
                } else {
                    // Handle single markers
                    if (isVisible) {
                        if (!map.hasLayer(window[markerName])) {
                            map.addLayer(window[markerName]);
                        }
                    } else {
                        if (map.hasLayer(window[markerName])) {
                            map.removeLayer(window[markerName]);
                        }
                    }
                }
            }
        },

        setMapLayer: (layerType) => {
            setMapLayer(layerType, map, mapLayers);
        },

        getCurrentLayer: () => {
            return mapLayers.current;
        },

        reloadRoute: () => {
            if (routeData) {
                clearMap(map, markerRefs, routeRenderer, popupManager, privacyFilter);
                loadRouteData(routeData, map, markerRefs, markerManager, markerIcons, privacyFilter, routeRenderer, positionTracker, overlayState, panels, routeLegend);
            }
        },

        toggleFullscreen: () => {
            const container = map.getContainer();
            const button = document.querySelector('[data-btn-id="toggle-fullscreen"]');

            if (document.fullscreenElement) {
                document.exitFullscreen();
                if (button) {
                    button.classList.remove('active');
                    button.style.background = 'rgba(0, 0, 0, 0.8)';
                    button.style.borderColor = 'rgba(255,255,255,1.0)';
                    button.style.color = 'white';
                }
            } else {
                container.requestFullscreen().catch(err => {
                    console.error('[MAP] Fullscreen request failed:', err);
                });
                if (button) {
                    button.classList.add('active');
                    button.style.background = 'rgba(76, 175, 80, 0.8)';
                    button.style.borderColor = 'rgba(76, 175, 80, 1.0)';
                    button.style.color = 'white';
                }
            }

            // Leaflet needs to recalculate size after fullscreen change
            setTimeout(() => map.invalidateSize(), 100);
        },

        mouseZoomEnabled: mouseZoomEnabled
    };

    // Create UI controls
    const controlContainer = createMapControls(map, callbacks);
    map.getContainer().appendChild(controlContainer);

    // Create collapsible panels
    const panels = createCollapsiblePanels(map, overlayState, callbacks, privacyState);

    // Sync fullscreen button state when user exits via Escape key
    document.addEventListener('fullscreenchange', () => {
        const button = document.querySelector('[data-btn-id="toggle-fullscreen"]');
        if (!button) return;
        if (document.fullscreenElement) {
            button.classList.add('active');
            button.style.background = 'rgba(76, 175, 80, 0.8)';
            button.style.borderColor = 'rgba(76, 175, 80, 1.0)';
            button.style.color = 'white';
        } else {
            button.classList.remove('active');
            button.style.background = 'rgba(0, 0, 0, 0.8)';
            button.style.borderColor = 'rgba(255,255,255,1.0)';
            button.style.color = 'white';
        }
        setTimeout(() => map.invalidateSize(), 100);
    });


    return {
        map,
        mapLayers,
        overlayState,
        privacyState,
        markerRefs,
        markerManager,
        markerIcons,
        popupManager,
        privacyFilter,
        routeRenderer,
        positionTracker,
        panels,
        routeLegend,
        callbacks,
        routeData: () => routeData,
        setRouteData: (data) => { routeData = data; }
    };
}

/**
 * Load route data and render on map
 * @param {object} gpsRouteData - GPS route data
 * @param {object} map - Leaflet map instance
 * @param {object} markerRefs - Marker references
 * @param {object} markerManager - Marker manager instance
 * @param {object} markerIcons - Marker icon definitions
 * @param {object} privacyFilter - Privacy filter instance
 * @param {object} routeRenderer - Route renderer instance
 * @param {object} positionTracker - Position tracker instance
 * @param {object} overlayState - Overlay visibility state
 * @param {object} [panels] - UI panels (for route availability updates)
 * @param {object} [routeLegend] - Route legend control
 * @returns {boolean} Success status
 */
export function loadRouteData(gpsRouteData, map, markerRefs, markerManager, markerIcons, privacyFilter, routeRenderer, positionTracker, overlayState, panels, routeLegend) {

    if (!gpsRouteData || !gpsRouteData.has_gps || !gpsRouteData.route_points) {
        return false;
    }

    // Apply privacy filter to route points
    const originalTotalPoints = gpsRouteData.route_points.length;
    const filteredRoutePoints = privacyFilter.applyPrivacyFilter(gpsRouteData.route_points);

    // Render route
    const routeElements = routeRenderer.renderRoute(filteredRoutePoints);
    if (!routeElements) {
        return false;
    }

    // Set route data for position tracker
    positionTracker.setRouteData(gpsRouteData);

    // Attach mouse event handlers to hit polyline
    const hitPolyline = routeRenderer.getHitPolyline();
    if (hitPolyline) {
        hitPolyline.on('mousemove', (e) => positionTracker.onRouteMouseMove(e));
        hitPolyline.on('mouseout', (e) => positionTracker.onRouteMouseOut(e));
    }

    // Add start/end markers
    const startPoint = filteredRoutePoints[0];
    const endPoint = filteredRoutePoints[filteredRoutePoints.length - 1];

    const shouldShowStartMarker = !(privacyFilter.getState().enabled && privacyFilter.getState().hideStart);
    if (shouldShowStartMarker && markerIcons.start) {
        markerRefs.startMarker = markerManager.registerMarker(
            L.marker([startPoint.lat, startPoint.lng], {
                icon: markerIcons.start,
                title: 'Start',
                zIndexOffset: 5000
            }).addTo(map)
        );
    }

    const shouldShowEndMarker = !(privacyFilter.getState().enabled && privacyFilter.getState().hideEnd);
    if (shouldShowEndMarker && markerIcons.end) {
        markerRefs.endMarker = markerManager.registerMarker(
            L.marker([endPoint.lat, endPoint.lng], {
                icon: markerIcons.end,
                title: 'Finish',
                zIndexOffset: 5000
            }).addTo(map)
        );
    }

    // Create current position marker (initially hidden) - HIGHEST z-index
    if (markerIcons.current) {
        markerRefs.currentMarker = markerManager.registerMarker(
            L.marker([startPoint.lat, startPoint.lng], {
                icon: markerIcons.current,
                title: 'Current Position',
                interactive: false,
                zIndexOffset: 10000
            })
        );
    }

    // Add data point markers (max speed, elevations, temps, etc.)
    addDataPointMarkers(gpsRouteData, map, markerManager, markerIcons, overlayState, privacyFilter, originalTotalPoints);

    // Update route panel availability (gray out overlays with no data)
    if (panels && panels.routePanelApi) {
        panels.routePanelApi.updateAvailability(filteredRoutePoints);
    }

    // Update route legend for active overlay
    if (routeLegend) {
        const activeId = routeRenderer.getActiveOverlayId();
        if (activeId) {
            routeLegend.update(activeId, routeRenderer);
        }
    }

    // Fit map to route bounds
    if (gpsRouteData.bounds) {
        const bounds = L.latLngBounds(
            [gpsRouteData.bounds.south, gpsRouteData.bounds.west],
            [gpsRouteData.bounds.north, gpsRouteData.bounds.east]
        );
        map.fitBounds(bounds, { padding: [20, 20] });
    }

    // Update privacy badge
    privacyFilter.updatePrivacyBadge(map, originalTotalPoints, filteredRoutePoints.length);

    return true;
}

/**
 * Add data point markers (max speed, temps, etc.)
 * @private
 */
function addDataPointMarkers(routeData, map, markerManager, markerIcons, overlayState, privacyFilter, originalTotalPoints) {
    // Use new overlays array structure
    if (!routeData.overlays || routeData.overlays.length === 0) {
        return;
    }


    // Helper to handle privacy zone boundary
    const getBoundaryPoint = (overlay) => {
        if (privacyFilter.isInPrivacyZone(overlay.index, originalTotalPoints)) {
            const boundary = privacyFilter.getPrivacyBoundary(overlay.index, routeData.route_points, originalTotalPoints);
            return boundary || { lat: overlay.lat, lng: overlay.lng };
        }
        return { lat: overlay.lat, lng: overlay.lng };
    };

    // Get overlay configuration from window
    const overlayConfig = window.EUCOverlayConfig;
    if (!overlayConfig) {
        console.warn('[MAP CORE] EUCOverlayConfig not found');
        return;
    }

    // Initialize array for zeroSafety markers (can have multiple)
    if (!window.zeroSafetyMarkers) {
        window.zeroSafetyMarkers = [];
    }

    // Iterate through each overlay and create markers
    routeData.overlays.forEach(overlay => {
        const { overlayId, index, value, lat, lng } = overlay;

        // Get overlay config
        const config = overlayConfig.utils.getOverlay(overlayId);
        if (!config) {
            console.warn(`[MAP CORE] No config found for overlay: ${overlayId}`);
            return;
        }

        // Get marker icon
        const icon = markerIcons[overlayId];
        if (!icon) {
            console.warn(`[MAP CORE] No icon found for overlay: ${overlayId}`);
            return;
        }

        // Get boundary-adjusted position
        const point = getBoundaryPoint(overlay);

        // Format value with units
        const formattedValue = overlayConfig.utils.formatValue(value, overlayId);

        // Special handling for zeroSafety (multiple markers)
        if (overlayId === 'zeroSafety') {
            const marker = markerManager.registerMarker(
                L.marker([point.lat, point.lng], {
                    icon: icon,
                    title: `${config.label}: ${formattedValue}`,
                    zIndexOffset: 1000
                }),
                window,
                'zeroSafetyMarkers'
            );

            window.zeroSafetyMarkers.push(marker);

            // Add to map if overlay is enabled
            if (overlayState[overlayId]) {
                marker.addTo(map);
            }

        } else {
            // Standard single marker handling
            const markerName = `${overlayId}Marker`;
            window[markerName] = markerManager.registerMarker(
                L.marker([point.lat, point.lng], {
                    icon: icon,
                    title: `${config.label}: ${formattedValue}`,
                    zIndexOffset: 1000
                }),
                window,
                markerName
            );

            // Add to map if overlay is enabled
            if (overlayState[overlayId]) {
                window[markerName].addTo(map);
            }

        }
    });

}

/**
 * Clear all map elements
 * @param {object} map - Leaflet map instance
 * @param {object} markerRefs - Marker references
 * @param {object} routeRenderer - Route renderer instance
 * @param {object} popupManager - Popup manager instance
 * @param {object} privacyFilter - Privacy filter instance
 */
export function clearMap(map, markerRefs, routeRenderer, popupManager, privacyFilter) {

    // Clear route
    routeRenderer.clearRoute();

    // Clear markers
    if (markerRefs) {
        Object.keys(markerRefs).forEach(key => {
            if (markerRefs[key] && map.hasLayer(markerRefs[key])) {
                map.removeLayer(markerRefs[key]);
            }
            markerRefs[key] = null;
        });
    }

    // Clear popup
    popupManager.cleanup();

    // Clear privacy badge
    const privacyBadge = document.getElementById('privacy-mode-badge');
    if (privacyBadge) {
        privacyBadge.remove();
    }

    // Clear window namespace references
    window.currentRouteSegments = null;
}
