/**
 * UI Controls Module
 *
 * Manages all map UI controls:
 * - Control buttons (zoom, cycle, toggles)
 * - Collapsible panels (routes, overlays, map views, privacy)
 * - Panel content generation
 * - Overlay toggles
 * - Layer switching
 */

import { createPrivacyPanelContent } from './privacy-filter.mjs';

/**
 * Create map control buttons
 * @param {object} map - Leaflet map instance
 * @param {object} callbacks - Callback functions
 * @returns {HTMLElement} Control container element
 */
export function createMapControls(map, callbacks) {
    const controlContainer = L.DomUtil.create('div', 'custom-map-controls');
    controlContainer.style.cssText = `
        position: absolute;
        top: 10px;
        right: 10px;
        z-index: 1000;
        display: flex;
        flex-direction: column;
        gap: 8px;
    `;

    // Control buttons configuration
    const buttons = [
        {
            id: 'zoom-to-fit',
            icon: '⌖',
            title: 'Zoom to fit track',
            action: callbacks.zoomToFitTrack
        },
        {
            id: 'zoom-in',
            icon: '+',
            title: 'Zoom in',
            action: callbacks.zoomIn
        },
        {
            id: 'zoom-out',
            icon: '−',
            title: 'Zoom out',
            action: callbacks.zoomOut
        },
        {
            id: 'toggle-mouse-zoom',
            icon: '🖱',
            title: 'Toggle mouse zoom (enable/disable wheel zoom)',
            action: callbacks.toggleMouseZoom,
            isToggle: true
        },
        {
            id: 'toggle-map-views',
            icon: '🗺',
            title: 'Toggle map view controls panel',
            action: callbacks.toggleMapViewsPanel,
            isToggle: true
        },
        {
            id: 'toggle-routes',
            icon: '🛤️',
            title: 'Toggle route overlays panel',
            action: callbacks.toggleRoutesPanel,
            isToggle: true
        },
        {
            id: 'toggle-overlays',
            icon: '📍',
            title: 'Toggle marker overlays panel',
            action: callbacks.toggleOverlaysPanel,
            isToggle: true
        },
        {
            id: 'toggle-privacy',
            icon: '👁️',
            title: 'Toggle privacy mode panel (hide start/end locations)',
            action: callbacks.togglePrivacyPanel,
            isToggle: true
        },
        {
            id: 'toggle-fullscreen',
            icon: '⛶',
            title: 'Toggle fullscreen map',
            action: callbacks.toggleFullscreen,
            isToggle: true
        }
    ];

    // Create horizontal container for buttons
    const buttonContainer = L.DomUtil.create('div', 'map-control-buttons', controlContainer);
    buttonContainer.style.cssText = `
        display: flex;
        flex-direction: row;
        flex-wrap: wrap;
        gap: 8px;
        align-items: center;
        justify-content: flex-end;
    `;

    buttons.forEach(btn => {
        const button = L.DomUtil.create('button', 'map-control-btn', buttonContainer);
        button.innerHTML = btn.icon;
        button.title = btn.title;
        button.setAttribute('data-btn-id', btn.id);
        button.style.cssText = `
            width: 36px;
            height: 36px;
            min-width: 36px;
            min-height: 36px;
            max-width: 36px;
            max-height: 36px;
            border: 1px solid rgba(255,255,255,1.0);
            background: rgba(0, 0, 0, 0.8);
            border-radius: 8px;
            cursor: pointer;
            font-size: 16px;
            line-height: 1;
            color: white;
            font-weight: bold;
            display: flex;
            align-items: center;
            justify-content: center;
            flex-shrink: 0;
            overflow: hidden;
            box-sizing: border-box;
            padding: 0;
            transition: all 0.3s ease;
        `;

        // Store button reference for toggle state
        if (btn.isToggle) {
            btn.buttonElement = button;

            // Set initial state for mouse zoom toggle (disabled by default)
            if (btn.id === 'toggle-mouse-zoom' && callbacks.mouseZoomEnabled !== undefined && !callbacks.mouseZoomEnabled) {
                button.classList.remove('active');
                button.style.background = 'rgba(0, 0, 0, 0.8)';
                button.style.color = 'white';
                button.style.borderColor = 'rgba(255,255,255,1.0)';
            }
        }

        // Hover effects
        button.addEventListener('mouseenter', () => {
            if (button.classList.contains('active')) {
                // Lighter green on hover when active
                button.style.background = 'rgba(76, 175, 80, 1.0)';
                button.style.borderColor = 'rgba(76, 175, 80, 1.0)';
            } else {
                // White on hover when inactive
                button.style.background = 'rgba(255, 255, 255, 0.8)';
                button.style.borderColor = 'rgba(0,0,0,1.0)';
                button.style.color = 'black';
            }
            button.style.transform = 'scale(1.05)';
        });
        button.addEventListener('mouseleave', () => {
            if (button.classList.contains('active')) {
                // Restore active green state
                button.style.background = 'rgba(76, 175, 80, 0.8)';
                button.style.borderColor = 'rgba(76, 175, 80, 1.0)';
                button.style.color = 'white';
            } else {
                // Restore inactive dark state
                button.style.background = 'rgba(0, 0, 0, 0.8)';
                button.style.borderColor = 'rgba(255,255,255,1.0)';
                button.style.color = 'white';
            }
            button.style.transform = 'scale(1)';
        });

        // Click handler
        L.DomEvent.on(button, 'click', function(e) {
            L.DomEvent.stopPropagation(e);
            btn.action();
            // One-time action buttons: reset to default state immediately
            if (!btn.isToggle) {
                button.blur();
                button.style.background = 'rgba(0, 0, 0, 0.8)';
                button.style.borderColor = 'rgba(255,255,255,1.0)';
                button.style.color = 'white';
                button.style.transform = 'scale(1)';
            }
        });
    });

    return controlContainer;
}

