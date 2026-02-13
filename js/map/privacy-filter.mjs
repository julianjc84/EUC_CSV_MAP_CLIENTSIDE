/**
 * Privacy Filter Module
 *
 * Handles privacy mode filtering to hide start/end locations:
 * - Route point filtering
 * - Privacy zone detection
 * - Marker boundary calculation
 * - Privacy badge display
 */

/**
 * Create privacy filter manager
 * @param {object} privacyState - Privacy mode state object
 * @returns {object} PrivacyFilter instance
 */
export function createPrivacyFilter(privacyState) {
    return {
        /**
         * Apply privacy filter to route points
         * @param {Array} routePoints - Array of GPS route points
         * @returns {Array} Filtered route points
         */
        applyPrivacyFilter(routePoints) {
            if (!privacyState.enabled || (!privacyState.hideStart && !privacyState.hideEnd)) {
                return routePoints; // No filtering needed
            }

            const totalPoints = routePoints.length;
            const zoneSize = privacyState.zoneSize;

            console.log(`[PRIVACY FILTER] Applying privacy filter - hide start: ${privacyState.hideStart}, hide end: ${privacyState.hideEnd}, zone size: ${zoneSize}`);

            // Calculate filter boundaries
            const startIndex = privacyState.hideStart ? zoneSize : 0;
            const endIndex = privacyState.hideEnd ? totalPoints - zoneSize : totalPoints;

            // Ensure valid range
            if (startIndex >= endIndex) {
                console.warn(`[PRIVACY FILTER] Privacy zone too large - not enough points to display`);
                return routePoints; // Return original if filter would hide everything
            }

            // Filter points
            const filteredPoints = routePoints.slice(startIndex, endIndex);
            console.log(`[PRIVACY FILTER] Privacy filter applied: ${totalPoints} points → ${filteredPoints.length} points (removed ${totalPoints - filteredPoints.length})`);

            return filteredPoints;
        },

        /**
         * Check if a marker index falls within privacy zone
         * @param {number} markerIndex - Marker data index
         * @param {number} totalPoints - Total number of points in route
         * @returns {boolean} True if in privacy zone
         */
        isInPrivacyZone(markerIndex, totalPoints) {
            if (!privacyState.enabled) return false;

            const zoneSize = privacyState.zoneSize;
            const inStartZone = privacyState.hideStart && markerIndex < zoneSize;
            const inEndZone = privacyState.hideEnd && markerIndex >= (totalPoints - zoneSize);

            return inStartZone || inEndZone;
        },

        /**
         * Get privacy boundary coordinates for moving markers
         * @param {number} markerIndex - Marker data index
         * @param {Array} routePoints - Array of GPS route points
         * @param {number} totalPoints - Total number of points in route
         * @returns {object|null} Boundary point or null if not in privacy zone
         */
        getPrivacyBoundary(markerIndex, routePoints, totalPoints) {
            const zoneSize = privacyState.zoneSize;

            // If in start zone, move to first visible point
            if (privacyState.hideStart && markerIndex < zoneSize) {
                return routePoints[zoneSize];
            }

            // If in end zone, move to last visible point
            if (privacyState.hideEnd && markerIndex >= (totalPoints - zoneSize)) {
                return routePoints[totalPoints - zoneSize - 1];
            }

            // Not in privacy zone
            return null;
        },

        /**
         * Update or create privacy mode badge
         * @param {object} map - Leaflet map instance
         * @param {number} totalPoints - Total number of route points
         * @param {number} visiblePoints - Number of visible points after filtering
         */
        updatePrivacyBadge(map, totalPoints, visiblePoints) {
            // Remove existing badge if present
            const existingBadge = document.getElementById('privacy-mode-badge');
            if (existingBadge) {
                existingBadge.remove();
            }

            // Only show badge if privacy is enabled
            if (!privacyState.enabled || (!privacyState.hideStart && !privacyState.hideEnd)) {
                return;
            }

            // Create privacy badge
            const badge = document.createElement('div');
            badge.id = 'privacy-mode-badge';
            badge.style.cssText = `
                position: absolute;
                bottom: 40px;
                left: 50%;
                transform: translateX(-50%);
                z-index: 1000;
                background: rgba(0, 0, 0, 0.85);
                color: white;
                padding: 8px 16px;
                border-radius: 20px;
                border: 2px solid rgba(255, 215, 0, 0.8);
                box-shadow: 0 4px 15px rgba(0,0,0,0.5);
                font-size: 13px;
                font-weight: bold;
                display: flex;
                align-items: center;
                gap: 8px;
                pointer-events: none;
            `;

            // Build badge text
            const hiddenPoints = totalPoints - visiblePoints;
            let badgeText = '👁️ Privacy Mode: ';

            if (privacyState.hideStart && privacyState.hideEnd) {
                badgeText += 'Start & End Hidden';
            } else if (privacyState.hideStart) {
                badgeText += 'Start Hidden';
            } else if (privacyState.hideEnd) {
                badgeText += 'End Hidden';
            }

            badgeText += ` (${hiddenPoints} points filtered)`;

            badge.textContent = badgeText;

            // Add to map container
            const mapContainer = map.getContainer();
            mapContainer.appendChild(badge);

            console.log('[PRIVACY FILTER] Privacy badge updated:', badgeText);
        },

        /**
         * Get privacy state for external access
         * @returns {object} Privacy state object
         */
        getState() {
            return privacyState;
        }
    };
}

