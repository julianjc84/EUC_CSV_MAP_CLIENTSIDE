/**
 * Popup Manager Module
 *
 * Manages popup display for GPS markers:
 * - Popup creation and styling
 * - Content generation
 * - Position management
 * - Debug visualization
 */

import { hexToRgba } from './map-utils.mjs';

/**
 * Create popup manager
 * @param {object} map - Leaflet map instance
 * @returns {object} PopupManager instance
 */
export function createPopupManager(map) {
    let independentPopup = null;
    let popupIsOpen = false;
    let cachedPopupElement = null; // Cache DOM element for fast updates
    let lastUpdateTime = 0;
    const UPDATE_THROTTLE = 16; // Max 60fps updates

    // Inject popup transparency CSS if not already present
    if (!document.getElementById('popup-transparent-style')) {
        const style = document.createElement('style');
        style.id = 'popup-transparent-style';
        style.textContent = `
            .independent-data-popup .leaflet-popup-content-wrapper {
                background: transparent !important;
                pointer-events: none !important;
                border: none !important;
                box-shadow: none !important;
                padding: 0 !important;
                margin: 0 !important;
                pointer-events: none !important;
            }
            .independent-data-popup .leaflet-popup-content {
                background: transparent !important;
                border: none !important;
                pointer-events: auto !important;
            }
            .independent-data-popup .leaflet-popup-tip-container {
                display: none !important;
            }
            .independent-data-popup .leaflet-popup-tip {
                display: none !important;
            }
        `;
        document.head.appendChild(style);
    }

    return {
        /**
         * Show independent popup at marker position
         * @param {object} gpsPoint - GPS data point
         * @param {object} markerPosition - Leaflet LatLng position
         */
        showIndependentPopup(gpsPoint, markerPosition) {
            if (!map || !gpsPoint) return;

            // Throttle updates to 60fps max
            const now = performance.now();
            if (now - lastUpdateTime < UPDATE_THROTTLE) {
                return; // Skip this update
            }
            lastUpdateTime = now;

            // Calculate offset position (centered horizontally, 30px up from marker)
            const markerPixel = map.latLngToContainerPoint(markerPosition);
            const popupPixel = L.point(markerPixel.x, markerPixel.y - 30);
            const popupLatLng = map.containerPointToLatLng(popupPixel);

            // Reuse existing popup if it exists, or create new one
            if (!independentPopup) {
                independentPopup = L.popup({
                    closeButton: false,
                    autoClose: false,
                    closeOnClick: false,
                    closeOnEscapeKey: false,
                    className: 'independent-data-popup',
                    autoPan: false  // Disable automatic panning when popup goes off-screen
                });

                // Create initial popup content (only once!)
                const popupContent = createInfoPopup(gpsPoint);
                independentPopup.setContent(popupContent);
            }

            // Update position
            independentPopup.setLatLng(popupLatLng);

            // Update popup content if values changed or popup just opened
            if (!popupIsOpen) {
                // First time opening - set content
                const popupContent = createInfoPopup(gpsPoint);
                independentPopup.setContent(popupContent);
                independentPopup.openOn(map);
                popupIsOpen = true;

                // Remove unwanted DOM elements after popup is created and cache the element
                setTimeout(() => {
                    const popupElement = document.querySelector('.independent-data-popup');
                    if (popupElement) {
                        // Cache the popup content wrapper for fast updates
                        cachedPopupElement = popupElement.querySelector('.leaflet-popup-content');

                        // Remove tip container and tip elements entirely
                        const tipContainer = popupElement.querySelector('.leaflet-popup-tip-container');
                        const tip = popupElement.querySelector('.leaflet-popup-tip');

                        if (tipContainer) {
                            tipContainer.remove();
                        }
                        if (tip) {
                            tip.remove();
                        }

                        // Make wrapper exactly fit content with no extra area
                        const wrapper = popupElement.querySelector('.leaflet-popup-content-wrapper');
                        const content = popupElement.querySelector('.leaflet-popup-content');
                        if (wrapper && content) {
                            wrapper.style.cssText += `
                                width: fit-content !important;
                                height: fit-content !important;
                                padding: 0 !important;
                                margin: 0 !important;
                                border: none !important;
                                box-shadow: none !important;
                                background: transparent !important;
                                min-width: 0 !important;
                                min-height: 0 !important;
                                max-width: none !important;
                                max-height: none !important;
                                pointer-events: none !important;
                            `;

                            // Make content area compact with fixed width
                            content.style.cssText += `
                                margin: 0 !important;
                                padding: 4px 8px !important;
                                width: 250px !important;
                                height: fit-content !important;
                                pointer-events: auto !important;
                            `;
                        }
                    }
                }, 10);
            } else {
                // Popup is already open - update content using cached element for performance
                if (cachedPopupElement) {
                    const popupContent = createInfoPopup(gpsPoint);
                    cachedPopupElement.innerHTML = popupContent;
                }
            }
        },

        /**
         * Hide independent popup
         */
        hideIndependentPopup() {
            if (independentPopup && map && popupIsOpen) {
                map.closePopup(independentPopup);
                popupIsOpen = false;
            }
        },

        /**
         * Hide all popups
         */
        hidePopup() {
            try {
                this.hideIndependentPopup();
            } catch (e) {
                console.error('[POPUP MANAGER] Error hiding popup:', e);
            }
        },

        /**
         * Check if popup is currently open
         * @returns {boolean} True if popup is open
         */
        isOpen() {
            return popupIsOpen;
        },

        /**
         * Cleanup popup resources
         */
        cleanup() {
            this.hideIndependentPopup();
            independentPopup = null;
            popupIsOpen = false;
        }
    };
}