/**
 * Create collapsible panels for routes, overlays, map views, and privacy
 * @param {object} map - Leaflet map instance
 * @param {object} overlayState - Overlay visibility state
 * @param {object} callbacks - Callback functions
 * @param {object} privacyState - Privacy mode state
 * @returns {object} Panel references
 */
export function createCollapsiblePanels(map, overlayState, callbacks, privacyState) {
    const panels = {};

    // Route overlays panel (dynamic from config)
    panels.routesPanel = createPanel(map, 'routes-overlay-panel');
    const routePanelResult = createRoutePanelContent(overlayState, callbacks.updateRouteOverlay, callbacks.onLegendUpdate);
    panels.routesPanel.panel.appendChild(routePanelResult.container);
    panels.routePanelApi = routePanelResult;

    // Marker overlays panel
    panels.overlaysPanel = createPanel(map, 'overlays-panel');
    const overlaysContent = createOverlayPanelContent(overlayState, callbacks.updateMarkerOverlay);
    panels.overlaysPanel.panel.appendChild(overlaysContent);

    // Map views panel
    panels.mapViewsPanel = createPanel(map, 'map-views-panel');
    const mapViewsContent = createMapViewsPanelContent(callbacks.setMapLayer, callbacks.getCurrentLayer);
    panels.mapViewsPanel.panel.appendChild(mapViewsContent);

    // Privacy mode panel
    panels.privacyPanel = createPanel(map, 'privacy-panel');
    const privacyContent = createPrivacyPanelContent(privacyState, callbacks.reloadRoute);
    panels.privacyPanel.panel.appendChild(privacyContent);

    return panels;
}

/**
 * Create a collapsible panel
 * @param {object} map - Leaflet map instance
 * @param {string} id - Panel ID
 * @returns {object} Panel elements
 */
function createPanel(map, id) {
    const panel = L.DomUtil.create('div', 'collapsible-panel', map.getContainer());
    panel.id = id;
    panel.style.cssText = `
        position: absolute;
        top: 55px;
        right: 10px;
        z-index: 999;
        background: rgba(0, 0, 0, 0.85);
        border: 2px solid rgba(255, 255, 255, 0.3);
        border-radius: 12px;
        padding: 16px;
        box-shadow: 0 4px 15px rgba(0,0,0,0.5);
        display: none;
        width: 280px;
        max-width: calc(100% - 20px);
        max-height: calc(100% - 65px);
        overflow-y: auto;
    `;

    // Prevent map interactions when clicking panel
    L.DomEvent.disableClickPropagation(panel);
    L.DomEvent.disableScrollPropagation(panel);

    return { panel };
}