/**
 * Create privacy panel content for UI controls
 * @param {object} privacyState - Privacy mode state object
 * @param {Function} reloadRoute - Callback to reload route with new privacy settings
 * @returns {HTMLElement} Privacy panel DOM element
 */
export function createPrivacyPanelContent(privacyState, reloadRoute) {
    const container = document.createElement('div');

    // Panel header
    const header = L.DomUtil.create('div', 'map-panel-header', container);
    header.innerHTML = '\uD83D\uDC41\uFE0F Privacy Mode';

    // Privacy mode toggle
    const privacyToggleContainer = L.DomUtil.create('div', 'map-toggle-row', container);
    privacyToggleContainer.style.marginBottom = '12px';
    if (privacyState.enabled) privacyToggleContainer.classList.add('active');

    const privacyToggleSwitch = L.DomUtil.create('input', '', privacyToggleContainer);
    privacyToggleSwitch.type = 'checkbox';
    privacyToggleSwitch.checked = privacyState.enabled;
    privacyToggleSwitch.style.display = 'none';

    const privacyToggleLabel = L.DomUtil.create('span', '', privacyToggleContainer);
    privacyToggleLabel.innerHTML = '\uD83D\uDC41\uFE0F Enable Privacy Mode';

    L.DomEvent.on(privacyToggleContainer, 'click', function(e) {
        L.DomEvent.stopPropagation(e);
        privacyToggleSwitch.checked = !privacyToggleSwitch.checked;
        privacyState.enabled = privacyToggleSwitch.checked;
        privacyToggleContainer.classList.toggle('active', privacyState.enabled);
        console.log(`[PRIVACY FILTER] Privacy mode ${privacyState.enabled ? 'enabled' : 'disabled'}`);
        reloadRoute(); // Reload route with privacy filter applied
    });

    // Zone selection checkboxes
    const zoneSelectionLabel = L.DomUtil.create('div', '', container);
    zoneSelectionLabel.innerHTML = 'Hide Locations:';
    zoneSelectionLabel.style.cssText = `
        font-size: 12px;
        font-weight: bold;
        color: var(--map-ctrl-text);
        margin-bottom: 8px;
    `;

    // Hide start checkbox
    const hideStartContainer = L.DomUtil.create('div', 'map-toggle-row', container);
    if (privacyState.hideStart) hideStartContainer.classList.add('active');

    const hideStartCheckbox = L.DomUtil.create('input', '', hideStartContainer);
    hideStartCheckbox.type = 'checkbox';
    hideStartCheckbox.checked = privacyState.hideStart;
    hideStartCheckbox.style.display = 'none';

    const hideStartLabel = L.DomUtil.create('span', '', hideStartContainer);
    hideStartLabel.innerHTML = '\uD83C\uDFE0 Hide Start Location';

    L.DomEvent.on(hideStartContainer, 'click', function(e) {
        L.DomEvent.stopPropagation(e);
        hideStartCheckbox.checked = !hideStartCheckbox.checked;
        privacyState.hideStart = hideStartCheckbox.checked;
        hideStartContainer.classList.toggle('active', privacyState.hideStart);
        console.log(`[PRIVACY FILTER] Hide start: ${privacyState.hideStart}`);
        if (privacyState.enabled) reloadRoute();
    });

    // Hide end checkbox
    const hideEndContainer = L.DomUtil.create('div', 'map-toggle-row', container);
    hideEndContainer.style.marginBottom = '12px';
    if (privacyState.hideEnd) hideEndContainer.classList.add('active');

    const hideEndCheckbox = L.DomUtil.create('input', '', hideEndContainer);
    hideEndCheckbox.type = 'checkbox';
    hideEndCheckbox.checked = privacyState.hideEnd;
    hideEndCheckbox.style.display = 'none';

    const hideEndLabel = L.DomUtil.create('span', '', hideEndContainer);
    hideEndLabel.innerHTML = '\uD83C\uDFC1 Hide End Location';

    L.DomEvent.on(hideEndContainer, 'click', function(e) {
        L.DomEvent.stopPropagation(e);
        hideEndCheckbox.checked = !hideEndCheckbox.checked;
        privacyState.hideEnd = hideEndCheckbox.checked;
        hideEndContainer.classList.toggle('active', privacyState.hideEnd);
        console.log(`[PRIVACY FILTER] Hide end: ${privacyState.hideEnd}`);
        if (privacyState.enabled) reloadRoute();
    });

    // Zone size slider
    const zoneSizeLabel = L.DomUtil.create('div', '', container);
    zoneSizeLabel.innerHTML = `Privacy Zone Size: <span id="zone-size-value">${privacyState.zoneSize}</span> points`;
    zoneSizeLabel.style.cssText = `
        font-size: 12px;
        font-weight: bold;
        color: var(--map-ctrl-text);
        margin-bottom: 8px;
    `;

    const zoneSizeSlider = L.DomUtil.create('input', '', container);
    zoneSizeSlider.type = 'range';
    zoneSizeSlider.min = '50';
    zoneSizeSlider.max = '500';
    zoneSizeSlider.step = '10';
    zoneSizeSlider.value = privacyState.zoneSize;
    zoneSizeSlider.style.cssText = `
        width: 100%;
        margin-bottom: 8px;
        cursor: pointer;
    `;

    L.DomEvent.on(zoneSizeSlider, 'input', function(e) {
        L.DomEvent.stopPropagation(e);
        privacyState.zoneSize = parseInt(zoneSizeSlider.value);
        const valueSpan = document.getElementById('zone-size-value');
        if (valueSpan) {
            valueSpan.textContent = privacyState.zoneSize;
        }
    });

    L.DomEvent.on(zoneSizeSlider, 'change', function(e) {
        L.DomEvent.stopPropagation(e);
        console.log(`[PRIVACY FILTER] Privacy zone size: ${privacyState.zoneSize} points`);
        if (privacyState.enabled) reloadRoute();
    });

    // Info text
    const infoText = L.DomUtil.create('div', '', container);
    infoText.innerHTML = 'Privacy mode hides GPS points from the start and/or end of your route to protect your home location.';
    infoText.style.cssText = `
        font-size: 11px;
        color: var(--map-ctrl-text-secondary);
        margin-top: 12px;
        padding: 8px;
        background: var(--map-ctrl-info-bg);
        border-radius: 6px;
        line-height: 1.4;
    `;

    return container;
}