/**
 * Create popup content HTML for GPS data point
 * @param {object} gpsPoint - GPS data point
 * @returns {string} HTML string for popup content
 */
function createInfoPopup(gpsPoint) {
    const date = new Date(gpsPoint.timestamp);
    const timeStr = date.toLocaleTimeString();
    const toFixedOr = (v, n = 1) => (v === null || v === undefined) ? '—' : Number(v).toFixed(n);

    // Color mapping to match graph trace definitions exactly
    const traceColors = {
        'Wheel Speed': '#885b3e',
        'GPS Speed': '#00d000',
        'Altitude': '#b0b0b0',
        'Battery': '#000000',
        'Safety M.': '#006000',
        'Power': '#440064',
        'Energy': '#00AA00',
        'Voltage': '#003366',
        'Current': '#8B4513',
        'Temp': '#A02000',
        'Temp Motor': '#777777',
        'Temp Batt': '#FFD700'
    };

    // Build a compact, consistent overlay with up to 12 data items
    // Order matches the graph layout: Speed/GPS → Battery/Safety → Power/Energy → Temperatures → Voltage/Current
    const items = [
        { label: 'Wheel Speed', value: gpsPoint.wheel_speed, suffix: ' km/h', digits: 1 },
        { label: 'GPS Speed',   value: gpsPoint.speed,       suffix: ' km/h', digits: 1 },
        { label: 'Altitude',    value: gpsPoint.altitude,    suffix: ' m',    digits: 0 },
        { label: 'PWM',         value: gpsPoint.pwm,         suffix: ' %',    digits: 0 },
        { label: 'Battery',     value: gpsPoint.battery,     suffix: ' %',    digits: 0 },
        { label: 'Energy',      value: gpsPoint.energy_consumption, suffix: ' Wh/km', digits: 1 },
        { label: 'Power',       value: gpsPoint.power,       suffix: ' W',    digits: 0 },
        { label: 'Temp',        value: gpsPoint.temp,        suffix: ' °C',   digits: 1 },
        { label: 'Temp Motor',  value: gpsPoint.temp_motor,  suffix: ' °C',   digits: 1 },
        { label: 'Temp Batt',   value: gpsPoint.temp_batt,   suffix: ' °C',   digits: 1 },
        { label: 'Current',     value: gpsPoint.current,     suffix: ' A',    digits: 1 },
        { label: 'Voltage',     value: gpsPoint.voltage,     suffix: ' V',    digits: 1 },
    ];

    const rows = items
        .map(it => {
            const bgColor = traceColors[it.label] || '#666666';
            const rgbaColor = hexToRgba(bgColor, 0.8); // 80% opacity
            return `<div style="background-color: ${rgbaColor}; padding: 2px 6px; margin: 1px 0; border-radius: 3px; color: white; text-shadow: 0 1px 1px rgba(0,0,0,0.3); white-space: nowrap;"><b>${it.label}:</b> ${toFixedOr(it.value, it.digits)}${it.suffix}</div>`;
        })
        .join('');

    return `
        <div style="font-size: 12px; line-height: 1.25;">
            <div style="background-color: rgba(70,70,70,0.8); padding: 2px 6px; margin: 1px 0; border-radius: 3px; color: white; text-shadow: 0 1px 1px rgba(0,0,0,0.3); white-space: nowrap;"><b>Time:</b> ${timeStr}</div>
            <div style="background-color: rgba(70,70,70,0.8); padding: 2px 6px; margin: 1px 0; border-radius: 3px; color: white; text-shadow: 0 1px 1px rgba(0,0,0,0.3); white-space: nowrap;"><b>Distance:</b> ${toFixedOr(gpsPoint.distance, 2)} km</div>
            <div style="background-color: rgba(70,70,70,0.8); padding: 2px 6px; margin: 1px 0; border-radius: 3px; color: white; text-shadow: 0 1px 1px rgba(0,0,0,0.3); white-space: nowrap;"><b>Lat/Lng:</b> ${gpsPoint.lat.toFixed(6)}, ${gpsPoint.lng.toFixed(6)}</div>
            ${rows}
        </div>
    `;
}

/**
 * Clean up debug visualization boxes
 */
export function cleanupDebugBoxes() {
    const boundingBox = document.getElementById('popup-bounding-box');
    if (boundingBox) {
        boundingBox.remove();
    }
    const edgeBox = document.getElementById('edge-detection-box');
    if (edgeBox) {
        edgeBox.remove();
    }
}