/**
 * Create route panel content — data-driven from EUCOverlayConfig.routes
 * @param {object} overlayState - Overlay visibility state
 * @param {Function} updateCallback - Callback to update overlay visibility
 * @param {Function} onLegendUpdate - Callback to update the route legend
 * @returns {object} { container, updateAvailability(routePoints) }
 */
function createRoutePanelContent(overlayState, updateCallback, onLegendUpdate) {
    const container = document.createElement('div');

    // Panel header
    const header = L.DomUtil.create('div', 'panel-header', container);
    header.innerHTML = '\u{1F6E4}\uFE0F Route Overlays';
    header.style.cssText = `
        font-size: 14px;
        font-weight: bold;
        color: white;
        text-align: center;
        margin-bottom: 12px;
        padding-bottom: 8px;
        border-bottom: 1px solid rgba(255,255,255,0.2);
    `;

    // Read config
    const routeConfig = window.EUCOverlayConfig?.routes || {};
    const routeGroups = window.EUCOverlayConfig?.routeGroups || [];
    const allRouteIds = Object.keys(routeConfig);

    // Group overlays
    const grouped = {};
    for (const id of allRouteIds) {
        const cfg = routeConfig[id];
        const group = cfg.group || 'Other';
        if (!grouped[group]) grouped[group] = [];
        grouped[group].push(cfg);
    }
    // Sort within each group by order
    for (const group of Object.keys(grouped)) {
        grouped[group].sort((a, b) => (a.order || 0) - (b.order || 0));
    }

    // Track all buttons for state updates
    const buttonMap = {}; // { overlayId: buttonElement }

    // Helper to update all button visual states
    function updateAllButtonStates() {
        for (const [id, btn] of Object.entries(buttonMap)) {
            const isActive = overlayState[id];
            const isDisabled = btn.disabled;
            if (isDisabled) {
                btn.style.background = 'rgba(255, 255, 255, 0.05)';
                btn.style.borderColor = 'rgba(255, 255, 255, 0.15)';
                btn.style.opacity = '0.3';
            } else {
                btn.style.background = isActive ? 'rgba(76, 175, 80, 0.3)' : 'rgba(255, 255, 255, 0.1)';
                btn.style.borderColor = isActive ? 'rgba(76, 175, 80, 0.8)' : 'rgba(255, 255, 255, 0.3)';
                btn.style.opacity = '1';
            }
        }
    }

    // Render groups in configured order
    const orderedGroups = routeGroups.filter(g => grouped[g]);
    for (const groupName of orderedGroups) {
        // Group header
        const groupHeader = L.DomUtil.create('div', 'route-group-header', container);
        groupHeader.textContent = groupName;
        groupHeader.style.cssText = `
            font-size: 10px;
            font-weight: bold;
            color: rgba(255,255,255,0.5);
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin: 8px 0 4px 2px;
        `;

        for (const cfg of grouped[groupName]) {
            const button = L.DomUtil.create('button', 'route-btn', container);
            button.innerHTML = `${cfg.icon} ${cfg.label}`;
            button.setAttribute('data-route', cfg.id);

            const isActive = overlayState[cfg.id];
            button.style.cssText = `
                width: 100%;
                padding: 7px;
                margin-bottom: 4px;
                background: ${isActive ? 'rgba(76, 175, 80, 0.3)' : 'rgba(255, 255, 255, 0.1)'};
                border: 2px solid ${isActive ? 'rgba(76, 175, 80, 0.8)' : 'rgba(255, 255, 255, 0.3)'};
                border-radius: 6px;
                color: white;
                font-size: 13px;
                font-weight: bold;
                cursor: pointer;
                text-align: left;
                transition: all 0.2s ease;
            `;

            button.addEventListener('mouseenter', () => {
                if (button.disabled) return;
                const isCurrentlyActive = overlayState[cfg.id];
                if (!isCurrentlyActive) {
                    button.style.background = 'rgba(255, 255, 255, 0.2)';
                    button.style.borderColor = 'rgba(255, 255, 255, 0.5)';
                }
            });

            button.addEventListener('mouseleave', () => {
                if (button.disabled) return;
                const isCurrentlyActive = overlayState[cfg.id];
                if (!isCurrentlyActive) {
                    button.style.background = 'rgba(255, 255, 255, 0.1)';
                    button.style.borderColor = 'rgba(255, 255, 255, 0.3)';
                }
            });

            L.DomEvent.on(button, 'click', function(e) {
                L.DomEvent.stopPropagation(e);
                if (button.disabled) return;

                // Radio behavior: turn off all, turn on selected
                for (const id of allRouteIds) {
                    overlayState[id] = (id === cfg.id);
                }

                updateAllButtonStates();

                // Update route visibility
                for (const id of allRouteIds) {
                    updateCallback(id, overlayState[id]);
                }

                // Update legend
                if (onLegendUpdate) onLegendUpdate(cfg.id);

                console.log(`[UI CONTROLS] Switched to ${cfg.label}`);
            });

            buttonMap[cfg.id] = button;
        }
    }

    /**
     * Update button availability based on what data exists in routePoints.
     * Disables buttons for overlays with no data; if active overlay has no data,
     * switches to first available.
     */
    function updateAvailability(routePoints) {
        let activeHasData = false;
        let firstAvailable = null;

        for (const id of allRouteIds) {
            const cfg = routeConfig[id];
            const hasData = routePoints.some(p => p[cfg.field] !== null && p[cfg.field] !== undefined);
            const btn = buttonMap[id];
            if (!btn) continue;

            if (hasData) {
                btn.disabled = false;
                btn.title = cfg.label;
                if (!firstAvailable) firstAvailable = id;
                if (overlayState[id]) activeHasData = true;
            } else {
                btn.disabled = true;
                btn.title = `${cfg.label} (no data)`;
                // If this was active, deactivate it
                overlayState[id] = false;
            }
        }

        // If the active overlay lost its data, switch to first available
        if (!activeHasData && firstAvailable) {
            overlayState[firstAvailable] = true;
            updateCallback(firstAvailable, true);
            if (onLegendUpdate) onLegendUpdate(firstAvailable);
        }

        updateAllButtonStates();
    }

    return { container, updateAvailability };
}

