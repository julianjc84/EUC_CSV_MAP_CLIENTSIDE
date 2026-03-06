/**
 * UI Controls Module
 *
 * Manages all map UI controls:
 * - Control buttons (zoom, cycle, toggles)
 * - Collapsible panels (routes, overlays, map views, privacy)
 * - Panel content generation
 * - Overlay toggles
 * - Layer switching
 *
 * All visual styling uses CSS classes from styles.css (map-ctrl-btn, map-panel-btn,
 * map-panel, map-panel-header, map-toggle-row). No hardcoded RGBA colors in JS.
 */

import { createPrivacyPanelContent } from './privacy-filter.mjs';

// ==================== Helpers ====================

/**
 * Create a styled panel header
 * @param {HTMLElement} container - Parent element
 * @param {string} icon - Emoji icon
 * @param {string} title - Header title text
 * @returns {HTMLElement} Header element
 */
function createPanelHeader(container, icon, title) {
    const header = L.DomUtil.create('div', 'map-panel-header', container);
    header.innerHTML = `${icon} ${title}`;
    return header;
}

// ==================== Main Controls ====================

/**
 * Create map control buttons
 * @param {object} map - Leaflet map instance
 * @param {object} callbacks - Callback functions
 * @returns {HTMLElement} Control container element
 */
export function createMapControls(map, callbacks) {
    const controlContainer = L.DomUtil.create('div', 'custom-map-controls');

    // FAB button — always visible, toggles button container
    const fabButton = L.DomUtil.create('button', 'map-ctrl-btn fab', controlContainer);
    fabButton.innerHTML = '\u2630'; // ☰
    fabButton.title = 'Toggle map controls';
    L.DomEvent.disableClickPropagation(fabButton);

    // Control buttons configuration
    const buttons = [
        {
            id: 'zoom-to-fit',
            icon: '\u2316',
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
            icon: '\u2212',
            title: 'Zoom out',
            action: callbacks.zoomOut
        },
        {
            id: 'toggle-mouse-zoom',
            icon: '\uD83D\uDDB1',
            title: 'Toggle mouse zoom (enable/disable wheel zoom)',
            action: callbacks.toggleMouseZoom,
            isToggle: true
        },
        {
            id: 'toggle-map-views',
            icon: '\uD83D\uDDFA',
            title: 'Toggle map view controls panel',
            action: callbacks.toggleMapViewsPanel,
            isToggle: true
        },
        {
            id: 'toggle-routes',
            icon: '\uD83D\uDEE4\uFE0F',
            title: 'Toggle route overlays panel',
            action: callbacks.toggleRoutesPanel,
            isToggle: true
        },
        {
            id: 'toggle-overlays',
            icon: '\uD83D\uDCCD',
            title: 'Toggle marker overlays panel',
            action: callbacks.toggleOverlaysPanel,
            isToggle: true
        },
        {
            id: 'toggle-privacy',
            icon: '\uD83D\uDC41\uFE0F',
            title: 'Toggle privacy mode panel (hide start/end locations)',
            action: callbacks.togglePrivacyPanel,
            isToggle: true
        },
        {
            id: 'toggle-fullscreen',
            icon: '\u26F6',
            title: 'Toggle fullscreen map',
            action: callbacks.toggleFullscreen,
            isToggle: true
        }
    ];

    // Vertical container for the 9 buttons — hidden by default
    const buttonContainer = L.DomUtil.create('div', 'map-control-buttons', controlContainer);
    buttonContainer.style.cssText = 'display: none; flex-direction: column; gap: 8px; align-items: flex-end;';

    let fabExpanded = false;

    // FAB click handler
    L.DomEvent.on(fabButton, 'click', function(e) {
        L.DomEvent.stopPropagation(e);
        fabExpanded = !fabExpanded;

        if (fabExpanded) {
            buttonContainer.style.display = 'flex';
            fabButton.innerHTML = '\u2715'; // ✕
        } else {
            buttonContainer.style.display = 'none';
            fabButton.innerHTML = '\u2630'; // ☰

            // Close any open panel and deactivate toggle buttons
            const allPanels = document.querySelectorAll('.collapsible-panel');
            allPanels.forEach(p => { p.style.display = 'none'; });

            const allToggleBtns = buttonContainer.querySelectorAll('[data-btn-id^="toggle-"]');
            allToggleBtns.forEach(btn => { btn.classList.remove('active'); });
        }
    });

    buttons.forEach(btn => {
        const button = L.DomUtil.create('button', 'map-ctrl-btn', buttonContainer);
        button.innerHTML = btn.icon;
        button.title = btn.title;
        button.setAttribute('data-btn-id', btn.id);

        // Store button reference for toggle state
        if (btn.isToggle) {
            btn.buttonElement = button;
        }

        // Click handler
        L.DomEvent.on(button, 'click', function(e) {
            L.DomEvent.stopPropagation(e);
            btn.action();
            if (!btn.isToggle) {
                button.blur();
            }
        });
    });

    return controlContainer;
}

