/**
 * Marker Manager Module
 *
 * Manages GPS map markers including:
 * - Marker registration and cleanup
 * - Marker style creation
 * - Special marker creation (start, end, current position)
 */

/**
 * Creates a marker manager for tracking and cleanup
 * @returns {object} MarkerManager instance
 */
export function createMarkerManager() {
    // Centralized marker registry for easy cleanup
    const allMarkers = {
        local: [],  // Markers stored in local variables (currentMarker, startMarker, etc.)
        window: []  // Markers stored in window namespace (window.maxSpeedMarker, etc.)
    };

    return {
        /**
         * Register a marker for automatic cleanup
         * @param {object} marker - Leaflet marker instance
         * @param {object} targetObject - Object storing the marker (window or local)
         * @param {string} propertyName - Property name if storing on window
         * @returns {object} The marker (for chaining)
         */
        registerMarker(marker, targetObject, propertyName) {
            if (!marker) return marker;

            if (targetObject === window) {
                allMarkers.window.push({ obj: window, prop: propertyName });
            } else {
                allMarkers.local.push(marker);
            }
            return marker;
        },

        /**
         * Clear all registered markers from the map
         * @param {object} map - Leaflet map instance
         * @param {object} refs - Object containing marker references to clear
         */
        clearAllMarkers(map, refs) {
            // Clear local markers
            allMarkers.local.forEach(marker => {
                if (marker && map && map.hasLayer(marker)) {
                    map.removeLayer(marker);
                }
            });
            allMarkers.local = [];

            // Clear window namespace markers
            allMarkers.window.forEach(({obj, prop}) => {
                if (obj[prop]) {
                    if (Array.isArray(obj[prop])) {
                        // Handle marker arrays like window.zeroSafetyMarkers
                        obj[prop].forEach(marker => {
                            if (map && map.hasLayer(marker)) {
                                map.removeLayer(marker);
                            }
                        });
                        obj[prop] = [];
                    } else {
                        // Handle single markers
                        if (map && map.hasLayer(obj[prop])) {
                            map.removeLayer(obj[prop]);
                        }
                        obj[prop] = null;
                    }
                }
            });
            allMarkers.window = [];

            // Clear individual marker references
            if (refs) {
                refs.currentMarker = null;
                refs.startMarker = null;
                refs.endMarker = null;
                refs.timeRangeStartMarker = null;
                refs.timeRangeEndMarker = null;
            }
        },

        /**
         * Get marker registry for debugging
         * @returns {object} Marker registry
         */
        getRegistry() {
            return allMarkers;
        }
    };
}

/**
 * Create marker icon styles
 * @returns {object} Object containing all marker icon definitions
 */