/**
 * Create overlay panel content
 * @param {object} overlayState - Overlay visibility state
 * @param {Function} updateCallback - Callback to update overlay
 * @returns {HTMLElement} Panel content
 */
function createOverlayPanelContent(overlayState, updateCallback) {
    const container = document.createElement('div');

    // Panel header
    const header = L.DomUtil.create('div', 'panel-header', container);
    header.innerHTML = '📍 Marker Overlays';
    header.style.cssText = `
        font-size: 14px;
        font-weight: bold;
        color: white;
        text-align: center;
        margin-bottom: 12px;
        padding-bottom: 8px;
        border-bottom: 1px solid rgba(255,255,255,0.2);
    `;

    // Button row: Pulse toggle + All On/Off
    const buttonRow = L.DomUtil.create('div', 'all-buttons-row', container);
    buttonRow.style.cssText = `
        display: flex;
        gap: 8px;
        margin-bottom: 12px;
    `;

    // Pulse toggle button — reads/writes body class + localStorage (no map state needed)
    const pulseActive = document.body.classList.contains('marker-animations-enabled');
    const pulseBtn = L.DomUtil.create('button', 'pulse-toggle-btn', buttonRow);
    pulseBtn.innerHTML = 'Pulse 💫';
    pulseBtn.style.cssText = `
        flex: 1;
        padding: 6px;
        background: ${pulseActive ? 'rgba(76, 175, 80, 0.3)' : 'rgba(255, 255, 255, 0.1)'};
        border: 2px solid ${pulseActive ? 'rgba(76, 175, 80, 0.8)' : 'rgba(255, 255, 255, 0.3)'};
        border-radius: 6px;
        color: white;
        font-size: 12px;
        font-weight: bold;
        cursor: pointer;
        transition: all 0.2s ease;
    `;

    pulseBtn.addEventListener('mouseenter', () => {
        const isOn = document.body.classList.contains('marker-animations-enabled');
        if (!isOn) {
            pulseBtn.style.background = 'rgba(255, 255, 255, 0.2)';
            pulseBtn.style.borderColor = 'rgba(255, 255, 255, 0.5)';
        }
    });
    pulseBtn.addEventListener('mouseleave', () => {
        const isOn = document.body.classList.contains('marker-animations-enabled');
        pulseBtn.style.background = isOn ? 'rgba(76, 175, 80, 0.3)' : 'rgba(255, 255, 255, 0.1)';
        pulseBtn.style.borderColor = isOn ? 'rgba(76, 175, 80, 0.8)' : 'rgba(255, 255, 255, 0.3)';
    });

    L.DomEvent.on(pulseBtn, 'click', function(e) {
        L.DomEvent.stopPropagation(e);
        const nowActive = !document.body.classList.contains('marker-animations-enabled');
        if (nowActive) {
            document.body.classList.add('marker-animations-enabled');
            localStorage.setItem('markerPulse', 'true');
        } else {
            document.body.classList.remove('marker-animations-enabled');
            localStorage.setItem('markerPulse', 'false');
        }
        pulseBtn.style.background = nowActive ? 'rgba(76, 175, 80, 0.3)' : 'rgba(255, 255, 255, 0.1)';
        pulseBtn.style.borderColor = nowActive ? 'rgba(76, 175, 80, 0.8)' : 'rgba(255, 255, 255, 0.3)';
        console.log(`[UI CONTROLS] Marker pulse ${nowActive ? 'enabled' : 'disabled'}`);
    });

    const allOnBtn = L.DomUtil.create('button', 'all-on-btn', buttonRow);
    allOnBtn.innerHTML = 'All On';
    allOnBtn.style.cssText = `
        flex: 1;
        padding: 6px;
        background: rgba(76, 175, 80, 0.3);
        border: 2px solid rgba(76, 175, 80, 0.8);
        border-radius: 6px;
        color: white;
        font-size: 12px;
        font-weight: bold;
        cursor: pointer;
        transition: all 0.2s ease;
    `;

    const allOffBtn = L.DomUtil.create('button', 'all-off-btn', buttonRow);
    allOffBtn.innerHTML = 'All Off';
    allOffBtn.style.cssText = `
        flex: 1;
        padding: 6px;
        background: rgba(244, 67, 54, 0.3);
        border: 2px solid rgba(244, 67, 54, 0.8);
        border-radius: 6px;
        color: white;
        font-size: 12px;
        font-weight: bold;
        cursor: pointer;
        transition: all 0.2s ease;
    `;

    // Hover effects for buttons
    allOnBtn.addEventListener('mouseenter', () => {
        allOnBtn.style.background = 'rgba(76, 175, 80, 0.5)';
    });
    allOnBtn.addEventListener('mouseleave', () => {
        allOnBtn.style.background = 'rgba(76, 175, 80, 0.3)';
    });
    allOffBtn.addEventListener('mouseenter', () => {
        allOffBtn.style.background = 'rgba(244, 67, 54, 0.5)';
    });
    allOffBtn.addEventListener('mouseleave', () => {
        allOffBtn.style.background = 'rgba(244, 67, 54, 0.3)';
    });

    // Marker overlays (icons match overlay-config.js - single source of truth)
    const overlays = [
        { id: 'maxSpeed', label: 'Max Speed', icon: '🚀' },
        { id: 'zeroSafety', label: 'Critical Safety', icon: '💀' },
        { id: 'maxElevation', label: 'Max Elevation', icon: '🏔️' },
        { id: 'minElevation', label: 'Min Elevation', icon: '⛰️' },
        { id: 'maxControllerTemp', label: 'Max Controller Temp', icon: '🌡️' },
        { id: 'maxMotorTemp', label: 'Max Motor Temp', icon: '🌡️' },
        { id: 'maxBatteryTemp', label: 'Max Battery Temp', icon: '🌡️' },
        { id: 'maxPower', label: 'Max Power', icon: '🔌' },
        { id: 'maxCurrent', label: 'Max Current', icon: '⚡' },
        { id: 'minBattery', label: 'Battery Min', icon: '🪫' },
        { id: 'safetyMarginMin', label: 'PWM Min', icon: '🛡️' },
        { id: 'minVoltage', label: 'Voltage Min', icon: '⚡' },
        { id: 'maxTilt', label: 'Max Tilt', icon: '↗️' },
        { id: 'minTilt', label: 'Min Tilt', icon: '↙️' },
        { id: 'maxRoll', label: 'Max Roll', icon: '↪️' },
        { id: 'minRoll', label: 'Min Roll', icon: '↩️' }
    ];

    // Create scrollable container for marker list
    const scrollContainer = L.DomUtil.create('div', 'marker-scroll-container', container);
    scrollContainer.style.cssText = `
        overflow-x: hidden;
        padding-right: 4px;
    `;

    overlays.forEach(overlay => {
        const toggleContainer = createToggleRow(overlay.label, overlay.icon, overlayState[overlay.id], (checked) => {
            overlayState[overlay.id] = checked;
            updateCallback(overlay.id, checked);
        });
        scrollContainer.appendChild(toggleContainer);
    });

    // All On button handler
    L.DomEvent.on(allOnBtn, 'click', function(e) {
        L.DomEvent.stopPropagation(e);
        overlays.forEach(overlay => {
            overlayState[overlay.id] = true;
            updateCallback(overlay.id, true);
        });
        // Update all rows and checkboxes
        scrollContainer.querySelectorAll('.toggle-row').forEach(row => {
            const checkbox = row.querySelector('input[type="checkbox"]');
            if (checkbox) {
                checkbox.checked = true;
                row.style.background = 'rgba(76, 175, 80, 0.3)';
                row.style.borderColor = 'rgba(76, 175, 80, 0.8)';
            }
        });
        console.log('[UI CONTROLS] All marker overlays enabled');
    });

    // All Off button handler
    L.DomEvent.on(allOffBtn, 'click', function(e) {
        L.DomEvent.stopPropagation(e);
        overlays.forEach(overlay => {
            overlayState[overlay.id] = false;
            updateCallback(overlay.id, false);
        });
        // Update all rows and checkboxes
        scrollContainer.querySelectorAll('.toggle-row').forEach(row => {
            const checkbox = row.querySelector('input[type="checkbox"]');
            if (checkbox) {
                checkbox.checked = false;
                row.style.background = 'rgba(255, 255, 255, 0.1)';
                row.style.borderColor = 'rgba(255, 255, 255, 0.3)';
            }
        });
        console.log('[UI CONTROLS] All marker overlays disabled');
    });

    return container;
}