// ==================== Panels ====================

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
    const panel = L.DomUtil.create('div', 'map-panel collapsible-panel', map.getContainer());
    panel.id = id;

    // Prevent map interactions when clicking panel
    L.DomEvent.disableClickPropagation(panel);
    L.DomEvent.disableScrollPropagation(panel);

    return { panel };
}

// ==================== Route Panel ====================

/**
 * Create route button group for a set of route overlays
 * @param {HTMLElement} container - Parent element
 * @param {string} groupName - Group display name
 * @param {Array} routes - Route config objects for this group
 * @param {object} buttonMap - Map to store button references { id: element }
 * @param {object} legendMap - Map to store legend div references { id: element }
 * @param {object} overlayState - Overlay visibility state
 * @param {Array} allRouteIds - All route IDs (for radio behavior)
 * @param {Function} updateCallback - Route overlay update callback
 * @param {Function} onLegendUpdate - Legend update callback
 * @param {Function} updateAllButtonStates - State refresh callback
 */
function createRouteButtonGroup(container, groupName, routes, buttonMap, legendMap,
                                 overlayState, allRouteIds, updateCallback, onLegendUpdate, updateAllButtonStates) {
    // Group header
    const groupHeader = L.DomUtil.create('div', 'route-group-header', container);
    groupHeader.textContent = groupName;
    groupHeader.style.cssText = `
        font-size: 10px;
        font-weight: bold;
        color: var(--map-ctrl-text-secondary);
        text-transform: uppercase;
        letter-spacing: 0.5px;
        margin: 8px 0 4px 2px;
    `;

    for (const cfg of routes) {
        const button = L.DomUtil.create('button', 'map-panel-btn', container);
        button.innerHTML = `${cfg.icon} ${cfg.label}`;
        button.setAttribute('data-route', cfg.id);
        if (overlayState[cfg.id]) button.classList.add('active');

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

        // Inline legend div — hidden by default, shown when this overlay is active
        const legendDiv = L.DomUtil.create('div', 'route-inline-legend', container);
        legendDiv.setAttribute('data-legend-id', cfg.id);
        legendDiv.style.cssText = `
            display: ${overlayState[cfg.id] ? 'block' : 'none'};
            padding: 6px 8px;
            margin-bottom: 4px;
            background: var(--map-ctrl-info-bg);
            border-radius: 4px;
        `;
        legendDiv.innerHTML = '';
        legendMap[cfg.id] = legendDiv;
    }
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

    createPanelHeader(container, '\u{1F6E4}\uFE0F', 'Route Overlays');

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

    // Track all buttons and legend divs for state updates
    const buttonMap = {}; // { overlayId: buttonElement }
    const legendMap = {}; // { overlayId: legendDivElement }

    // Helper to update all button visual states via CSS classes
    function updateAllButtonStates() {
        for (const [id, btn] of Object.entries(buttonMap)) {
            const isActive = overlayState[id];
            if (isActive) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        }
        // Show/hide legend divs based on active state
        for (const [id, legendDiv] of Object.entries(legendMap)) {
            legendDiv.style.display = overlayState[id] ? 'block' : 'none';
        }
    }

    // Render groups in configured order
    const orderedGroups = routeGroups.filter(g => grouped[g]);
    for (const groupName of orderedGroups) {
        createRouteButtonGroup(container, groupName, grouped[groupName], buttonMap, legendMap,
                                overlayState, allRouteIds, updateCallback, onLegendUpdate, updateAllButtonStates);
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

    /**
     * Update the inline legend for the active overlay.
     * @param {object|null} stats - { min, max, config } from routeRenderer.getActiveOverlayStats()
     */
    function updateLegend(stats) {
        if (!stats || !stats.config) {
            // Hide all legend divs
            for (const legendDiv of Object.values(legendMap)) {
                legendDiv.style.display = 'none';
            }
            return;
        }

        const cfg = stats.config;

        // Determine min/max labels
        let minLabel, maxLabel;
        if (cfg.legendLabels) {
            minLabel = cfg.legendLabels[0];
            maxLabel = cfg.legendLabels[cfg.legendLabels.length - 1];
        } else {
            minLabel = stats.min.toFixed(cfg.decimals) + cfg.unit;
            maxLabel = stats.max.toFixed(cfg.decimals) + cfg.unit;
        }

        // Update the legend div for this overlay
        const legendDiv = legendMap[cfg.id];
        if (legendDiv) {
            legendDiv.innerHTML = `
                <div style="height: 12px; border-radius: 3px; background: ${cfg.legendGradient}; margin-bottom: 4px;"></div>
                <div style="display: flex; justify-content: space-between; font-size: 10px; color: var(--map-ctrl-text);">
                    <span>${minLabel}</span>
                    <span>${maxLabel}</span>
                </div>
            `;
        }

        // Show/hide based on active state
        for (const [id, div] of Object.entries(legendMap)) {
            div.style.display = overlayState[id] ? 'block' : 'none';
        }
    }

    return { container, updateAvailability, updateLegend };
}

// ==================== Overlay Panel ====================

/**
 * Create overlay panel content
 * @param {object} overlayState - Overlay visibility state
 * @param {Function} updateCallback - Callback to update overlay
 * @returns {HTMLElement} Panel content
 */
function createOverlayPanelContent(overlayState, updateCallback) {
    const container = document.createElement('div');

    createPanelHeader(container, '\uD83D\uDCCD', 'Marker Overlays');

    // Button row: Pulse toggle + All On/Off
    const buttonRow = L.DomUtil.create('div', 'all-buttons-row', container);
    buttonRow.style.cssText = 'display: flex; gap: 8px; margin-bottom: 12px;';

    // Pulse toggle button — reads/writes body class + localStorage (no map state needed)
    const pulseActive = document.body.classList.contains('marker-animations-enabled');
    const pulseBtn = L.DomUtil.create('button', 'map-panel-btn', buttonRow);
    pulseBtn.innerHTML = 'Pulse \uD83D\uDCAB';
    pulseBtn.style.cssText = 'flex: 1; width: auto; text-align: center; font-size: 12px;';
    if (pulseActive) pulseBtn.classList.add('active');

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
        pulseBtn.classList.toggle('active', nowActive);
        console.log(`[UI CONTROLS] Marker pulse ${nowActive ? 'enabled' : 'disabled'}`);
    });

    const allOnBtn = L.DomUtil.create('button', 'map-panel-btn', buttonRow);
    allOnBtn.innerHTML = 'All On';
    allOnBtn.style.cssText = 'flex: 1; width: auto; text-align: center; font-size: 12px;';

    const allOffBtn = L.DomUtil.create('button', 'map-panel-btn', buttonRow);
    allOffBtn.innerHTML = 'All Off';
    allOffBtn.style.cssText = 'flex: 1; width: auto; text-align: center; font-size: 12px;';

    // Marker overlays (icons match overlay-config.js - single source of truth)
    const overlays = [
        { id: 'maxSpeed', label: 'Max Speed', icon: '\uD83D\uDE80' },
        { id: 'zeroSafety', label: 'Critical Safety', icon: '\uD83D\uDC80' },
        { id: 'maxElevation', label: 'Max Elevation', icon: '\uD83C\uDFD4\uFE0F' },
        { id: 'minElevation', label: 'Min Elevation', icon: '\u26F0\uFE0F' },
        { id: 'maxControllerTemp', label: 'Max Controller Temp', icon: '\uD83C\uDF21\uFE0F' },
        { id: 'maxMotorTemp', label: 'Max Motor Temp', icon: '\uD83C\uDF21\uFE0F' },
        { id: 'maxBatteryTemp', label: 'Max Battery Temp', icon: '\uD83C\uDF21\uFE0F' },
        { id: 'maxPower', label: 'Max Power', icon: '\uD83D\uDD0C' },
        { id: 'maxCurrent', label: 'Max Current', icon: '\u26A1' },
        { id: 'minBattery', label: 'Battery Min', icon: '\uD83E\uDEAB' },
        { id: 'safetyMarginMin', label: 'PWM Min', icon: '\uD83D\uDEE1\uFE0F' },
        { id: 'minVoltage', label: 'Voltage Min', icon: '\u26A1' },
        { id: 'maxTilt', label: 'Max Tilt', icon: '\u2197\uFE0F' },
        { id: 'minTilt', label: 'Min Tilt', icon: '\u2199\uFE0F' },
        { id: 'maxRoll', label: 'Max Roll', icon: '\u21AA\uFE0F' },
        { id: 'minRoll', label: 'Min Roll', icon: '\u21A9\uFE0F' }
    ];

    // Create scrollable container for marker list
    const scrollContainer = L.DomUtil.create('div', 'marker-scroll-container', container);
    scrollContainer.style.cssText = 'overflow-x: hidden; padding-right: 4px;';

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
        scrollContainer.querySelectorAll('.map-toggle-row').forEach(row => {
            const checkbox = row.querySelector('input[type="checkbox"]');
            if (checkbox) {
                checkbox.checked = true;
                row.classList.add('active');
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
        scrollContainer.querySelectorAll('.map-toggle-row').forEach(row => {
            const checkbox = row.querySelector('input[type="checkbox"]');
            if (checkbox) {
                checkbox.checked = false;
                row.classList.remove('active');
            }
        });
        console.log('[UI CONTROLS] All marker overlays disabled');
    });

    return container;
}

