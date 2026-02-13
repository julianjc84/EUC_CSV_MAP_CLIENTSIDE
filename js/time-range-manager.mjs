/**
 * Time Range Manager - Dual-Handle Range Slider Module
 * Handles trim in/out functionality with smart time marks and real-time GPS updates
 */

import { formatTimestamp, formatDuration } from './format-utils.js';

/**
 * Generate smart time marks based on duration
 * Adapted from DASHAPP's intelligent interval selection
 * @param {number} startTimestamp - Start timestamp in milliseconds
 * @param {number} endTimestamp - End timestamp in milliseconds
 * @returns {Object} - Object with timestamp keys and time label values
 */
function generateTimeMarks(startTimestamp, endTimestamp) {
    const marks = {};
    const totalSeconds = (endTimestamp - startTimestamp) / 1000;

    // Calculate interval based on total duration (target 20 marks)
    const targetMarks = 20;
    const idealInterval = totalSeconds / targetMarks;

    // Smart interval selection (from DASHAPP logic)
    let intervalSeconds;
    if (idealInterval <= 1) {
        intervalSeconds = 1; // 1 second
    } else if (idealInterval <= 5) {
        intervalSeconds = 5; // 5 seconds
    } else if (idealInterval <= 10) {
        intervalSeconds = 10; // 10 seconds
    } else if (idealInterval <= 15) {
        intervalSeconds = 15; // 15 seconds
    } else if (idealInterval <= 30) {
        intervalSeconds = 30; // 30 seconds
    } else if (idealInterval <= 45) {
        intervalSeconds = 45; // 45 seconds
    } else if (idealInterval <= 60) {
        intervalSeconds = 60; // 1 minute
    } else if (idealInterval <= 90) {
        intervalSeconds = 90; // 1.5 minutes
    } else if (idealInterval <= 120) {
        intervalSeconds = 120; // 2 minutes
    } else if (idealInterval <= 150) {
        intervalSeconds = 150; // 2.5 minutes
    } else if (idealInterval <= 300) {
        intervalSeconds = 300; // 5 minutes
    } else if (idealInterval <= 450) {
        intervalSeconds = 450; // 7.5 minutes
    } else if (idealInterval <= 600) {
        intervalSeconds = 600; // 10 minutes
    } else if (idealInterval <= 750) {
        intervalSeconds = 750; // 12.5 minutes
    } else if (idealInterval <= 900) {
        intervalSeconds = 900; // 15 minutes
    } else if (idealInterval <= 1800) {
        intervalSeconds = 1800; // 30 minutes
    } else if (idealInterval <= 3600) {
        intervalSeconds = 3600; // 1 hour
    } else {
        intervalSeconds = 3600; // 1 hour (max)
    }

    // Choose time format based on granularity
    const showSeconds = intervalSeconds <= 60;

    // Generate marks at regular intervals
    const intervalMs = intervalSeconds * 1000;
    let currentTime = startTimestamp;

    while (currentTime <= endTimestamp) {
        const date = new Date(currentTime);
        const hours = date.getHours().toString().padStart(2, '0');
        const minutes = date.getMinutes().toString().padStart(2, '0');
        const seconds = date.getSeconds().toString().padStart(2, '0');

        const timeLabel = showSeconds
            ? `${hours}:${minutes}:${seconds}`
            : `${hours}:${minutes}`;

        // noUiSlider uses seconds as keys
        marks[Math.floor(currentTime / 1000)] = timeLabel;

        currentTime += intervalMs;
    }

    // Add end mark if not too close to last mark
    const endKey = Math.floor(endTimestamp / 1000);
    const lastMarkKey = Math.max(...Object.keys(marks).map(k => parseInt(k)));
    const minSpacing = Math.max(intervalSeconds * 0.3, 60); // 30% of interval or 1 minute

    if (endKey - lastMarkKey >= minSpacing) {
        const endDate = new Date(endTimestamp);
        const hours = endDate.getHours().toString().padStart(2, '0');
        const minutes = endDate.getMinutes().toString().padStart(2, '0');
        const seconds = endDate.getSeconds().toString().padStart(2, '0');
        marks[endKey] = showSeconds ? `${hours}:${minutes}:${seconds}` : `${hours}:${minutes}`;
    }

    console.log(`[TIME RANGE] Generated ${Object.keys(marks).length} marks with ${intervalSeconds}s interval`);

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
     * Handle slider update (real-time during drag)
     * @param {Array} values - [trimInSeconds, trimOutSeconds]
     */
    function handleSlide(values) {
        if (!isDragging) return;

        const trimInMs = parseInt(values[0]) * 1000;
        const trimOutMs = parseInt(values[1]) * 1000;

        // Update GPS markers in real-time (preview)
        if (gpsMapInstance) {
            const isFullRange = trimInMs <= fullRange[0] && trimOutMs >= fullRange[1];
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

        // Enable/disable apply button
        const isFullRange = trimInMs <= fullRange[0] && trimOutMs >= fullRange[1];
        applyBtn.disabled = isFullRange;

    }

    /**
     * Handle drag end
     */
    function handleDragEnd() {
        isDragging = false;
        console.log('[TIME RANGE MANAGER] Drag ended', currentRange);

        // Update status
        const isFullRange = currentRange[0] <= fullRange[0] && currentRange[1] >= fullRange[1];
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
