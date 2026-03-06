/**
 * Time Range Manager - Dual-Handle Range Slider Module
 * Handles trim in/out functionality with smart time marks and real-time GPS updates
 */

import { formatTimestamp, formatDuration } from './format-utils.js';

/**
 * Generate evenly-spaced time marks matching chart X-axis layout.
 * Uses linear time scale with exactly NUM_MARKS labels, same approach as canvas-chart.js drawXAxisLabels().
 * @param {number} startTimestamp - Start timestamp in milliseconds
 * @param {number} endTimestamp - End timestamp in milliseconds
 * @returns {Object} - Object with timestamp keys (seconds) and time label values
 */
const NUM_MARKS = 14; // Matches canvas-chart.js X_AXIS_LABEL_COUNT

function generateTimeMarks(startTimestamp, endTimestamp) {
    const marks = {};
    const timeRange = endTimestamp - startTimestamp;

    // Show seconds if ride is under ~25 minutes (same threshold as charts)
    const totalSeconds = timeRange / 1000;
    const showSeconds = totalSeconds <= 1500;

    for (let i = 0; i < NUM_MARKS; i++) {
        const timestamp = startTimestamp + (i * timeRange / (NUM_MARKS - 1));
        const date = new Date(timestamp);
        const hours = date.getHours().toString().padStart(2, '0');
        const minutes = date.getMinutes().toString().padStart(2, '0');
        const seconds = date.getSeconds().toString().padStart(2, '0');

        const timeLabel = showSeconds
            ? `${hours}:${minutes}:${seconds}`
            : `${hours}:${minutes}`;

        marks[Math.floor(timestamp / 1000)] = timeLabel;
    }

    console.log(`[TIME RANGE] Generated ${Object.keys(marks).length} evenly-spaced marks`);

    return marks;
}

// Singleton instance tracker to prevent duplicate listeners
let activeManagerInstance = null;

/**
 * Create Time Range Manager
 * @param {Object} gpsMapInstance - GPS map instance for marker updates
 * @param {Function} onApplyCallback - Callback when trim is applied
 * @param {Function} onResetCallback - Callback when trim is reset
 * @returns {Object} Time range manager instance
 */