// ==================== Map Views Panel ====================

/**
 * Create map views panel content
 * @param {Function} setMapLayer - Callback to set map layer
 * @param {Function} getCurrentLayer - Callback to get current layer
 * @returns {HTMLElement} Panel content
 */
function createMapViewsPanelContent(setMapLayer, getCurrentLayer) {
    const container = document.createElement('div');

    createPanelHeader(container, '\uD83D\uDDFA', 'Map Views');

    // Map layer buttons
    const layers = [
        { id: 'street', label: 'Street', icon: '\uD83C\uDFD9\uFE0F' },
        { id: 'grayscale', label: 'Grayscale', icon: '\u2B1C' },
        { id: 'satellite', label: 'Satellite', icon: '\uD83D\uDEF0\uFE0F' },
        { id: 'cyclosm', label: 'CyclOSM', icon: '\uD83D\uDEB4' },
        { id: 'transport', label: 'Transport', icon: '\uD83D\uDE8A' },
        { id: 'topo', label: 'Topographic', icon: '\uD83D\uDDFB' },
        { id: 'humanitarian', label: 'Humanitarian', icon: '\uD83C\uDFE5' },
        { id: 'dark', label: 'Dark', icon: '\uD83C\uDF19' },
        { id: 'terrain', label: 'Terrain', icon: '\uD83C\uDFD4\uFE0F' }
    ];

    const currentLayer = getCurrentLayer();

    layers.forEach(layer => {
        const button = L.DomUtil.create('button', 'map-panel-btn', container);
        button.innerHTML = `${layer.icon} ${layer.label}`;
        button.setAttribute('data-layer', layer.id);
        button.style.marginBottom = '6px';

        if (layer.id === currentLayer) button.classList.add('active');

        L.DomEvent.on(button, 'click', function(e) {
            L.DomEvent.stopPropagation(e);

            // Update all button states — radio behavior
            container.querySelectorAll('.map-panel-btn').forEach(btn => {
                btn.classList.toggle('active', btn.getAttribute('data-layer') === layer.id);
            });

            setMapLayer(layer.id);
            console.log(`[UI CONTROLS] Switched to ${layer.label} layer`);
        });
    });

    return container;
}