export function createMarkerStyles() {
    // Custom marker icons
    const markerIcons = {
        start: L.divIcon({
            className: 'gps-start-marker',
            html: '<div style="background: white; width: 24px; height: 24px; border-radius: 50%; border: 2px solid #28a745; box-shadow: 0 2px 5px rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center; font-size: 14px;">🏠</div>',
            iconSize: [24, 24],
            iconAnchor: [12, 12]
        }),
        end: L.divIcon({
            className: 'gps-end-marker',
            html: '<div style="background: white; width: 24px; height: 24px; border-radius: 50%; border: 2px solid black; box-shadow: 0 3px 10px rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center; font-size: 14px;">🏁</div>',
            iconSize: [24, 24],
            iconAnchor: [12, 12]
        }),
        current: L.divIcon({
            className: 'gps-current-marker',
            html: '<div style="background: #007bff; width: 16px; height: 16px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 8px rgba(0,123,255,0.5);"></div>',
            iconSize: [16, 16],
            iconAnchor: [8, 8]
        }),
        maxSpeed: L.divIcon({
            className: 'gps-max-speed-marker',
            html: window.EUCOverlayConfig?.utils ? window.EUCOverlayConfig.utils.createMarkerHTML('maxSpeed', 24) : (console.error('[MARKER MANAGER] EUCOverlayConfig not loaded for maxSpeed marker'), '<div style="background: red; width: 24px; height: 24px; border-radius: 50%; border: 2px solid white; display: flex; align-items: center; justify-content: center; font-size: 14px;">❌</div>'),
            iconSize: [24, 24],
            iconAnchor: [12, 12]
        }),
        lowSafety: L.divIcon({
            className: 'gps-low-safety-marker',
            html: window.EUCOverlayConfig?.utils ? window.EUCOverlayConfig.utils.createMarkerHTML('lowSafety', 24) : (console.error('[MARKER MANAGER] EUCOverlayConfig not loaded for lowSafety marker'), '<div style="background: red; width: 24px; height: 24px; border-radius: 50%; border: 2px solid white; display: flex; align-items: center; justify-content: center; font-size: 14px;">❌</div>'),
            iconSize: [24, 24],
            iconAnchor: [12, 12]
        }),
        zeroSafety: L.divIcon({
            className: 'gps-zero-safety-marker',
            html: window.EUCOverlayConfig?.utils ? window.EUCOverlayConfig.utils.createMarkerHTML('lowSafety', 24) : (console.error('[MARKER MANAGER] EUCOverlayConfig not loaded for zeroSafety marker'), '<div style="background: red; width: 24px; height: 24px; border-radius: 50%; border: 2px solid white; display: flex; align-items: center; justify-content: center; font-size: 14px;">❌</div>'),
            iconSize: [24, 24],
            iconAnchor: [12, 12]
        }),
        maxElevation: L.divIcon({
            className: 'gps-max-elevation-marker',
            html: window.EUCOverlayConfig?.utils ? window.EUCOverlayConfig.utils.createMarkerHTML('maxElevation', 24) : (console.error('[MARKER MANAGER] EUCOverlayConfig not loaded for maxElevation marker'), '<div style="background: red; width: 24px; height: 24px; border-radius: 50%; border: 2px solid white; display: flex; align-items: center; justify-content: center; font-size: 14px;">❌</div>'),
            iconSize: [24, 24],
            iconAnchor: [12, 12]
        }),
        minElevation: L.divIcon({
            className: 'gps-min-elevation-marker',
            html: window.EUCOverlayConfig?.utils ? window.EUCOverlayConfig.utils.createMarkerHTML('minElevation', 24) : (console.error('[MARKER MANAGER] EUCOverlayConfig not loaded for minElevation marker'), '<div style="background: red; width: 24px; height: 24px; border-radius: 50%; border: 2px solid white; display: flex; align-items: center; justify-content: center; font-size: 14px;">❌</div>'),
            iconSize: [24, 24],
            iconAnchor: [12, 12]
        }),
        maxMotorTemp: L.divIcon({
            className: 'gps-max-motor-temp-marker',
            html: window.EUCOverlayConfig?.utils ? window.EUCOverlayConfig.utils.createMarkerHTML('maxMotorTemp', 24) : (console.error('[MARKER MANAGER] EUCOverlayConfig not loaded for maxMotorTemp marker'), '<div style="background: red; width: 24px; height: 24px; border-radius: 50%; border: 2px solid white; display: flex; align-items: center; justify-content: center; font-size: 14px;">❌</div>'),
            iconSize: [24, 24],
            iconAnchor: [12, 12]
        }),
        maxControllerTemp: L.divIcon({
            className: 'gps-max-controller-temp-marker',
            html: window.EUCOverlayConfig?.utils ? window.EUCOverlayConfig.utils.createMarkerHTML('maxControllerTemp', 24) : (console.error('[MARKER MANAGER] EUCOverlayConfig not loaded for maxControllerTemp marker'), '<div style="background: red; width: 24px; height: 24px; border-radius: 50%; border: 2px solid white; display: flex; align-items: center; justify-content: center; font-size: 14px;">❌</div>'),
            iconSize: [24, 24],
            iconAnchor: [12, 12]
        }),
        maxBatteryTemp: L.divIcon({
            className: 'gps-max-battery-temp-marker',
            html: window.EUCOverlayConfig?.utils ? window.EUCOverlayConfig.utils.createMarkerHTML('maxBatteryTemp', 24) : (console.error('[MARKER MANAGER] EUCOverlayConfig not loaded for maxBatteryTemp marker'), '<div style="background: red; width: 24px; height: 24px; border-radius: 50%; border: 2px solid white; display: flex; align-items: center; justify-content: center; font-size: 14px;">❌</div>'),
            iconSize: [24, 24],
            iconAnchor: [12, 12]
        }),
        maxPower: L.divIcon({
            className: 'gps-max-power-marker',
            html: window.EUCOverlayConfig?.utils ? window.EUCOverlayConfig.utils.createMarkerHTML('maxPower', 24) : (console.error('[MARKER MANAGER] EUCOverlayConfig not loaded for maxPower marker'), '<div style="background: red; width: 24px; height: 24px; border-radius: 50%; border: 2px solid white; display: flex; align-items: center; justify-content: center; font-size: 14px;">❌</div>'),
            iconSize: [24, 24],
            iconAnchor: [12, 12]
        }),
        maxCurrent: L.divIcon({
            className: 'gps-max-current-marker',
            html: window.EUCOverlayConfig?.utils ? window.EUCOverlayConfig.utils.createMarkerHTML('maxCurrent', 24) : (console.error('[MARKER MANAGER] EUCOverlayConfig not loaded for maxCurrent marker'), '<div style="background: red; width: 24px; height: 24px; border-radius: 50%; border: 2px solid white; display: flex; align-items: center; justify-content: center; font-size: 14px;">❌</div>'),
            iconSize: [24, 24],
            iconAnchor: [12, 12]
        }),
        minBattery: L.divIcon({
            className: 'gps-battery-min-marker',
            html: window.EUCOverlayConfig?.utils ? window.EUCOverlayConfig.utils.createMarkerHTML('minBattery', 24) : (console.error('[MARKER MANAGER] EUCOverlayConfig not loaded for minBattery marker'), '<div style="background: red; width: 24px; height: 24px; border-radius: 50%; border: 2px solid white; display: flex; align-items: center; justify-content: center; font-size: 14px;">❌</div>'),
            iconSize: [24, 24],
            iconAnchor: [12, 12]
        }),
        safetyMarginMin: L.divIcon({
            className: 'gps-safety-margin-min-marker',
            html: window.EUCOverlayConfig?.utils ? window.EUCOverlayConfig.utils.createMarkerHTML('safetyMarginMin', 24) : (console.error('[MARKER MANAGER] EUCOverlayConfig not loaded for safetyMarginMin marker'), '<div style="background: red; width: 24px; height: 24px; border-radius: 50%; border: 2px solid white; display: flex; align-items: center; justify-content: center; font-size: 14px;">❌</div>'),
            iconSize: [24, 24],
            iconAnchor: [12, 12]
        }),
        minVoltage: L.divIcon({
            className: 'gps-min-voltage-marker',
            html: window.EUCOverlayConfig?.utils ? window.EUCOverlayConfig.utils.createMarkerHTML('minVoltage', 24) : (console.error('[MARKER MANAGER] EUCOverlayConfig not loaded for minVoltage marker'), '<div style="background: red; width: 24px; height: 24px; border-radius: 50%; border: 2px solid white; display: flex; align-items: center; justify-content: center; font-size: 14px;">❌</div>'),
            iconSize: [24, 24],
            iconAnchor: [12, 12]
        }),
        maxTilt: L.divIcon({
            className: 'gps-max-tilt-marker',
            html: window.EUCOverlayConfig?.utils ? window.EUCOverlayConfig.utils.createMarkerHTML('maxTilt', 24) : (console.error('[MARKER MANAGER] EUCOverlayConfig not loaded for maxTilt marker'), '<div style="background: red; width: 24px; height: 24px; border-radius: 50%; border: 2px solid white; display: flex; align-items: center; justify-content: center; font-size: 14px;">❌</div>'),
            iconSize: [24, 24],
            iconAnchor: [12, 12]
        }),
        minTilt: L.divIcon({
            className: 'gps-min-tilt-marker',
            html: window.EUCOverlayConfig?.utils ? window.EUCOverlayConfig.utils.createMarkerHTML('minTilt', 24) : (console.error('[MARKER MANAGER] EUCOverlayConfig not loaded for minTilt marker'), '<div style="background: red; width: 24px; height: 24px; border-radius: 50%; border: 2px solid white; display: flex; align-items: center; justify-content: center; font-size: 14px;">❌</div>'),
            iconSize: [24, 24],
            iconAnchor: [12, 12]
        }),
        maxRoll: L.divIcon({
            className: 'gps-max-roll-marker',
            html: window.EUCOverlayConfig?.utils ? window.EUCOverlayConfig.utils.createMarkerHTML('maxRoll', 24) : (console.error('[MARKER MANAGER] EUCOverlayConfig not loaded for maxRoll marker'), '<div style="background: red; width: 24px; height: 24px; border-radius: 50%; border: 2px solid white; display: flex; align-items: center; justify-content: center; font-size: 14px;">❌</div>'),
            iconSize: [24, 24],
            iconAnchor: [12, 12]
        }),
        minRoll: L.divIcon({
            className: 'gps-min-roll-marker',
            html: window.EUCOverlayConfig?.utils ? window.EUCOverlayConfig.utils.createMarkerHTML('minRoll', 24) : (console.error('[MARKER MANAGER] EUCOverlayConfig not loaded for minRoll marker'), '<div style="background: red; width: 24px; height: 24px; border-radius: 50%; border: 2px solid white; display: flex; align-items: center; justify-content: center; font-size: 14px;">❌</div>'),
            iconSize: [24, 24],
            iconAnchor: [12, 12]
        })
    };

    // Add CSS animations for markers
    const style = document.createElement('style');
    style.textContent = `
        @keyframes pulse {
            0% { transform: scale(1); opacity: 1; }
            50% { transform: scale(1.2); opacity: 0.7; }
            100% { transform: scale(1); opacity: 1; }
        }
        @keyframes skullPulse {
            0% { transform: scale(1); box-shadow: 0 3px 10px rgba(0,0,0,0.7); }
            50% { transform: scale(1.3); box-shadow: 0 5px 20px rgba(0,0,0,0.9); }
            100% { transform: scale(1); box-shadow: 0 3px 10px rgba(0,0,0,0.7); }
        }
        @keyframes rocketPulse {
            0% { transform: scale(1) rotate(0deg); box-shadow: 0 3px 10px rgba(255,107,53,0.6); }
            50% { transform: scale(1.15) rotate(5deg); box-shadow: 0 5px 15px rgba(255,107,53,0.8); }
            100% { transform: scale(1) rotate(0deg); box-shadow: 0 3px 10px rgba(255,107,53,0.6); }
        }
        @keyframes mountainPulse {
            0% { transform: scale(1); box-shadow: 0 3px 10px rgba(111,125,134,0.6); }
            50% { transform: scale(1.15); box-shadow: 0 5px 15px rgba(111,125,134,0.8); }
            100% { transform: scale(1); box-shadow: 0 3px 10px rgba(111,125,134,0.6); }
        }
        @keyframes tempPulse {
            0% { transform: scale(1); box-shadow: 0 3px 10px rgba(220,53,69,0.6); }
            50% { transform: scale(1.2); box-shadow: 0 5px 15px rgba(220,53,69,0.8); }
            100% { transform: scale(1); box-shadow: 0 3px 10px rgba(220,53,69,0.6); }
        }
        @keyframes firePulse {
            0% { transform: scale(1); box-shadow: 0 3px 10px rgba(255,71,87,0.6), inset 0 0 10px rgba(255,255,255,0.3); }
            50% { transform: scale(1.25); box-shadow: 0 5px 20px rgba(255,71,87,0.9), inset 0 0 15px rgba(255,255,255,0.5); }
            100% { transform: scale(1); box-shadow: 0 3px 10px rgba(255,71,87,0.6), inset 0 0 10px rgba(255,255,255,0.3); }
        }
        @keyframes plugPulse {
            0% { transform: scale(1); box-shadow: 0 3px 10px rgba(255,193,7,0.6); }
            50% { transform: scale(1.15); box-shadow: 0 5px 15px rgba(255,193,7,0.9); }
            100% { transform: scale(1); box-shadow: 0 3px 10px rgba(255,193,7,0.6); }
        }
        @keyframes currentPulse {
            0% { transform: scale(1) rotate(0deg); box-shadow: 0 3px 10px rgba(23,162,184,0.6); }
            25% { transform: scale(1.1) rotate(-3deg); box-shadow: 0 4px 12px rgba(23,162,184,0.7); }
            50% { transform: scale(1.2) rotate(3deg); box-shadow: 0 5px 15px rgba(23,162,184,0.9); }
            75% { transform: scale(1.1) rotate(-2deg); box-shadow: 0 4px 12px rgba(23,162,184,0.7); }
            100% { transform: scale(1) rotate(0deg); box-shadow: 0 3px 10px rgba(23,162,184,0.6); }
        }
        @keyframes batteryMinPulse {
            0% { transform: scale(1); box-shadow: 0 3px 10px rgba(220,53,69,0.6); opacity: 0.9; }
            33% { transform: scale(0.85); box-shadow: 0 2px 8px rgba(220,53,69,0.4); opacity: 0.6; }
            66% { transform: scale(1.1); box-shadow: 0 4px 12px rgba(220,53,69,0.8); opacity: 1; }
            100% { transform: scale(1); box-shadow: 0 3px 10px rgba(220,53,69,0.6); opacity: 0.9; }
        }
        @keyframes tiltPulse {
            0% { transform: scale(1) rotate(0deg); box-shadow: 0 3px 10px rgba(255,107,53,0.6); }
            50% { transform: scale(1.15) rotate(3deg); box-shadow: 0 5px 15px rgba(255,107,53,0.8); }
            100% { transform: scale(1) rotate(0deg); box-shadow: 0 3px 10px rgba(255,107,53,0.6); }
        }
        @keyframes rollPulse {
            0% { transform: scale(1) rotate(0deg); box-shadow: 0 3px 10px rgba(155,89,182,0.6); }
            50% { transform: scale(1.15) rotate(-3deg); box-shadow: 0 5px 15px rgba(155,89,182,0.8); }
            100% { transform: scale(1) rotate(0deg); box-shadow: 0 3px 10px rgba(155,89,182,0.6); }
        }
    `;

    // Note: These fallback animations ensure GPS map works even if overlay config fails to load
    document.head.appendChild(style);

    return markerIcons;
}

/**
 * Create scissors icon for time range markers
 * @param {string} color - 'green' or 'red'
 * @param {string} label - Label text for the marker
 * @returns {object} Leaflet divIcon
 */
export function createScissorsIcon(color, label) {
    const borderColor = color === 'green' ? '#28a745' : '#dc3545'; // Bootstrap green/red colors
    const labelText = color === 'green' ? 'Trim Start' : 'Trim End';
    return L.divIcon({
        html: `
            <div style="display: flex; align-items: center; gap: 8px; width: 120px; height: 28px;">
                <div style="background: white; width: 24px; height: 24px; border-radius: 50%; border: 2px solid ${borderColor}; box-shadow: 0 3px 10px rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center; font-size: 12px; flex-shrink: 0;">✂️</div>
                <div style="background: rgba(255,255,255,0.9); border: 1px solid ${borderColor}; border-radius: 4px; padding: 2px 6px; font-size: 11px; font-weight: bold; color: ${borderColor}; white-space: nowrap; box-shadow: 0 2px 4px rgba(0,0,0,0.2);">${labelText}</div>
            </div>
        `,
        iconSize: [120, 28],
        iconAnchor: [12, 14],
        className: 'time-range-marker',
        popupAnchor: [0, -14]
    });
}