/**
 * Create map views panel content
 * @param {Function} setMapLayer - Callback to set map layer
 * @param {Function} getCurrentLayer - Callback to get current layer
 * @returns {HTMLElement} Panel content
 */
function createMapViewsPanelContent(setMapLayer, getCurrentLayer) {
    const container = document.createElement('div');

    // Panel header
    const header = L.DomUtil.create('div', 'panel-header', container);
    header.innerHTML = '🗺 Map Views';
    header.style.cssText = `
        font-size: 14px;
        font-weight: bold;
        color: white;
        text-align: center;
        margin-bottom: 12px;
        padding-bottom: 8px;
        border-bottom: 1px solid rgba(255,255,255,0.2);
    `;

    // Map layer buttons
    const layers = [
        { id: 'street', label: 'Street', icon: '🏙️' },
        { id: 'grayscale', label: 'Grayscale', icon: '⬜' },
        { id: 'satellite', label: 'Satellite', icon: '🛰️' },
        { id: 'cyclosm', label: 'CyclOSM', icon: '🚴' },
        { id: 'transport', label: 'Transport', icon: '🚊' },
        { id: 'topo', label: 'Topographic', icon: '🗻' },
        { id: 'humanitarian', label: 'Humanitarian', icon: '🏥' },
        { id: 'dark', label: 'Dark', icon: '🌙' },
        { id: 'terrain', label: 'Terrain', icon: '🏔️' }
    ];

    const currentLayer = getCurrentLayer();

    layers.forEach(layer => {
        const button = L.DomUtil.create('button', 'layer-btn', container);
        button.innerHTML = `${layer.icon} ${layer.label}`;
        button.setAttribute('data-layer', layer.id);

        // Check if this is the current layer
        const isActive = layer.id === currentLayer;

        button.style.cssText = `
            width: 100%;
            padding: 7px;
            margin-bottom: 6px;
            background: ${isActive ? 'rgba(76, 175, 80, 0.3)' : 'rgba(255, 255, 255, 0.1)'};
            border: 2px solid ${isActive ? 'rgba(76, 175, 80, 0.8)' : 'rgba(255, 255, 255, 0.3)'};
            border-radius: 6px;
            color: white;
            font-size: 13px;
            font-weight: bold;
            cursor: pointer;
            text-align: left;
            transition: all 0.2s ease;
        `;

        button.addEventListener('mouseenter', () => {
            // Check if this button is currently active (has green border)
            const isCurrentlyActive = button.style.borderColor.includes('80, 0.8');
            if (!isCurrentlyActive) {
                button.style.background = 'rgba(255, 255, 255, 0.2)';
                button.style.borderColor = 'rgba(255, 255, 255, 0.5)';
            }
        });

        button.addEventListener('mouseleave', () => {
            // Check if this button is currently active (has green border)
            const isCurrentlyActive = button.style.borderColor.includes('80, 0.8');
            if (!isCurrentlyActive) {
                button.style.background = 'rgba(255, 255, 255, 0.1)';
                button.style.borderColor = 'rgba(255, 255, 255, 0.3)';
            }
        });

        L.DomEvent.on(button, 'click', function(e) {
            L.DomEvent.stopPropagation(e);

            // Update all button states
            container.querySelectorAll('.layer-btn').forEach(btn => {
                const btnLayer = btn.getAttribute('data-layer');
                const btnIsActive = btnLayer === layer.id;
                btn.style.background = btnIsActive ? 'rgba(76, 175, 80, 0.3)' : 'rgba(255, 255, 255, 0.1)';
                btn.style.borderColor = btnIsActive ? 'rgba(76, 175, 80, 0.8)' : 'rgba(255, 255, 255, 0.3)';
            });

            setMapLayer(layer.id);
            console.log(`[UI CONTROLS] Switched to ${layer.label} layer`);
        });
    });

    return container;
}