// ==================== Toggle Row ====================

/**
 * Create a toggle row for overlays
 * @param {string} label - Toggle label
 * @param {string} icon - Toggle icon
 * @param {boolean} checked - Initial checked state
 * @param {Function} onChange - Change callback
 * @returns {HTMLElement} Toggle row element
 */
function createToggleRow(label, icon, checked, onChange) {
    const container = L.DomUtil.create('div', 'map-toggle-row');
    if (checked) container.classList.add('active');

    // Hidden checkbox for state tracking
    const checkbox = L.DomUtil.create('input', '', container);
    checkbox.type = 'checkbox';
    checkbox.checked = checked;
    checkbox.style.display = 'none';

    // Label text
    const labelSpan = L.DomUtil.create('span', '', container);
    labelSpan.innerHTML = `${icon} ${label}`;

    // Make entire container clickable
    L.DomEvent.on(container, 'click', function(e) {
        L.DomEvent.stopPropagation(e);
        checkbox.checked = !checkbox.checked;
        container.classList.toggle('active', checkbox.checked);
        onChange(checkbox.checked);
    });

    return container;
}

// ==================== Panel Toggle ====================

/**
 * Toggle panel visibility
 * @param {HTMLElement} panel - Panel element
 * @param {HTMLElement} button - Toggle button element
 */
export function togglePanel(panel, button) {
    const isVisible = panel.style.display === 'block';

    if (isVisible) {
        // Close this panel
        panel.style.display = 'none';
        if (button) button.classList.remove('active');
    } else {
        // Close all other panels first
        const allPanels = document.querySelectorAll('.collapsible-panel');
        const allButtons = document.querySelectorAll('[data-btn-id^="toggle-"]');

        allPanels.forEach(p => { if (p !== panel) p.style.display = 'none'; });
        allButtons.forEach(btn => { if (btn !== button) btn.classList.remove('active'); });

        // Open this panel
        panel.style.display = 'block';
        if (button) button.classList.add('active');
    }
}

// ==================== Map Layer ====================

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