export function createTimeRangeManager(gpsMapInstance, onApplyCallback, onResetCallback) {
    console.log('[TIME RANGE MANAGER] Creating time range manager...');

    // Cleanup previous instance listeners if exists
    if (activeManagerInstance && activeManagerInstance.cleanup) {
        console.log('[TIME RANGE MANAGER] Cleaning up previous instance listeners');
        activeManagerInstance.cleanup();
    }

    // State
    let sliderInstance = null;
    let originalData = null;
    let currentRange = null; // [startTimestamp, endTimestamp] in milliseconds
    let fullRange = null; // [startTimestamp, endTimestamp] in milliseconds
    let isDragging = false;

    // DOM elements
    const sliderElement = document.getElementById('time-range-slider');
    const sectionElement = document.getElementById('time-range-section');
    const startLabel = document.getElementById('time-start-label');
    const endLabel = document.getElementById('time-end-label');
    const durationBadge = document.getElementById('time-duration-badge');
    const applyBtn = document.getElementById('apply-time-btn');
    const resetBtn = document.getElementById('reset-time-btn');

    /**
     * Initialize time range slider with data
     * @param {Object} data - Processed ride data
     */
    function initialize(data) {
        console.log('[TIME RANGE MANAGER] Initializing with data...');

        if (!data || !data.timestamps || data.timestamps.length === 0) {
            hide();
            return;
        }

        // Store original data
        originalData = data;

        // Get time range
        const startTimestamp = data.timestamps[0];
        const endTimestamp = data.timestamps[data.timestamps.length - 1];
        fullRange = [startTimestamp, endTimestamp];
        currentRange = [startTimestamp, endTimestamp];

        console.log(`[TIME RANGE MANAGER] Range: ${formatTimestamp(startTimestamp)} → ${formatTimestamp(endTimestamp)}`);

        // Update labels
        startLabel.textContent = formatTimestamp(startTimestamp);
        endLabel.textContent = formatTimestamp(endTimestamp);
        // Update duration badge
        const durationSeconds = (endTimestamp - startTimestamp) / 1000;
        durationBadge.textContent = `Full Ride (${formatDuration(durationSeconds)})`;

        // Generate time marks
        const marks = generateTimeMarks(startTimestamp, endTimestamp);

        // Destroy existing slider if present
        if (sliderInstance) {
            sliderInstance.destroy();
        }

        // Create noUiSlider with dual handles
        // Values in seconds (Unix timestamps)
        const startSeconds = Math.floor(startTimestamp / 1000);
        const endSeconds = Math.floor(endTimestamp / 1000);

        sliderInstance = noUiSlider.create(sliderElement, {
            start: [startSeconds, endSeconds],
            connect: true,
            range: {
                'min': startSeconds,
                'max': endSeconds
            },
            step: 1, // 1 second steps
            pips: {
                mode: 'values',
                values: Object.keys(marks).map(k => parseInt(k)),
                format: {
                    to: function(value) {
                        return marks[Math.floor(value)] || '';
                    }
                },
                density: 3
            },
            tooltips: [
                { to: (v) => formatTimestamp(v * 1000) },
                { to: (v) => formatTimestamp(v * 1000) }
            ],
            behaviour: 'tap-drag', // Enable click-to-jump and drag behavior
            animate: false // Disable animation for real-time updates
        });

        // Event listeners
        sliderInstance.on('start', handleDragStart);
        sliderInstance.on('slide', handleSlide);
        sliderInstance.on('update', handleUpdate);
        sliderInstance.on('end', handleDragEnd);

        // Show section
        sectionElement.style.display = 'block';

        applyBtn.disabled = true;

        console.log('[TIME RANGE MANAGER] Initialized successfully');
    }

    /**
     * Handle drag start
     */
    function handleDragStart() {
        isDragging = true;
        console.log('[TIME RANGE MANAGER] Drag started');
    }

    /**
     * Broadcast trim preview to all registered charts.
     * @param {number|null} startMs - Trim start in ms, or null to clear
     * @param {number|null} endMs - Trim end in ms, or null to clear
     */
    function broadcastTrimPreview(startMs, endMs) {
        if (!window.eucChartSync || !window.eucChartSync.charts) return;
        const charts = Object.values(window.eucChartSync.charts);
        if (startMs === null) {
            charts.forEach(chart => { if (chart.clearTrimPreview) chart.clearTrimPreview(); });
        } else {
            charts.forEach(chart => { if (chart.setTrimPreview) chart.setTrimPreview(startMs, endMs); });
        }
    }

    /**
     * Handle slider update (real-time during drag)
     * @param {Array} values - [trimInSeconds, trimOutSeconds]
     */
    function handleSlide(values) {
        if (!isDragging) return;

        const trimInMs = parseInt(values[0]) * 1000;
        const trimOutMs = parseInt(values[1]) * 1000;
        const isFullRange = trimInMs <= fullRange[0] + 1000 && trimOutMs >= fullRange[1] - 1000;

        // Update GPS markers in real-time (preview)
        if (gpsMapInstance) {
            if (isFullRange) {
                gpsMapInstance.clearTimeRangeMarkers();
            } else {
                gpsMapInstance.updateTimeRangeMarkers(trimInMs, trimOutMs);
            }
        }

    }

    /**
     * Handle slider value update
     * @param {Array} values - [trimInSeconds, trimOutSeconds]
     */
    function handleUpdate(values) {
        const trimInMs = parseInt(values[0]) * 1000;
        const trimOutMs = parseInt(values[1]) * 1000;

        currentRange = [trimInMs, trimOutMs];

        // Enable/disable apply button + update chart trim preview
        // Use 1s tolerance for full-range check since slider works in whole seconds
        const isFullRange = trimInMs <= fullRange[0] + 1000 && trimOutMs >= fullRange[1] - 1000;
        applyBtn.disabled = isFullRange;

        if (isFullRange) {
            broadcastTrimPreview(null, null);
        } else {
            broadcastTrimPreview(trimInMs, trimOutMs);
        }
    }

    /**
     * Handle drag end
     */
    function handleDragEnd() {
        isDragging = false;
        console.log('[TIME RANGE MANAGER] Drag ended', currentRange);

        // Keep trim preview visible — clear only if back to full range
        const isFullRange = currentRange[0] <= fullRange[0] + 1000 && currentRange[1] >= fullRange[1] - 1000;
        if (isFullRange) {
            broadcastTrimPreview(null, null);
        }

        applyBtn.disabled = isFullRange;
    }

    /**
     * Apply time range trim
     */
    function applyTrim() {
        if (!currentRange || !onApplyCallback) {
            console.warn('[TIME RANGE MANAGER] Cannot apply trim - missing range or callback');
            return;
        }

        console.log(`[TIME RANGE MANAGER] Applying trim: ${formatTimestamp(currentRange[0])} → ${formatTimestamp(currentRange[1])}`);

        // Clear chart trim preview (charts will re-render with trimmed data)
        broadcastTrimPreview(null, null);

        // Call callback with range
        onApplyCallback(currentRange[0], currentRange[1]);

        const duration = (currentRange[1] - currentRange[0]) / 1000;
        durationBadge.textContent = `Trimmed (${formatDuration(duration)})`;
    }

    /**
     * Reset time range to full range
     */
    function resetTrim() {
        if (!fullRange || !sliderInstance) {
            console.warn('[TIME RANGE MANAGER] Cannot reset - no full range or slider');
            return;
        }

        console.log('[TIME RANGE MANAGER] Resetting to full range');

        // Clear chart trim preview
        broadcastTrimPreview(null, null);

        // Reset slider to full range
        sliderInstance.set([fullRange[0] / 1000, fullRange[1] / 1000]);

        // Clear GPS markers
        if (gpsMapInstance) {
            gpsMapInstance.clearTimeRangeMarkers();
        }

        // Call reset callback
        if (onResetCallback) {
            onResetCallback();
        }

        // Update status
        const duration = (fullRange[1] - fullRange[0]) / 1000;
        durationBadge.textContent = `Full Ride (${formatDuration(duration)})`;
        applyBtn.disabled = true;
    }

    /**
     * Hide time range section
     */
    function hide() {
        sectionElement.style.display = 'none';
        if (sliderInstance) {
            sliderInstance.destroy();
            sliderInstance = null;
        }
    }

    /**
     * Get current selected range
     * @returns {Array|null} [startTimestamp, endTimestamp] in milliseconds
     */
    function getCurrentRange() {
        return currentRange;
    }

    /**
     * Cleanup
     */
    function cleanup() {
        if (sliderInstance) {
            sliderInstance.destroy();
            sliderInstance = null;
        }
        originalData = null;
        currentRange = null;
        fullRange = null;
    }

    // Store listener references for proper cleanup
    let applyListener = null;
    let resetListener = null;

    /**
     * Attach event listeners with cleanup
     */
    function attachListeners() {
        // Remove old listeners if they exist
        if (applyListener) {
            applyBtn.removeEventListener('click', applyListener);
        }
        if (resetListener) {
            resetBtn.removeEventListener('click', resetListener);
        }

        // Create new listener references
        applyListener = applyTrim;
        resetListener = resetTrim;

        // Attach new listeners
        applyBtn.addEventListener('click', applyListener);
        resetBtn.addEventListener('click', resetListener);
    }

    // Attach listeners on creation
    attachListeners();

    // Create instance object
    const instance = {
        initialize,
        applyTrim,
        resetTrim,
        hide,
        getCurrentRange,
        cleanup: function() {
            // Remove listeners on cleanup
            if (applyListener) {
                applyBtn.removeEventListener('click', applyListener);
            }
            if (resetListener) {
                resetBtn.removeEventListener('click', resetListener);
            }

            // Original cleanup
            cleanup();

            // Clear singleton reference
            if (activeManagerInstance === instance) {
                activeManagerInstance = null;
            }
        }
    };

    // Store as active singleton instance
    activeManagerInstance = instance;
    console.log('[TIME RANGE MANAGER] Stored new active instance');

    return instance;
}