/**
 * Create a toggle row for overlays
 * @param {string} label - Toggle label
 * @param {string} icon - Toggle icon
 * @param {boolean} checked - Initial checked state
 * @param {Function} onChange - Change callback
 * @returns {HTMLElement} Toggle row element
 */
function createToggleRow(label, icon, checked, onChange) {
    const container = L.DomUtil.create('div', 'toggle-row');
    container.style.cssText = `
        width: 100%;
        padding: 10px;
        margin-bottom: 4px;
        background: ${checked ? 'rgba(76, 175, 80, 0.3)' : 'rgba(255, 255, 255, 0.1)'};
        border: 2px solid ${checked ? 'rgba(76, 175, 80, 0.8)' : 'rgba(255, 255, 255, 0.3)'};
        border-radius: 6px;
        color: white;
        font-size: 13px;
        font-weight: bold;
        cursor: pointer;
        text-align: left;
        transition: all 0.2s ease;
    `;

    // Hidden checkbox for state tracking
    const checkbox = L.DomUtil.create('input', '', container);
    checkbox.type = 'checkbox';
    checkbox.checked = checked;
    checkbox.style.cssText = `
        display: none;
    `;

    // Label text
    const labelSpan = L.DomUtil.create('span', '', container);
    labelSpan.innerHTML = `${icon} ${label}`;

    // Update visual state function
    const updateVisualState = () => {
        const isChecked = checkbox.checked;
        container.style.background = isChecked ? 'rgba(76, 175, 80, 0.3)' : 'rgba(255, 255, 255, 0.1)';
        container.style.borderColor = isChecked ? 'rgba(76, 175, 80, 0.8)' : 'rgba(255, 255, 255, 0.3)';
    };

    container.addEventListener('mouseenter', () => {
        // Check if currently active (has green border)
        const isCurrentlyActive = container.style.borderColor.includes('80, 0.8');
        if (!isCurrentlyActive) {
            container.style.background = 'rgba(255, 255, 255, 0.2)';
            container.style.borderColor = 'rgba(255, 255, 255, 0.5)';
        }
    });
    container.addEventListener('mouseleave', () => {
        updateVisualState();
    });

    // Make entire container clickable
    L.DomEvent.on(container, 'click', function(e) {
        L.DomEvent.stopPropagation(e);
        checkbox.checked = !checkbox.checked;
        updateVisualState();
        onChange(checkbox.checked);
    });

    return container;
}

/**
 * Toggle panel visibility
 * @param {HTMLElement} panel - Panel element
 * @param {HTMLElement} button - Toggle button element
 */
export function togglePanel(panel, button) {
    const isVisible = panel.style.display !== 'none';

    if (isVisible) {
        // Close this panel
        panel.style.display = 'none';
        if (button) {
            button.classList.remove('active');
            button.style.background = 'rgba(0, 0, 0, 0.8)';
            button.style.borderColor = 'rgba(255,255,255,1.0)';
            button.style.color = 'white';
        }
    } else {
        // Close all other panels first
        const allPanels = document.querySelectorAll('.collapsible-panel');
        const allButtons = document.querySelectorAll('[data-btn-id^="toggle-"]');

        allPanels.forEach(p => {
            if (p !== panel) {
                p.style.display = 'none';
            }
        });

        allButtons.forEach(btn => {
            if (btn !== button && btn.classList.contains('active')) {
                btn.classList.remove('active');
                btn.style.background = 'rgba(0, 0, 0, 0.8)';
                btn.style.borderColor = 'rgba(255,255,255,1.0)';
                btn.style.color = 'white';
            }
        });

        // Open this panel
        panel.style.display = 'block';
        if (button) {
            button.classList.add('active');
            button.style.background = 'rgba(255, 255, 255, 0.9)';
            button.style.borderColor = 'rgba(0,0,0,1.0)';
            button.style.color = 'black';
        }
    }
}

/**
 * Set map layer
 * @param {string} layerType - Layer type identifier
 * @param {object} map - Leaflet map instance
 * @param {object} mapLayers - Map layer objects
 */
export function setMapLayer(layerType, map, mapLayers) {
    // Remove all layers first (skip 'current' property which stores the active layer name)
    Object.keys(mapLayers).forEach(key => {
        if (key === 'current') return;  // Skip the current layer name string
        if (mapLayers[key] && map.hasLayer(mapLayers[key])) {
            map.removeLayer(mapLayers[key]);
        }
    });

    // Add selected layer
    if (mapLayers[layerType]) {
        mapLayers[layerType].addTo(map);
        mapLayers.current = layerType;
        console.log(`[UI CONTROLS] Switched to ${layerType} layer`);
    } else {
        console.warn(`[UI CONTROLS] Layer ${layerType} not found`);
    }
}

/**
 * Create route legend Leaflet control (bottom-right).
 * Shows active overlay name, color gradient bar, and min/max values.
 * @param {object} map - Leaflet map instance
 * @returns {object} { update(overlayId, routeRenderer), hide() }
 */
export function createRouteLegend(map) {
    const LegendControl = L.Control.extend({
        options: { position: 'bottomright' },

        onAdd: function() {
            const div = L.DomUtil.create('div', 'route-legend-control');
            div.style.cssText = `
                background: rgba(0, 0, 0, 0.75);
                border: 1px solid rgba(255, 255, 255, 0.3);
                border-radius: 8px;
                padding: 8px 12px;
                color: white;
                font-size: 12px;
                min-width: 140px;
                max-width: 200px;
                display: none;
                pointer-events: auto;
            `;
            L.DomEvent.disableClickPropagation(div);
            this._container = div;
            return div;
        }
    });

    const control = new LegendControl();
    control.addTo(map);

    return {
        update(overlayId, routeRenderer) {
            const container = control._container;
            if (!container) return;

            const stats = routeRenderer.getActiveOverlayStats();
            if (!stats || !stats.config) {
                container.style.display = 'none';
                return;
            }

            const cfg = stats.config;
            const min = stats.min;
            const max = stats.max;

            // Use legendLabels if defined, otherwise show data min/max
            let minLabel, maxLabel;
            if (cfg.legendLabels) {
                minLabel = cfg.legendLabels[0];
                maxLabel = cfg.legendLabels[cfg.legendLabels.length - 1];
            } else {
                minLabel = min.toFixed(cfg.decimals) + cfg.unit;
                maxLabel = max.toFixed(cfg.decimals) + cfg.unit;
            }

            container.innerHTML = `
                <div style="font-weight: bold; margin-bottom: 4px;">${cfg.icon} ${cfg.label}</div>
                <div style="height: 12px; border-radius: 3px; background: ${cfg.legendGradient}; margin-bottom: 4px;"></div>
                <div style="display: flex; justify-content: space-between; font-size: 10px; opacity: 0.8;">
                    <span>${minLabel}</span>
                    <span>${maxLabel}</span>
                </div>
            `;
            container.style.display = 'block';
        },

        hide() {
            if (control._container) {
                control._container.style.display = 'none';
            }
        }
    };
}
