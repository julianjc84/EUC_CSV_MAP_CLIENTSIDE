// Canvas Chart Component
// High-performance canvas rendering with double buffering

// Data accessor functions for chart data processing
window.CanvasDataAccessors = {
    // Generic numeric accessor (returns null for invalid values)
    _n: function(value) {
        return (value !== null && !isNaN(value)) ? parseFloat(value) : null;
    }
};

window.EUCCanvasChart = function(containerId, options = {}) {
    let canvas, ctx;
    let targetCanvas, targetCtx;
    let chartData = null;
    let chartWidth = 0, chartHeight = 200;
    let marginLeft = 60, marginRight = 40, marginTop = 30, marginBottom = 40;  // Match PLOTLY_GRAPH_INTERNAL_MARGIN
    let mouseInside = false;
    let selectedIndex = -1;
    let onHoverCallback = null;
    let onHoverOutCallback = null;
    
    // Overlay state management (dynamic based on chart data)
    let overlayState = {};
    let overlayControls = [];
    let overlayControlsContainer = null;
    
    // Chart type configuration - match Plotly dual Y-axis structure
    let chartType = options.chartType || 'default';
    let leftAxisTitle = options.leftAxisTitle || '';
    let rightAxisTitle = options.rightAxisTitle || '';
    let hasSecondaryY = options.hasSecondaryY || false;
    
    // Viewport optimization with level-of-detail rendering
    let viewportStart = 0;
    let viewportEnd = -1;
    let publicAPI = null; // Set at bottom, referenced by init() for sync registration
    let resizeObserver = null; // Stored for cleanup in destroy()
    let maxRenderPoints = 5000;  // Maximum points to render at once
    let isLargeDataset = false;

    // Batched redraw optimization using requestAnimationFrame
    let pendingRedraw = false;

    /**
     * Schedule a batched redraw using requestAnimationFrame
     * This batches multiple sync events into a single render frame
     */
    function scheduleRedraw() {
        if (!pendingRedraw) {
            pendingRedraw = true;
            requestAnimationFrame(() => {
                if (selectedIndex >= 0) {
                    targetCtx.drawImage(canvas, 0, 0);
                    drawSelection(selectedIndex);
                }
                pendingRedraw = false;
            });
        }
    }

    /**
     * Find nearest datetime index using binary search (O(log n)).
     * Handles both string (ISO) and numeric timestamps in chartData.datetime.
     * @param {number} targetTimestamp - Target timestamp in milliseconds
     * @returns {number} Index of nearest data point
     */
    function findNearestDatetimeIndex(targetTimestamp) {
        const arr = chartData.datetime;
        let lo = 0, hi = arr.length - 1;
        while (lo < hi) {
            const mid = (lo + hi) >> 1;
            const midTime = typeof arr[mid] === 'number' ? arr[mid] : new Date(arr[mid]).getTime();
            if (midTime < targetTimestamp) {
                lo = mid + 1;
            } else {
                hi = mid;
            }
        }

        // Check if previous point is closer
        if (lo > 0) {
            const currentTime = typeof arr[lo] === 'number' ? arr[lo] : new Date(arr[lo]).getTime();
            const prevTime = typeof arr[lo - 1] === 'number' ? arr[lo - 1] : new Date(arr[lo - 1]).getTime();
            if (Math.abs(prevTime - targetTimestamp) < Math.abs(currentTime - targetTimestamp)) {
                return lo - 1;
            }
        }

        return lo;
    }

    // Throttle mouse move events to max 60fps (16.67ms)
    let lastMouseMoveTime = 0;
    let mouseMoveScheduled = false;
    const MOUSE_MOVE_THROTTLE = 16; // ms (60fps)

    // Chart configuration
    // Theme colors are populated by getThemeColors() from CSS custom properties before each draw.
    const config = {
        // Grid styling (non-theme)
        gridDash: [3, 3],
        gridWidth: 0.5,

        // Typography settings (non-theme)
        fontSize: 12,
        titleFontSize: 13,
        fontFamily: 'system-ui, -apple-system, sans-serif',

        // Line styling (non-theme)
        lineWidth: 1.5,

        // Annotation text colors (not theme-dependent — always white/black on series-colored bg)
        annotationTextColor: 'white',
        annotationAltitudeTextColor: '#000000',

        // Theme colors (set by getThemeColors() before each draw)
        backgroundColor: '',
        gridColor: '',
        axisLabelColor: '',
        axisTitleColor: '',
        verticalLineColor: '',
        axisLineColor: '',
        emptyTextColor: '',
        gapSegmentColor: '',
        annotationBorderColor: '',

        ...options
    };

    /**
     * Read theme colors from CSS custom properties.
     * Called before each draw() so charts respond to theme changes instantly.
     */
    function getThemeColors() {
        const style = getComputedStyle(document.body);
        config.backgroundColor = style.getPropertyValue('--chart-bg').trim();
        config.gridColor = style.getPropertyValue('--chart-grid').trim();
        config.axisLabelColor = style.getPropertyValue('--chart-axis-label').trim();
        config.axisTitleColor = style.getPropertyValue('--chart-axis-title').trim();
        config.verticalLineColor = style.getPropertyValue('--chart-hover-line').trim();
        config.axisLineColor = style.getPropertyValue('--chart-axis-line').trim();
        config.emptyTextColor = style.getPropertyValue('--chart-empty-text').trim();
        config.gapSegmentColor = style.getPropertyValue('--chart-gap-segment').trim();
        config.annotationBorderColor = style.getPropertyValue('--chart-annotation-border').trim();
    }

    // Initialize canvases with double buffering
    function init() {
        console.log('[CANVAS] Initializing EUCCanvasChart for:', containerId);
        const container = document.getElementById(containerId);
        if (!container) {
            console.error('[CANVAS] Container not found:', containerId);
            return;
        }
        console.log('[CANVAS] Found container:', container);

        // Register the public API object with sync system
        // (publicAPI is defined at the bottom of this function and captured by closure)
        if (window.eucChartSync) {
            window.eucChartSync.registerChart(containerId, publicAPI);
        }

        // Create main drawing canvas (offscreen)
        canvas = document.createElement('canvas');
        ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = false;

        // Create display canvas (visible)
        targetCanvas = document.createElement('canvas');
        targetCanvas.style.width = '100%';
        targetCanvas.style.height = chartHeight + 'px';
        targetCanvas.style.cursor = 'default';
        targetCanvas.style.border = 'none'; // Remove any border to match Plotly
        targetCanvas.style.outline = 'none'; // Remove outline too
        
        // Event listeners for interactions
        targetCanvas.addEventListener('mousemove', onCanvasMouseMove);
        targetCanvas.addEventListener('mouseout', onCanvasMouseOut);
        targetCanvas.addEventListener('contextmenu', onCanvasContextMenu);

        // Touch event listeners for mobile drag-scrubbing
        targetCanvas.style.touchAction = 'pan-y';
        targetCanvas.addEventListener('touchstart', onCanvasTouchStart, { passive: true });
        targetCanvas.addEventListener('touchmove', onCanvasTouchMove, { passive: false });
        targetCanvas.addEventListener('touchend', onCanvasTouchEnd, { passive: true });

        targetCtx = targetCanvas.getContext('2d');
        targetCtx.imageSmoothingEnabled = false;

        container.appendChild(targetCanvas);
        
        // Add CSS animations for overlays (do this once during init)
        addOverlayAnimations();
        
        // Set up ResizeObserver for proper container monitoring (modern browsers)
        if (window.ResizeObserver) {
            resizeObserver = new ResizeObserver(entries => {
                for (let entry of entries) {
                    console.log('[CANVAS] ResizeObserver triggered for:', containerId);
                    if (resize()) {
                        draw();
                    }
                }
            });
            resizeObserver.observe(container);
        } else {
            // Fallback for older browsers
            console.log('[CANVAS] Using window resize fallback for:', containerId);
            window.addEventListener('resize', onWindowResize);
        }
        
        // Clean initialization: wait for next frame when layout is complete
        requestAnimationFrame(() => {
            if (resize()) {
                console.log(`[CANVAS] ${containerId} initialized successfully`);
                if (chartData) {
                    draw();
                }
            } else {
                console.error(`[CANVAS] ${containerId} failed to initialize - container has no dimensions`);
            }
        });
    }

    function onCanvasContextMenu(e) {
        e.preventDefault();
        e.stopPropagation();
    }

    function onCanvasMouseMove(e) {
        if (!chartData || !chartData.datetime || chartData.datetime.length === 0) return;

        // Throttle to 60fps max
        const now = performance.now();
        if (now - lastMouseMoveTime < MOUSE_MOVE_THROTTLE) {
            // Schedule deferred update if not already scheduled
            if (!mouseMoveScheduled) {
                mouseMoveScheduled = true;
                setTimeout(() => {
                    mouseMoveScheduled = false;
                    onCanvasMouseMove(e); // Retry with same event
                }, MOUSE_MOVE_THROTTLE - (now - lastMouseMoveTime));
            }
            return;
        }
        lastMouseMoveTime = now;

        const perfStart = performance.now();
        const rect = targetCanvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        if (x > marginLeft && x < chartWidth - marginRight &&
            y > marginTop && y < chartHeight - marginBottom) {

            targetCanvas.style.cursor = 'crosshair';
            mouseInside = true;

            // Copy main canvas to display
            const canvasCopyStart = performance.now();
            targetCtx.drawImage(canvas, 0, 0);
            const canvasCopyTime = performance.now() - canvasCopyStart;

            // LINEAR TIME SCALE: Calculate timestamp based on mouse position
            const dataX = x - marginLeft;
            const dataWidth = chartWidth - marginLeft - marginRight;
            const dataRatio = dataX / dataWidth;

            // Map X position to timestamp
            const minTimestamp = new Date(chartData.datetime[0]).getTime();
            const maxTimestamp = new Date(chartData.datetime[chartData.datetime.length - 1]).getTime();
            const timeRange = maxTimestamp - minTimestamp;
            const mouseTimestamp = minTimestamp + (dataRatio * timeRange);

            // Find nearest data point to this timestamp using binary search
            const searchStart = performance.now();
            selectedIndex = findNearestDatetimeIndex(mouseTimestamp);
            const searchTime = performance.now() - searchStart;

            // Synchronize hover across all charts using timestamp (safer across downsampling)
            const syncStart = performance.now();
            if (window.eucChartSync) {
                const ts = chartData.datetime[selectedIndex];
                const timestampMs = new Date(ts).getTime();
                // Sync trace for diagnostics only
                if (window.EUC_DASH && window.EUC_DASH.syncTrace) {
                    window.EUC_DASH.syncTrace.push({ when: Date.now(), src: containerId, type: 'hover', index: selectedIndex, ts });
                }
                window.eucChartSync.syncHover({ index: selectedIndex, timestamp: timestampMs }, containerId);
            }
            const syncTime = performance.now() - syncStart;

            // Draw selection line and hover info
            const drawStart = performance.now();
            drawSelection(selectedIndex);
            const drawTime = performance.now() - drawStart;

            if (onHoverCallback) {
                onHoverCallback(selectedIndex, chartData);
            }

            const totalTime = performance.now() - perfStart;
            if (totalTime > 33) { // Only log if REALLY slow (>33ms = <30fps)
                console.log(`[PERF] Chart ${containerId}: ${totalTime.toFixed(2)}ms`);
            }
        } else {
            if (mouseInside) {
                targetCanvas.style.cursor = 'default';
                // Keep vertical line visible when leaving graph area (don't clear)

                if (onHoverOutCallback) {
                    onHoverOutCallback();
                }
                mouseInside = false;
            }
        }
    }

    function onCanvasMouseOut(e) {
        if (mouseInside) {
            targetCtx.drawImage(canvas, 0, 0);
            if (onHoverOutCallback) {
                onHoverOutCallback();
            }
            mouseInside = false;
            selectedIndex = -1;
        }
    }

    // Touch state for mobile drag-scrubbing
    let touchActive = false;
    let touchStartX = 0;
    let touchStartY = 0;

    function onCanvasTouchStart(e) {
        if (!chartData || !chartData.datetime || chartData.datetime.length === 0) return;
        if (e.touches.length !== 1) return;

        const touch = e.touches[0];
        touchStartX = touch.clientX;
        touchStartY = touch.clientY;
        touchActive = false; // Will activate on first horizontal move
    }

    function onCanvasTouchMove(e) {
        if (!chartData || !chartData.datetime || chartData.datetime.length === 0) return;
        if (e.touches.length !== 1) return;

        const touch = e.touches[0];

        // On first move, determine if gesture is horizontal (scrub) or vertical (scroll)
        if (!touchActive) {
            const dx = Math.abs(touch.clientX - touchStartX);
            const dy = Math.abs(touch.clientY - touchStartY);
            // Need at least 8px movement to decide direction
            if (dx < 8 && dy < 8) return;
            if (dx > dy) {
                // Horizontal gesture — activate scrubbing
                touchActive = true;
            } else {
                // Vertical gesture — let browser scroll
                return;
            }
        }

        // Prevent page scroll during horizontal scrub
        e.preventDefault();

        // Throttle to 60fps
        const now = performance.now();
        if (now - lastMouseMoveTime < MOUSE_MOVE_THROTTLE) return;
        lastMouseMoveTime = now;

        // Reuse the same selection logic as mouse hover
        const rect = targetCanvas.getBoundingClientRect();
        const x = touch.clientX - rect.left;
        const y = touch.clientY - rect.top;

        if (x > marginLeft && x < chartWidth - marginRight) {
            targetCanvas.style.cursor = 'crosshair';
            mouseInside = true;

            targetCtx.drawImage(canvas, 0, 0);

            // LINEAR TIME SCALE: Calculate timestamp based on touch position
            const dataX = x - marginLeft;
            const dataWidth = chartWidth - marginLeft - marginRight;
            const dataRatio = dataX / dataWidth;

            const minTimestamp = new Date(chartData.datetime[0]).getTime();
            const maxTimestamp = new Date(chartData.datetime[chartData.datetime.length - 1]).getTime();
            const timeRange = maxTimestamp - minTimestamp;
            const touchTimestamp = minTimestamp + (dataRatio * timeRange);

            // Find nearest data point using binary search
            selectedIndex = findNearestDatetimeIndex(touchTimestamp);

            // Sync hover across all charts
            if (window.eucChartSync) {
                const ts = chartData.datetime[selectedIndex];
                const timestampMs = new Date(ts).getTime();
                window.eucChartSync.syncHover({ index: selectedIndex, timestamp: timestampMs }, containerId);
            }

            drawSelection(selectedIndex);

            if (onHoverCallback) {
                onHoverCallback(selectedIndex, chartData);
            }
        }
    }

    function onCanvasTouchEnd(e) {
        if (touchActive) {
            // Keep the last selection visible (don't clear on touch end)
            touchActive = false;
        }
    }

    function onWindowResize() {
        resize();
        draw();
    }
    
    function determineAvailableOverlays(chartData) {
        if (!chartData || !chartData.series || chartData.series.length === 0) {
            return [];
        }
        
        const seriesNames = chartData.series.map(s => s.name);
        const availableOverlays = [];
        
        // Check for Speed data (either Wheel or GPS speed)
        if (seriesNames.some(name => name.includes('Speed'))) {
            availableOverlays.push({ key: 'maxSpeed', icon: '🚀', label: 'Max Speed' });
        }
        
        // Check for Power data
        if (seriesNames.some(name => name === 'Power')) {
            availableOverlays.push({ key: 'maxPower', icon: '🔌', label: 'Max Power' });
        }
        
        // Check for Current data
        if (seriesNames.some(name => name === 'Current')) {
            availableOverlays.push({ key: 'maxCurrent', icon: '⚡', label: 'Max Current' });
        }
        
        // Check for Altitude data
        if (seriesNames.some(name => name === 'Altitude (GPS)')) {
            availableOverlays.push({ key: 'maxAltitude', icon: '🏔️', label: 'Max Altitude' });
        }
        
        // Check for Temperature data (any temperature series)
        if (seriesNames.some(name => name.includes('Temp'))) {
            availableOverlays.push({ key: 'maxTemperature', icon: '🌡️', label: 'Max Temp' });
        }
        
        // Check for Tilt data
        if (seriesNames.some(name => name === 'Tilt')) {
            availableOverlays.push({ key: 'maxTilt', icon: '↗️', label: 'Max Tilt' });
            availableOverlays.push({ key: 'minTilt', icon: '↙️', label: 'Min Tilt' });
        }
        
        // Check for Roll data
        if (seriesNames.some(name => name === 'Roll')) {
            availableOverlays.push({ key: 'maxRoll', icon: '↪️', label: 'Max Roll' });
            availableOverlays.push({ key: 'minRoll', icon: '↩️', label: 'Min Roll' });
        }
        
        // Check for Battery data (Battery % series)
        if (seriesNames.some(name => name === 'Battery %')) {
            availableOverlays.push({ key: 'minBattery', icon: '🪫', label: 'Battery Min' });
        }
        
        // Check for PWM data
        if (seriesNames.some(name => name === 'PWM %')) {
            availableOverlays.push({ key: 'safetyMarginMin', icon: '🛡️', label: 'PWM Min' });
        }
        
        console.log(`[CANVAS] ${containerId} available overlays:`, availableOverlays.map(o => o.key));
        return availableOverlays;
    }
    
    function cleanupOverlayControls() {
        if (overlayControlsContainer && overlayControlsContainer.parentNode) {
            overlayControlsContainer.parentNode.removeChild(overlayControlsContainer);
            overlayControlsContainer = null;
        }
        overlayControls = [];
        overlayState = {};
    }
    
    function createOverlayControls() {
        const container = document.getElementById(containerId);
        if (!container) return;
        
        // Determine which overlays are available for this chart's data
        if (!chartData) {
            console.log(`[CANVAS] ${containerId} no chart data available for overlay detection`);
            return;
        }
        
        overlayControls = determineAvailableOverlays(chartData);
        
        // If no overlays available, don't create controls
        if (overlayControls.length === 0) {
            console.log(`[CANVAS] ${containerId} no overlay controls needed`);
            return;
        }
        
        // Initialize overlay state for available overlays
        overlayState = {};
        overlayControls.forEach(control => {
            overlayState[control.key] = true; // Default to enabled
        });
        
        // Create overlay controls container
        overlayControlsContainer = document.createElement('div');
        overlayControlsContainer.className = 'chart-overlay-controls';
        overlayControlsContainer.style.cssText = `
            position: absolute;
            top: 10px;
            right: 10px;
            display: flex;
            flex-direction: column;
            gap: 5px;
            z-index: 1000;
            pointer-events: auto;
        `;
        
        // Ensure container has position relative
        const computedPosition = window.getComputedStyle(container).position;
        if (computedPosition === 'static') {
            container.style.position = 'relative';
        }
        
        // Create individual overlay controls
        overlayControls.forEach(control => {
            const controlElement = createOverlayControl(control);
            overlayControlsContainer.appendChild(controlElement);
        });
        
        container.appendChild(overlayControlsContainer);
    }
    
    function createOverlayControl(control) {
        const button = document.createElement('button');
        button.className = `chart-overlay-btn chart-overlay-${control.key}`;
        button.title = control.label;
        
        // Style similar to GPS map overlay controls
        const isActive = overlayState[control.key];
        button.style.cssText = `
            background: ${isActive ? 'rgba(0, 123, 255, 0.9)' : 'rgba(255, 255, 255, 0.9)'};
            color: ${isActive ? 'white' : '#333'};
            border: 1px solid rgba(0, 0, 0, 0.2);
            border-radius: 4px;
            padding: 6px 8px;
            font-size: 12px;
            font-weight: 500;
            cursor: pointer;
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
            transition: all 0.2s ease;
            display: flex;
            align-items: center;
            gap: 4px;
            white-space: nowrap;
        `;
        
        button.innerHTML = `${control.icon} <span style="font-size: 10px;">${control.label}</span>`;
        
        // Add animation class
        if (isActive) {
            button.classList.add(`chart-overlay-marker-${control.key.replace('max', '').toLowerCase()}`);
        }
        
        // Add hover effects
        button.addEventListener('mouseenter', () => {
            if (overlayState[control.key]) {
                button.style.background = 'rgba(0, 123, 255, 1)';
            } else {
                button.style.background = 'rgba(255, 255, 255, 1)';
            }
            button.style.transform = 'translateY(-1px)';
            button.style.boxShadow = '0 2px 6px rgba(0, 0, 0, 0.3)';
        });
        
        button.addEventListener('mouseleave', () => {
            if (overlayState[control.key]) {
                button.style.background = 'rgba(0, 123, 255, 0.9)';
            } else {
                button.style.background = 'rgba(255, 255, 255, 0.9)';
            }
            button.style.transform = 'translateY(0)';
            button.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.2)';
        });
        
        // Add click handler for toggle functionality
        button.addEventListener('click', () => {
            toggleOverlay(control.key);
            updateOverlayControlAppearance(button, control.key);
        });
        
        return button;
    }
    
    function toggleOverlay(overlayKey) {
        overlayState[overlayKey] = !overlayState[overlayKey];
        console.log(`[CANVAS] ${containerId} toggled ${overlayKey}: ${overlayState[overlayKey]}`);
        
        // Redraw chart to show/hide overlay
        if (chartData) {
            draw();
        }
    }
    
    function updateOverlayControlAppearance(button, overlayKey) {
        const isActive = overlayState[overlayKey];
        button.style.background = isActive ? 'rgba(0, 123, 255, 0.9)' : 'rgba(255, 255, 255, 0.9)';
        button.style.color = isActive ? 'white' : '#333';
        
        // Handle animation classes
        const animationClass = `chart-overlay-marker-${overlayKey.replace('max', '').toLowerCase()}`;
        if (isActive) {
            button.classList.add(animationClass);
        } else {
            button.classList.remove(animationClass);
        }
    }
    
    function addOverlayAnimations() {
        // Add CSS keyframes for overlay animations
        if (!document.getElementById('chart-overlay-animations')) {
            const style = document.createElement('style');
            style.id = 'chart-overlay-animations';
            style.textContent = `
                @keyframes speedPulse {
                    0%, 100% { transform: scale(1); opacity: 0.8; }
                    50% { transform: scale(1.2); opacity: 1; }
                }
                
                @keyframes powerFlash {
                    0%, 100% { filter: brightness(1); }
                    25% { filter: brightness(1.3); }
                    50% { filter: brightness(1.6); }
                    75% { filter: brightness(1.3); }
                }
                
                @keyframes currentSpark {
                    0%, 100% { filter: brightness(1) drop-shadow(0 0 3px rgba(0, 123, 255, 0.4)); }
                    50% { filter: brightness(1.4) drop-shadow(0 0 8px rgba(0, 123, 255, 0.8)); }
                }
                
                @keyframes altitudeBob {
                    0%, 100% { transform: translateY(0); }
                    50% { transform: translateY(-3px); }
                }
                
                @keyframes temperatureGlow {
                    0%, 100% { filter: brightness(1) hue-rotate(0deg); }
                    33% { filter: brightness(1.2) hue-rotate(30deg); }
                    66% { filter: brightness(1.4) hue-rotate(60deg); }
                }
                
                .chart-overlay-marker-speed {
                    animation: speedPulse 2s ease-in-out infinite;
                }
                
                .chart-overlay-marker-power {
                    animation: powerFlash 3s ease-in-out infinite;
                }
                
                .chart-overlay-marker-current {
                    animation: currentSpark 1.5s ease-in-out infinite;
                }
                
                .chart-overlay-marker-altitude {
                    animation: altitudeBob 2.5s ease-in-out infinite;
                }
                
                .chart-overlay-marker-temperature {
                    animation: temperatureGlow 4s ease-in-out infinite;
                }
                
                .chart-overlay-marker-battery {
                    animation: batteryDrain 3s ease-in-out infinite;
                }
                
                @keyframes batteryDrain {
                    0%, 100% { transform: scale(1); opacity: 0.8; filter: brightness(1); }
                    25% { transform: scale(0.9); opacity: 0.6; filter: brightness(0.7); }
                    50% { transform: scale(1.05); opacity: 1; filter: brightness(1.2); }
                    75% { transform: scale(0.95); opacity: 0.7; filter: brightness(0.8); }
                }
                
                .chart-overlay-btn:hover {
                    animation: none !important;
                }
            `;
            document.head.appendChild(style);
        }
    }

    function resize() {
        const container = document.getElementById(containerId);
        if (!container) {
            console.error('[CANVAS] Container not found during resize:', containerId);
            return false;
        }
        
        // Check if container is visible - if not, defer initialization
        const computedStyle = window.getComputedStyle(container);
        const isVisible = computedStyle.display !== 'none' && computedStyle.visibility !== 'hidden';
        
        if (!isVisible) {
            console.log(`[CANVAS] ${containerId} container is hidden (display: ${computedStyle.display}), deferring resize`);
            return false;
        }
        
        // Force layout recalculation to ensure accurate dimensions
        container.offsetHeight; // This forces a layout recalculation
        
        // Use getBoundingClientRect for better dimension detection
        const rect = container.getBoundingClientRect();
        let containerWidth = rect.width;
        let containerHeight = rect.height;
        
        console.log(`[CANVAS] ${containerId} resize detection: rect=${rect.width}x${rect.height}, visible=${isVisible}`);
        
        // Fallback to offset dimensions if getBoundingClientRect returns 0
        if (containerWidth === 0) {
            containerWidth = container.offsetWidth;
            console.log(`[CANVAS] ${containerId} using offsetWidth fallback: ${containerWidth}`);
        }
        if (containerHeight === 0) {
            containerHeight = container.offsetHeight;
            console.log(`[CANVAS] ${containerId} using offsetHeight fallback: ${containerHeight}`);
        }
        
        // Last resort: computed styles
        if (containerWidth === 0) {
            const computedStyle = window.getComputedStyle(container);
            containerWidth = parseInt(computedStyle.width) || 0;
            console.log(`[CANVAS] ${containerId} using computed style width: ${containerWidth}`);
        }
        if (containerHeight === 0) {
            const computedStyle = window.getComputedStyle(container);
            containerHeight = parseInt(computedStyle.height) || chartHeight;
            console.log(`[CANVAS] ${containerId} using computed style height: ${containerHeight}`);
        }
        
        // Final fallback values
        if (containerWidth === 0) {
            console.warn(`[CANVAS] ${containerId} has zero width, using fallback`);
            containerWidth = 800; // Reasonable default
        }
        if (containerHeight === 0) {
            console.warn(`[CANVAS] ${containerId} has zero height, using fallback`);
            containerHeight = chartHeight;
        }
        
        // Validate dimensions before setting
        if (containerWidth < 50 || containerHeight < 50) {
            console.warn(`[CANVAS] ${containerId} dimensions too small: ${containerWidth}x${containerHeight}, retrying...`);
            return false;
        }
        
        // IMPORTANT: Use display dimensions for all drawing calculations
        // chartWidth should represent the actual drawing area, not physical canvas size
        chartWidth = containerWidth;  // This is the display width (e.g., 1176px)
        chartHeight = containerHeight; // This is the display height (e.g., 200px)
        
        // Set canvas size to match display dimensions exactly (no DPR scaling)
        if (!canvas || !targetCanvas) {
            console.error(`[CANVAS] ${containerId} Canvas elements not initialized properly:`, {
                canvas: !!canvas,
                targetCanvas: !!targetCanvas
            });
            return false;
        }
        
        canvas.width = chartWidth;
        canvas.height = chartHeight;
        targetCanvas.width = chartWidth;
        targetCanvas.height = chartHeight;
        
        // Set CSS display size (what user sees)
        targetCanvas.style.width = chartWidth + 'px';
        targetCanvas.style.height = chartHeight + 'px';
        
        // No context scaling needed - canvas size matches display size exactly
        
        console.log(`[CANVAS] ${containerId} canvas dimensions: ${chartWidth}x${chartHeight}px`);
        console.log(`[CANVAS] ${containerId} drawing coordinates: chartWidth=${chartWidth}, chartHeight=${chartHeight}`);
        return true;
    }

    function draw() {
        getThemeColors();
        console.log(`[CANVAS] ${containerId} draw() called, has data:`, !!chartData);
        if (!chartData || !chartData.datetime || chartData.datetime.length === 0) {
            console.log(`[CANVAS] ${containerId} no data available, drawing empty chart`);
            drawEmpty();
            return;
        }
        console.log(`[CANVAS] ${containerId} drawing chart with ${chartData.datetime.length} data points, ${chartData.series?.length || 0} series`);
        console.log(`[CANVAS] ${containerId} drawing area: ${chartWidth}x${chartHeight}, margins: L${marginLeft} R${marginRight} T${marginTop} B${marginBottom}`);

        // Check if we need viewport optimization
        updateViewport();

        // Clear canvas
        ctx.fillStyle = config.backgroundColor;
        ctx.fillRect(0, 0, chartWidth, chartHeight);

        // Draw grid
        drawGrid();
        
        // Draw Y-axis titles and labels
        drawAxes();

        // Draw data series with viewport optimization
        drawSeries();
        
        // Draw overlay markers at Y=0
        drawOverlayMarkers();

        // Copy to display canvas
        targetCtx.drawImage(canvas, 0, 0);
        
        // Redraw selection if active
        if (selectedIndex > -1) {
            drawSelection(selectedIndex);
        }
    }
    
    function updateViewport() {
        const dataLength = chartData.datetime.length;
        isLargeDataset = dataLength > maxRenderPoints;
        
        if (isLargeDataset) {
            // For large datasets, implement simple downsampling
            const step = Math.ceil(dataLength / maxRenderPoints);
            viewportStart = 0;
            viewportEnd = dataLength;
            
            // Could be enhanced with time-based viewport or zoom level
        } else {
            viewportStart = 0;
            viewportEnd = dataLength;
        }
    }
    
    function getOptimizedDataIndices() {
        // Return indices for efficient rendering
        if (!isLargeDataset) {
            return Array.from({length: viewportEnd - viewportStart}, (_, i) => i + viewportStart);
        }
        
        // Downsample for large datasets
        const step = Math.ceil((viewportEnd - viewportStart) / maxRenderPoints);
        const indices = [];
        
        for (let i = viewportStart; i < viewportEnd; i += step) {
            indices.push(i);
        }
        
        // Always include the last point
        if (indices[indices.length - 1] !== viewportEnd - 1) {
            indices.push(viewportEnd - 1);
        }
        
        return indices;
    }

    function drawEmpty() {
        getThemeColors();
        ctx.fillStyle = config.backgroundColor;
        ctx.fillRect(0, 0, chartWidth, chartHeight);

        ctx.fillStyle = config.emptyTextColor;
        ctx.font = '14px ' + config.fontFamily;
        ctx.textAlign = 'center';
        ctx.fillText('No data to display', chartWidth / 2, chartHeight / 2);
        
        targetCtx.drawImage(canvas, 0, 0);
    }

    function drawGrid() {
        const dataWidth = chartWidth - marginLeft - marginRight;
        const dataHeight = chartHeight - marginTop - marginBottom;
        
        // Match Plotly grid styling exactly
        ctx.strokeStyle = config.gridColor;         // 'rgba(0, 0, 0, 0.1)'
        ctx.lineWidth = config.gridWidth;           // 0.5
        ctx.setLineDash(config.gridDash);           // [3, 3] for dashdot
        
        // Vertical grid lines (match Plotly spacing)
        const verticalLines = 8;  // Reduce to match Plotly appearance
        for (let i = 1; i < verticalLines; i++) {  // Skip first and last lines
            const x = marginLeft + (i * dataWidth / verticalLines);
            ctx.beginPath();
            ctx.moveTo(x, marginTop);
            ctx.lineTo(x, chartHeight - marginBottom);
            ctx.stroke();
        }
        
        // Horizontal grid lines (match Plotly spacing)
        const horizontalLines = 4;  // Reduce to match Plotly appearance
        for (let i = 1; i < horizontalLines; i++) {  // Skip first and last lines
            const y = marginTop + (i * dataHeight / horizontalLines);
            ctx.beginPath();
            ctx.moveTo(marginLeft, y);
            ctx.lineTo(chartWidth - marginRight, y);
            ctx.stroke();
        }
        
        ctx.setLineDash([]);
    }

    function drawAxes() {
        const dataWidth = chartWidth - marginLeft - marginRight;
        const dataHeight = chartHeight - marginTop - marginBottom;
        
        // Draw axis lines
        ctx.strokeStyle = config.axisLineColor;
        ctx.lineWidth = 1;
        ctx.setLineDash([]);
        
        // Draw left Y-axis line
        ctx.beginPath();
        ctx.moveTo(marginLeft, marginTop);
        ctx.lineTo(marginLeft, chartHeight - marginBottom);
        ctx.stroke();
        
        // Draw right Y-axis line (if secondary Y-axis exists)
        if (hasSecondaryY) {
            ctx.beginPath();
            ctx.moveTo(chartWidth - marginRight, marginTop);
            ctx.lineTo(chartWidth - marginRight, chartHeight - marginBottom);
            ctx.stroke();
        }
        
        // Draw X-axis line (bottom)
        ctx.beginPath();
        ctx.moveTo(marginLeft, chartHeight - marginBottom);
        ctx.lineTo(chartWidth - marginRight, chartHeight - marginBottom);
        ctx.stroke();
        
        // Draw Y-axis titles
        if (leftAxisTitle) {
            drawYAxisTitle(leftAxisTitle, 'left');
        }
        if (rightAxisTitle && hasSecondaryY) {
            drawYAxisTitle(rightAxisTitle, 'right');
        }
        
        // Draw Y-axis tick labels  
        drawYAxisLabels();
        
        // Draw X-axis datetime labels
        drawXAxisLabels();
    }
    
    function drawYAxisTitle(title, side) {
        ctx.save();
        ctx.fillStyle = config.axisTitleColor;
        ctx.font = `${config.titleFontSize}px ${config.fontFamily}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        const dataHeight = chartHeight - marginTop - marginBottom;
        const centerY = marginTop + dataHeight / 2;
        
        if (side === 'left') {
            // Rotate for left Y-axis title
            ctx.save();
            ctx.translate(15, centerY);
            ctx.rotate(-Math.PI / 2);
            ctx.fillText(title, 0, 0);
            ctx.restore();
        } else if (side === 'right') {
            // Rotate for right Y-axis title
            ctx.save();
            ctx.translate(chartWidth - 15, centerY);
            ctx.rotate(Math.PI / 2);
            ctx.fillText(title, 0, 0);
            ctx.restore();
        }
        
        ctx.restore();
    }
    
    function drawYAxisLabels() {
        if (!chartData || !chartData.series || chartData.series.length === 0) return;
        
        ctx.fillStyle = config.axisLabelColor;
        ctx.font = `${config.fontSize}px ${config.fontFamily}`;
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        
        const dataHeight = chartHeight - marginTop - marginBottom;
        
        // Calculate value ranges for left and right axes
        const leftSeries = chartData.series.filter(s => !s.secondary_y);
        const rightSeries = chartData.series.filter(s => s.secondary_y);
        
        // Draw left Y-axis labels
        if (leftSeries.length > 0) {
            const leftValues = leftSeries.flatMap(s => (s.data || []).filter(v => window.CanvasDataAccessors._n(v) !== null));
            if (leftValues.length > 0) {
                let leftMin, leftMax, leftRange;

                // Check if this chart contains percentage-based data (PWM)
                const isPercentageChart = leftSeries.some(s => s.name === 'PWM %' ||
                                                               s.name.includes('Battery') || containerId.includes('battery'));

                if (isPercentageChart) {
                    // Force 0-100% scale for PWM and Battery
                    leftMin = 0;
                    leftMax = 100;
                    leftRange = 100;
                } else {
                    // Use dynamic scaling for other charts
                    leftMin = Math.min(...leftValues);
                    leftMax = Math.max(...leftValues);

                    // Symmetric zero-centered scaling for angle charts (Tilt & Roll)
                    if (chartType === 'orientation') {
                        const absMax = Math.max(Math.abs(leftMin), Math.abs(leftMax));
                        leftMin = -absMax;
                        leftMax = absMax;
                    }

                    leftRange = leftMax - leftMin || 1;
                }
                
                // Draw 5 tick labels
                for (let i = 0; i <= 4; i++) {
                    const value = leftMin + (leftRange * i / 4);
                    const y = marginTop + dataHeight - (i * dataHeight / 4);
                    ctx.fillText(value.toFixed(1), marginLeft - 5, y);
                }
            }
        }
        
        // Draw right Y-axis labels if secondary axis exists
        if (rightSeries.length > 0 && hasSecondaryY) {
            ctx.textAlign = 'left';
            const rightValues = rightSeries.flatMap(s => (s.data || []).filter(v => window.CanvasDataAccessors._n(v) !== null));
            if (rightValues.length > 0) {
                let rightMin, rightMax, rightRange;
                
                // Check if this chart contains percentage-based data (PWM)
                const isPercentageChart = rightSeries.some(s => s.name === 'PWM %' ||
                                                                s.name.includes('Battery') || containerId.includes('battery'));

                if (isPercentageChart) {
                    // Force 0-100% scale for PWM and Battery
                    rightMin = 0;
                    rightMax = 100;
                    rightRange = 100;
                } else {
                    // Use dynamic scaling for other charts
                    rightMin = Math.min(...rightValues);
                    rightMax = Math.max(...rightValues);
                    rightRange = rightMax - rightMin || 1;
                }
                
                // Draw 5 tick labels
                for (let i = 0; i <= 4; i++) {
                    const value = rightMin + (rightRange * i / 4);
                    const y = marginTop + dataHeight - (i * dataHeight / 4);
                    ctx.fillText(value.toFixed(1), chartWidth - marginRight + 5, y);
                }
            }
        }
    }
    
    function drawXAxisLabels() {
        if (!chartData || !chartData.datetime || chartData.datetime.length === 0) return;
        
        ctx.fillStyle = config.axisLabelColor;
        ctx.font = `${config.fontSize}px ${config.fontFamily}`;
        ctx.textAlign = 'center';

        const dataWidth = chartWidth - marginLeft - marginRight;
        const numLabels = 14; // Show 14 labels across the chart

        // LINEAR TIME SCALE: Calculate evenly spaced time intervals
        const minTimestamp = new Date(chartData.datetime[0]).getTime();
        const maxTimestamp = new Date(chartData.datetime[chartData.datetime.length - 1]).getTime();
        const timeRange = maxTimestamp - minTimestamp;

        // Check if distance data is available
        const hasDistanceData = chartData.distance && chartData.distance.length === chartData.datetime.length;

        for (let i = 0; i < numLabels; i++) {
            // Calculate evenly spaced timestamp
            const labelTimestamp = minTimestamp + (i * timeRange / (numLabels - 1));

            // Find nearest data point to this timestamp
            let nearestIndex = 0;
            let nearestDiff = Infinity;
            for (let j = 0; j < chartData.datetime.length; j++) {
                const pointTimestamp = new Date(chartData.datetime[j]).getTime();
                const diff = Math.abs(pointTimestamp - labelTimestamp);
                if (diff < nearestDiff) {
                    nearestDiff = diff;
                    nearestIndex = j;
                }
            }

            // Format timestamp for display
            const date = new Date(labelTimestamp);
            const timeLabel = date.toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: false
            });

            // Calculate X position based on time (evenly spaced)
            const x = marginLeft + (i * dataWidth / (numLabels - 1));

            // Draw time labels (primary scale) at bottom
            ctx.textBaseline = 'top';
            ctx.fillText(timeLabel, x, chartHeight - marginBottom + 5);

            // Draw distance labels (secondary scale) at top if available
            if (hasDistanceData) {
                const distance = chartData.distance[nearestIndex];
                if (distance !== null && distance !== undefined) {
                    const distanceLabel = `${distance.toFixed(1)}km`;

                    // Use smaller font and lighter color for distance
                    ctx.save();
                    ctx.font = `${Math.round(config.fontSize * 0.85)}px ${config.fontFamily}`;
                    ctx.fillStyle = config.axisLabelColor;
                    ctx.globalAlpha = 0.7;
                    ctx.textBaseline = 'bottom';
                    ctx.fillText(distanceLabel, x, marginTop - 5);
                    ctx.restore();
                }
            }
        }
    }

    function drawSeries() {
        if (!chartData.series) return;
        
        const dataWidth = chartWidth - marginLeft - marginRight;
        const dataHeight = chartHeight - marginTop - marginBottom;
        const dataLength = chartData.datetime.length;
        
        // Debug logging for first chart
        if (containerId === 'canvas-speed-gps') {
            console.log(`[CANVAS] ${containerId} drawSeries: ${chartData.series.length} series, ${dataLength} points`);
            chartData.series.forEach((s, i) => {
                console.log(`[CANVAS] ${containerId} series ${i}: ${s.name}, secondary_y: ${s.secondary_y}, data length: ${s.data?.length}`);
            });
        }
        
        // Calculate separate value ranges for left and right axes
        const leftSeries = chartData.series.filter(s => !s.secondary_y);
        const rightSeries = chartData.series.filter(s => s.secondary_y);
        
        if (containerId === 'canvas-speed-gps') {
            console.log(`[CANVAS] ${containerId} left series: ${leftSeries.length}, right series: ${rightSeries.length}`);
        }
        
        let leftMin = 0, leftMax = 1, leftPpy = dataHeight;
        let rightMin = 0, rightMax = 1, rightPpy = dataHeight;
        
        // Calculate left axis range
        if (leftSeries.length > 0) {
            // Check if this chart contains percentage-based data (PWM)
            const isPercentageChart = leftSeries.some(s => s.name === 'PWM %' ||
                                                           s.name.includes('Battery') || containerId.includes('battery'));

            if (isPercentageChart) {
                // Force 0-100% scale for PWM and Battery
                leftMin = 0;
                leftMax = 100;
            } else {
                // Use dynamic scaling - optimized single-pass min/max (PERFORMANCE FIX)
                leftMin = Infinity;
                leftMax = -Infinity;
                let hasValues = false;

                for (let s = 0; s < leftSeries.length; s++) {
                    const seriesData = leftSeries[s].data;
                    if (!seriesData) continue;
                    for (let i = 0; i < seriesData.length; i++) {
                        const value = window.CanvasDataAccessors._n(seriesData[i]);
                        if (value !== null) {
                            hasValues = true;
                            if (value < leftMin) leftMin = value;
                            if (value > leftMax) leftMax = value;
                        }
                    }
                }

                if (!hasValues) {
                    leftMin = 0;
                    leftMax = 1;
                }

                // Symmetric zero-centered scaling for angle charts (Tilt & Roll)
                if (chartType === 'orientation') {
                    const absMax = Math.max(Math.abs(leftMin), Math.abs(leftMax));
                    leftMin = -absMax;
                    leftMax = absMax;
                }
            }
            const leftRange = leftMax - leftMin || 1;
            leftPpy = dataHeight / leftRange;
        }

        // Calculate right axis range
        if (rightSeries.length > 0) {
            // Check if this chart contains percentage-based data (PWM)
            const isPercentageChart = rightSeries.some(s => s.name === 'PWM %' ||
                                                            s.name.includes('Battery') || containerId.includes('battery'));

            if (isPercentageChart) {
                // Force 0-100% scale for PWM and Battery
                rightMin = 0;
                rightMax = 100;
            } else {
                // Use dynamic scaling - optimized single-pass min/max (PERFORMANCE FIX)
                rightMin = Infinity;
                rightMax = -Infinity;
                let hasValues = false;

                for (let s = 0; s < rightSeries.length; s++) {
                    const seriesData = rightSeries[s].data;
                    if (!seriesData) continue;
                    for (let i = 0; i < seriesData.length; i++) {
                        const value = window.CanvasDataAccessors._n(seriesData[i]);
                        if (value !== null) {
                            hasValues = true;
                            if (value < rightMin) rightMin = value;
                            if (value > rightMax) rightMax = value;
                        }
                    }
                }

                if (!hasValues) {
                    rightMin = 0;
                    rightMax = 1;
                }
            }
            const rightRange = rightMax - rightMin || 1;
            rightPpy = dataHeight / rightRange;
        }
        
        // Draw each series with appropriate scaling
        chartData.series.forEach(series => {
            if (!series.data || series.data.length === 0) return;
            
            const isSecondary = series.secondary_y;
            const minVal = isSecondary ? rightMin : leftMin;
            const ppy = isSecondary ? rightPpy : leftPpy;
            
            // Set up clipping region
            ctx.save();
            const clipPath = new Path2D();
            clipPath.rect(marginLeft, marginTop, dataWidth, dataHeight);
            ctx.clip(clipPath);

            // Draw filled area if specified
            if (series.fill) {
                drawFilledSeries(series, dataWidth, dataHeight, dataLength, minVal, ppy);
            }

            // Draw line with efficient path rendering
            drawLineSeries(series, dataWidth, dataHeight, dataLength, minVal, ppy);
            
            ctx.restore();
        });
    }
    
    function drawLineSeries(series, dataWidth, dataHeight, dataLength, minVal, ppy) {
        ctx.strokeStyle = series.color || config.axisLineColor;
        ctx.lineWidth = series.width || config.lineWidth;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.setLineDash([]);

        // Calculate time range for linear time scale
        const minTimestamp = new Date(chartData.datetime[0]).getTime();
        const maxTimestamp = new Date(chartData.datetime[dataLength - 1]).getTime();
        const timeRange = maxTimestamp - minTimestamp || 1; // Avoid division by zero

        // Get optimized indices for viewport rendering
        const indices = getOptimizedDataIndices();

        // Create paths for efficient drawing (PERFORMANCE FIX: batch gap segments)
        const mainPath = new Path2D();
        const gapPaths = [];
        let hasValidPoint = false;
        let lastX = -1, lastY = -1;

        for (let idx = 0; idx < indices.length; idx++) {
            const i = indices[idx];
            const value = window.CanvasDataAccessors._n(series.data[i]);

            if (value !== null) {
                // LINEAR TIME SCALE: X position based on actual timestamp
                const timestamp = new Date(chartData.datetime[i]).getTime();
                const timeOffset = timestamp - minTimestamp;
                const x = marginLeft + (timeOffset / timeRange) * dataWidth;
                const y = marginTop + dataHeight - ((value - minVal) * ppy);

                if (!hasValidPoint) {
                    mainPath.moveTo(x, y);
                    hasValidPoint = true;
                } else {
                    // Check for data gaps
                    const prevIdx = idx > 0 ? indices[idx - 1] : i - 1;
                    if (prevIdx >= 0 && window.CanvasDataAccessors._n(series.data[prevIdx]) === null) {
                        // Collect gap segment for later batch drawing
                        const gapPath = new Path2D();
                        gapPath.moveTo(lastX, lastY);
                        gapPath.lineTo(x, y);
                        gapPaths.push(gapPath);
                        mainPath.moveTo(x, y);
                    } else {
                        mainPath.lineTo(x, y);
                    }
                }
                lastX = x;
                lastY = y;
            }
        }

        // Draw main path once
        ctx.stroke(mainPath);

        // Draw all gap segments in one batch (PERFORMANCE FIX)
        if (gapPaths.length > 0) {
            ctx.setLineDash([2, 2]);
            ctx.strokeStyle = config.gapSegmentColor;
            for (let i = 0; i < gapPaths.length; i++) {
                ctx.stroke(gapPaths[i]);
            }
        }
    }
    
    function drawFilledSeries(series, dataWidth, dataHeight, dataLength, minVal, ppy) {
        // Use exact Plotly fillcolor if specified, otherwise create gradient
        let fillStyle;
        if (series.fillcolor) {
            fillStyle = series.fillcolor;  // Use exact Plotly fillcolor
        } else {
            // Fallback gradient fill
            const gradient = ctx.createLinearGradient(0, marginTop, 0, marginTop + dataHeight);
            gradient.addColorStop(0, series.color + '40'); // 25% opacity at top
            gradient.addColorStop(1, series.color + '10'); // 6% opacity at bottom
            fillStyle = gradient;
        }

        ctx.fillStyle = fillStyle;

        // Calculate time range for linear time scale
        const minTimestamp = new Date(chartData.datetime[0]).getTime();
        const maxTimestamp = new Date(chartData.datetime[dataLength - 1]).getTime();
        const timeRange = maxTimestamp - minTimestamp || 1; // Avoid division by zero

        const fillPath = new Path2D();
        let firstPoint = true;

        // Start from bottom
        fillPath.moveTo(marginLeft, marginTop + dataHeight);

        // Use optimized indices for large datasets (PERFORMANCE FIX)
        const indices = getOptimizedDataIndices();
        for (let idx = 0; idx < indices.length; idx++) {
            const i = indices[idx];
            const value = window.CanvasDataAccessors._n(series.data[i]);
            if (value !== null) {
                // LINEAR TIME SCALE: X position based on actual timestamp
                const timestamp = new Date(chartData.datetime[i]).getTime();
                const timeOffset = timestamp - minTimestamp;
                const x = marginLeft + (timeOffset / timeRange) * dataWidth;
                const y = marginTop + dataHeight - ((value - minVal) * ppy);

                if (firstPoint) {
                    fillPath.lineTo(x, y);
                    firstPoint = false;
                } else {
                    fillPath.lineTo(x, y);
                }
            }
        }

        // Close to bottom
        fillPath.lineTo(marginLeft + dataWidth, marginTop + dataHeight);
        fillPath.closePath();

        ctx.fill(fillPath);
    }
    
    function drawOverlayMarkers() {
        if (!chartData || !chartData.series || chartData.series.length === 0) return;
        
        const dataWidth = chartWidth - marginLeft - marginRight;
        const dataLength = chartData.datetime.length;
        
        // Define positioning: MAX at top, MIN at bottom
        const topY = marginTop - 15; // Push MAX icons above chart area
        const bottomY = chartHeight - marginBottom + 12; // Push MIN icons below chart area (50% of previous distance)
        
        // Find max values and their indices
        const maxValues = findMaxValues();
        
        // Draw each overlay marker if enabled
        Object.keys(maxValues).forEach(overlayKey => {
            if (!overlayState[overlayKey] || !maxValues[overlayKey]) return;
            
            const maxData = maxValues[overlayKey];
            const x = marginLeft + (maxData.index * dataWidth / (dataLength - 1));
            
            // Get overlay control config for styling
            const control = overlayControls.find(c => c.key === overlayKey);
            if (!control) return;
            
            // Position based on overlay type: MAX at top, MIN at bottom
            const isMinimumValue = overlayKey.includes('min') || overlayKey.includes('Min');
            const y = isMinimumValue ? bottomY : topY;
            
            drawOverlayMarker(x, y, control, maxData.value);
        });
    }
    
    function findMaxValues() {
        const maxValues = {};
        
        // Find max speed (either Wheel or GPS speed)
        const speedSeries = chartData.series.find(s => s.name === 'Speed (Wheel)' || s.name === 'Speed (GPS)');
        if (speedSeries && overlayState.maxSpeed) {
            const maxSpeed = findMaxInSeries(speedSeries);
            if (maxSpeed) {
                maxValues.maxSpeed = maxSpeed;
            }
        }
        
        // Find max power  
        const powerSeries = chartData.series.find(s => s.name === 'Power');
        if (powerSeries && overlayState.maxPower) {
            const maxPower = findMaxInSeries(powerSeries);
            if (maxPower) {
                maxValues.maxPower = maxPower;
            }
        }
        
        // Find max current
        const currentSeries = chartData.series.find(s => s.name === 'Current');
        if (currentSeries && overlayState.maxCurrent) {
            const maxCurrent = findMaxInSeries(currentSeries);
            if (maxCurrent) {
                maxValues.maxCurrent = maxCurrent;
            }
        }
        
        // Find max altitude
        const altitudeSeries = chartData.series.find(s => s.name === 'Altitude (GPS)');
        if (altitudeSeries && overlayState.maxAltitude) {
            const maxAltitude = findMaxInSeries(altitudeSeries);
            if (maxAltitude) {
                maxValues.maxAltitude = maxAltitude;
            }
        }
        
        // Find max temperature (find the series with highest max temperature)
        if (overlayState.maxTemperature) {
            const tempSeries = chartData.series.filter(s => s.name.includes('Temp'));
            let maxTempOverall = null;
            let maxTempSeries = null;
            
            tempSeries.forEach(series => {
                const maxTemp = findMaxInSeries(series);
                if (maxTemp && (!maxTempOverall || maxTemp.value > maxTempOverall.value)) {
                    maxTempOverall = maxTemp;
                    maxTempSeries = series;
                }
            });
            
            if (maxTempOverall) {
                maxValues.maxTemperature = maxTempOverall;
            }
        }
        
        // Find max tilt
        if (overlayState.maxTilt) {
            const tiltSeries = chartData.series.find(s => s.name === 'Tilt');
            if (tiltSeries) {
                const maxTilt = findMaxInSeries(tiltSeries);
                if (maxTilt) {
                    maxValues.maxTilt = maxTilt;
                }
            }
        }
        
        // Find min tilt
        if (overlayState.minTilt) {
            const tiltSeries = chartData.series.find(s => s.name === 'Tilt');
            if (tiltSeries) {
                const minTilt = findMinInSeries(tiltSeries);
                if (minTilt) {
                    maxValues.minTilt = minTilt;
                }
            }
        }
        
        // Find max roll
        if (overlayState.maxRoll) {
            const rollSeries = chartData.series.find(s => s.name === 'Roll');
            if (rollSeries) {
                const maxRoll = findMaxInSeries(rollSeries);
                if (maxRoll) {
                    maxValues.maxRoll = maxRoll;
                }
            }
        }
        
        // Find min roll
        if (overlayState.minRoll) {
            const rollSeries = chartData.series.find(s => s.name === 'Roll');
            if (rollSeries) {
                const minRoll = findMinInSeries(rollSeries);
                if (minRoll) {
                    maxValues.minRoll = minRoll;
                }
            }
        }
        
        // Find min battery
        const batterySeries = chartData.series.find(s => s.name === 'Battery %');
        if (batterySeries && overlayState.minBattery) {
            const minBattery = findMinInSeries(batterySeries);
            if (minBattery) {
                maxValues.minBattery = minBattery;
            }
        }
        
        // Find min PWM
        const pwmSeries = chartData.series.find(s => s.name === 'PWM %');
        if (pwmSeries && overlayState.safetyMarginMin) {
            const minPWM = findMinInSeries(pwmSeries);
            if (minPWM) {
                maxValues.safetyMarginMin = minPWM;
            }
        }
        
        return maxValues;
    }
    
    function findMaxInSeries(series) {
        if (!series.data || series.data.length === 0) return null;
        
        let maxValue = -Infinity;
        let maxIndex = -1;
        
        for (let i = 0; i < series.data.length; i++) {
            const value = window.CanvasDataAccessors._n(series.data[i]);
            if (value !== null && value > maxValue) {
                maxValue = value;
                maxIndex = i;
            }
        }
        
        return maxIndex >= 0 ? { value: maxValue, index: maxIndex } : null;
    }
    
    function findMinInSeries(series) {
        if (!series.data || series.data.length === 0) return null;
        
        let minValue = Infinity;
        let minIndex = -1;
        
        for (let i = 0; i < series.data.length; i++) {
            const value = window.CanvasDataAccessors._n(series.data[i]);
            if (value !== null && value < minValue) {
                minValue = value;
                minIndex = i;
            }
        }
        
        return minIndex >= 0 ? { value: minValue, index: minIndex } : null;
    }
    
    function extractMainColor(gradientString) {
        // Extract the first color from a CSS gradient string for canvas use
        if (!gradientString) return 'rgba(0, 123, 255, 0.9)';
        
        // Handle linear-gradient syntax: linear-gradient(135deg, #ff6b35, #f7931e)
        if (gradientString.includes('linear-gradient')) {
            const colorMatch = gradientString.match(/#[0-9a-fA-F]{6}|#[0-9a-fA-F]{3}|rgba?\([^)]+\)/);
            return colorMatch ? colorMatch[0] : 'rgba(0, 123, 255, 0.9)';
        }
        
        // Handle direct color values
        const match = gradientString.match(/#[0-9a-fA-F]{6}|#[0-9a-fA-F]{3}|rgba?\([^)]+\)/);
        return match ? match[0] : gradientString;
    }
    
    function drawOverlayMarker(x, y, control, value) {
        // Get consistent styling from global config
        let overlayConfig = null;
        if (window.EUCOverlayConfig) {
            overlayConfig = Object.values(window.EUCOverlayConfig.overlays).find(
                overlay => overlay.chartKey === control.key
            );
        }
        
        const iconSize = 16;    // Icon size to match GPS map
        const iconBgSize = 12;  // Background circle size (24px diameter like GPS map)
        
        // Use consistent colors from global config or fallback
        const fillColor = overlayConfig ? overlayConfig.color : 'rgba(0, 123, 255, 0.9)';
        
        // Position the single icon element directly on the X-axis line
        const iconY = y;
        
        ctx.save();
        
        // Draw single icon background circle with white background
        ctx.fillStyle = 'white';
        ctx.strokeStyle = overlayConfig ? extractMainColor(fillColor) : 'rgba(0, 123, 255, 0.9)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(x, iconY, iconBgSize, 0, 2 * Math.PI);
        ctx.fill();
        ctx.stroke();
        
        // Draw icon using consistent emoji from global config (colored with overlay color)
        ctx.fillStyle = overlayConfig ? extractMainColor(fillColor) : 'rgba(0, 123, 255, 0.9)';
        ctx.font = `${iconSize}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const iconText = overlayConfig ? overlayConfig.icon : control.icon;
        ctx.fillText(iconText, x, iconY);
        
        ctx.restore();
    }
    
    function drawSelection(index) {
        if (!chartData || index < 0 || index >= chartData.datetime.length) return;

        const dataWidth = chartWidth - marginLeft - marginRight;

        // LINEAR TIME SCALE: Calculate X position based on timestamp
        const minTimestamp = new Date(chartData.datetime[0]).getTime();
        const maxTimestamp = new Date(chartData.datetime[chartData.datetime.length - 1]).getTime();
        const timeRange = maxTimestamp - minTimestamp || 1;
        const currentTimestamp = new Date(chartData.datetime[index]).getTime();
        const timeOffset = currentTimestamp - minTimestamp;
        const x = marginLeft + (timeOffset / timeRange) * dataWidth;

        // Debug: Show vertical line positioning calculation
        const percentage = (timeOffset / timeRange) * 100;
        console.log(`[CANVAS] ${containerId}: Drawing vertical line at index=${index}, time=${percentage.toFixed(1)}%, x=${x.toFixed(1)}px`);
        
        // Draw vertical line (match Plotly spike styling)
        targetCtx.strokeStyle = config.verticalLineColor;  // Match VERTICAL_LINE_COLOR
        targetCtx.lineWidth = 1;  // Match Plotly spikethickness
        targetCtx.setLineDash([]);
        targetCtx.beginPath();
        targetCtx.moveTo(x, marginTop);
        targetCtx.lineTo(x, chartHeight - marginBottom);
        targetCtx.stroke();
        
        // Draw positioned annotations (exact Plotly-style)
        if (chartData.series) {
            drawPlotlyStyleAnnotations(index, x);
        }
    }
    
    function drawPlotlyStyleAnnotations(index, x) {
        // Plotly positioning system: 4 slots for annotation placement
        const plotlyPositions = [
            { xanchor: 'right', y_start: 0.98, y_step: -0.085, yanchor: 'top' },    // 0: TOP-RIGHT (drawn LEFT of line)
            { xanchor: 'left',  y_start: 0.98, y_step: -0.085, yanchor: 'top' },    // 1: TOP-LEFT (drawn RIGHT of line)
            { xanchor: 'right', y_start: 0.02, y_step:  0.085, yanchor: 'bottom' }, // 2: BOTTOM-RIGHT (drawn LEFT of line)
            { xanchor: 'left',  y_start: 0.02, y_step:  0.085, yanchor: 'bottom' }  // 3: BOTTOM-LEFT (drawn RIGHT of line)
        ];

        const seriesPositionMap = getSeriesPositionMap();
        const padding = 3;
        const fontSize = 11;
        const tooltipGap = 8;
        const textHeight = fontSize + 2;
        const tooltipHeight = textHeight + padding * 2;
        const stackGap = 2;
        const edgePadding = 4;
        const minY = marginTop + edgePadding + tooltipHeight / 2;
        const maxY = chartHeight - marginBottom - edgePadding - tooltipHeight / 2;

        // Track current Y positions for each position slot
        let currentPositions = plotlyPositions.map(pos => ({
            ...pos,
            current_y: (chartHeight - marginBottom) - (pos.y_start * (chartHeight - marginTop - marginBottom))
        }));

        // Phase 1: Collect all annotations with dimensions, detect which need to flip
        const annotations = [];
        chartData.series.forEach(series => {
            if (!series.data) return;
            const value = window.CanvasDataAccessors._n(series.data[index]);
            if (value !== null) {
                const positionIndex = seriesPositionMap[series.name];
                if (positionIndex !== undefined) {
                    targetCtx.font = `bold ${fontSize}px ${config.fontFamily}`;
                    const nameWidth = targetCtx.measureText(series.name).width;
                    targetCtx.font = `${fontSize}px ${config.fontFamily}`;
                    const valueText = `: ${value.toFixed(1)}${series.unit || ''}`;
                    const valueWidth = targetCtx.measureText(valueText).width;
                    const totalWidth = nameWidth + valueWidth + padding * 2;

                    const pos = currentPositions[positionIndex];
                    let xanchor = pos.xanchor;
                    let flipped = false;

                    if (xanchor === 'left') {
                        if (x + tooltipGap + totalWidth > chartWidth - marginRight) {
                            xanchor = 'right';
                            flipped = true;
                        }
                    } else {
                        if (x - tooltipGap - totalWidth < marginLeft) {
                            xanchor = 'left';
                            flipped = true;
                        }
                    }

                    annotations.push({
                        name: series.name,
                        value: value,
                        color: series.color,
                        unit: series.unit || '',
                        xanchor: xanchor,
                        y: pos.current_y,
                        isTop: positionIndex <= 1,
                        flipped: flipped,
                        totalWidth: totalWidth
                    });

                    pos.current_y -= pos.y_step * (chartHeight - marginTop - marginBottom);
                }
            }
        });

        // Phase 2: Draw non-flipped annotations first, track their Y positions by quadrant
        // Quadrants: which side of the line (left/right) × vertical area (top/bottom)
        // xanchor='right' → drawn LEFT of line, xanchor='left' → drawn RIGHT of line
        const quadrantYs = { topLeft: [], topRight: [], bottomLeft: [], bottomRight: [] };

        const getQuadrant = (ann) => {
            const side = ann.xanchor === 'right' ? 'Left' : 'Right';
            const area = ann.isTop ? 'top' : 'bottom';
            return area + side;
        };

        for (const ann of annotations.filter(a => !a.flipped)) {
            const y = Math.max(minY, Math.min(maxY, ann.y));
            drawPlotlyAnnotation(x, y, ann.name, ann.value, ann.color, ann.unit, ann.xanchor);
            quadrantYs[getQuadrant(ann)].push(y);
        }

        // Phase 3: Draw flipped annotations, positioned relative to existing ones
        // Top flipped → below existing top annotations on target side
        // Bottom flipped → above existing bottom annotations on target side
        for (const ann of annotations.filter(a => a.flipped)) {
            const quadrant = getQuadrant(ann);
            const existing = quadrantYs[quadrant];
            let y;

            if (ann.isTop) {
                if (existing.length > 0) {
                    const lowestExisting = Math.max(...existing);
                    y = lowestExisting + tooltipHeight + stackGap;
                } else {
                    y = ann.y;
                }
            } else {
                if (existing.length > 0) {
                    const highestExisting = Math.min(...existing);
                    y = highestExisting - tooltipHeight - stackGap;
                } else {
                    y = ann.y;
                }
            }

            y = Math.max(minY, Math.min(maxY, y));
            drawPlotlyAnnotation(x, y, ann.name, ann.value, ann.color, ann.unit, ann.xanchor);
            quadrantYs[quadrant].push(y);
        }
    }
    
    function getSeriesPositionMap() {
        // Return exact Plotly positioning for each series based on chart type
        // This maps series names to position indices (0=TOP-RIGHT, 1=TOP-LEFT, 2=BOTTOM-RIGHT, 3=BOTTOM-LEFT)
        
        // Check what type of chart we have based on series present
        const seriesNames = chartData.series.map(s => s.name);
        
        if (seriesNames.includes('Speed (Wheel)') || seriesNames.includes('Speed (GPS)')) {
            // Speed/GPS Chart
            return {
                'Speed (Wheel)': 0,   // TOP-RIGHT
                'Speed (GPS)': 1,     // TOP-LEFT  
                'Altitude (GPS)': 2   // BOTTOM-RIGHT
            };
        } else if (seriesNames.includes('Battery %') || seriesNames.includes('PWM %')) {
            // Battery/PWM Chart
            return {
                'Battery %': 0,       // TOP-RIGHT
                'PWM %': 1           // TOP-LEFT (all formats)
            };
        } else if (seriesNames.includes('Power') || seriesNames.includes('Energy Consumption')) {
            // Power Chart (Energy + Power)
            return {
                'Energy Consumption': 1,  // TOP-LEFT (left Y-axis)
                'Power': 0               // TOP-RIGHT (right Y-axis)
            };
        } else if (seriesNames.includes('Voltage') || seriesNames.includes('Current')) {
            // Voltage/Current Chart
            return {
                'Current': 0,         // TOP-RIGHT → LEFT side (left Y-axis)
                'Voltage': 1          // TOP-LEFT → RIGHT side (right Y-axis)
            };
        } else if (seriesNames.includes('Tilt') || seriesNames.includes('Roll')) {
            // Tilt/Roll Chart
            return {
                'Tilt': 0,            // TOP-RIGHT (left Y-axis)
                'Roll': 1             // TOP-LEFT (right Y-axis)
            };
        } else if (seriesNames.includes('Acceleration')) {
            // Acceleration Chart
            return {
                'Acceleration': 0     // TOP-RIGHT
            };
        } else {
            // Temperature Chart
            return {
                'Temp (System)': 0,   // TOP-RIGHT
                'Temp (Motor)': 1,    // TOP-LEFT
                'Temp (Battery)': 2,  // BOTTOM-RIGHT
                'CPU Load': 3         // BOTTOM-LEFT
            };
        }
    }
    
    function drawPlotlyAnnotation(x, y, name, value, color, unit, xanchor) {
        // Format exactly like Plotly: <b>Series Name</b>: Value Unit
        const text = `${name}: ${value.toFixed(1)}${unit}`;
        const padding = 3;  // Exact Plotly borderpad
        const fontSize = 11; // Exact Plotly annotation font size
        
        targetCtx.font = `bold ${fontSize}px ${config.fontFamily}`;
        const nameWidth = targetCtx.measureText(name).width;
        targetCtx.font = `${fontSize}px ${config.fontFamily}`;
        const valueWidth = targetCtx.measureText(`: ${value.toFixed(1)}${unit}`).width;
        const textWidth = nameWidth + valueWidth;
        const textHeight = fontSize + 2;
        
        // Add edge padding to keep tooltips away from graph edges
        const edgePadding = 4;
        const tooltipHeight = textHeight + padding * 2;
        
        // Constrain Y position to stay within graph area with edge padding
        const minY = marginTop + edgePadding + tooltipHeight / 2;
        const maxY = chartHeight - marginBottom - edgePadding - tooltipHeight / 2;
        y = Math.max(minY, Math.min(maxY, y));
        
        // Calculate position based on anchor (exact Plotly logic)
        let rectX = x + 8;
        if (xanchor === 'right') {
            rectX = x - textWidth - padding * 2 - 8;
        }
        
        // Background with exact Plotly styling
        const bgColor = hexToRgba(color || '#000000', 0.85); // Exact Plotly opacity
        targetCtx.fillStyle = bgColor;
        targetCtx.fillRect(rectX, y - textHeight/2 - padding, textWidth + padding * 2, textHeight + padding);
        
        // Border
        targetCtx.strokeStyle = config.annotationBorderColor;
        targetCtx.lineWidth = 0.5;
        targetCtx.strokeRect(rectX, y - textHeight/2 - padding, textWidth + padding * 2, textHeight + padding);
        
        // Text with exact Plotly colors
        const textColor = (name === 'Altitude (GPS)') ? '#000000' : '#ffffff'; // Altitude uses black, others white
        targetCtx.fillStyle = textColor;
        
        // Draw bold series name
        targetCtx.font = `bold ${fontSize}px ${config.fontFamily}`;
        targetCtx.fillText(name, rectX + padding, y + textHeight/2 - 2);
        
        // Draw regular value
        targetCtx.font = `${fontSize}px ${config.fontFamily}`;
        targetCtx.fillText(`: ${value.toFixed(1)}${unit}`, rectX + padding + nameWidth, y + textHeight/2 - 2);
    }
    
    function hexToRgba(hex, alpha) {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }

    // Public API (single object used by both app.js and eucChartSync)
    publicAPI = {
        init: init,
        
        setData: function(data) {
            console.log(`[CANVAS] ${containerId} setData() called with:`, data ? 'valid data' : 'null/undefined');
            if (data) {
                console.log(`[CANVAS] ${containerId} data contains: ${data.datetime?.length || 0} points, ${data.series?.length || 0} series`);
            }
            chartData = data;
            
            // Initialize overlay state for available data (but don't create UI controls)
            if (chartData) {
                // Clean up existing controls first
                cleanupOverlayControls();
                
                // Initialize overlay state based on available data
                overlayControls = determineAvailableOverlays(chartData);
                overlayState = {};
                overlayControls.forEach(control => {
                    overlayState[control.key] = true; // Default to enabled
                });
                
                // Note: No createOverlayControls() - GPS map controls everything now
                console.log(`[CANVAS] ${containerId} initialized overlay state (controlled by GPS map):`, Object.keys(overlayState));
            }
            
            // Ensure canvas is properly sized before drawing
            if (chartWidth === 0 || canvas.width === 0) {
                console.log(`[CANVAS] ${containerId} not properly initialized (chartWidth=${chartWidth}, canvas.width=${canvas.width}), attempting resize...`);
                if (resize()) {
                    console.log(`[CANVAS] ${containerId} resize successful, drawing chart`);
                    draw();
                } else {
                    console.warn(`[CANVAS] ${containerId} resize failed, scheduling retry...`);
                    setTimeout(() => {
                        if (resize()) {
                            console.log(`[CANVAS] ${containerId} retry resize successful`);
                            draw();
                        }
                    }, 100);
                }
            } else {
                console.log(`[CANVAS] ${containerId} canvas ready (${chartWidth}x${chartHeight}), drawing chart`);
                draw();
            }
        },
        
        setSize: function(width, height) {
            if (height) chartHeight = height;
            resize();
            draw();
        },
        
        setOnHover: function(callback) {
            onHoverCallback = callback;
        },
        
        setOnHoverOut: function(callback) {
            onHoverOutCallback = callback;
        },
        
        redraw: function() {
            draw();
        },
        
        destroy: function() {
            window.removeEventListener('resize', onWindowResize);
            if (targetCanvas && targetCanvas.parentNode) {
                targetCanvas.parentNode.removeChild(targetCanvas);
            }
        },
        
        // External synchronization methods
        syncHover: function(index) {
            if (index >= 0 && index < (chartData?.datetime?.length || 0)) {
                selectedIndex = index;
                targetCtx.drawImage(canvas, 0, 0);
                drawSelection(selectedIndex);
            }
        },
        // Timestamp-based sync: find nearest index by timestamp (ms)
        syncHoverTs: function(timestampMs) {
            if (!chartData || !chartData.datetime || chartData.datetime.length === 0) return;

            const perfStart = performance.now();

            const nearest = findNearestDatetimeIndex(timestampMs);
            const arr = chartData.datetime;

            if (nearest >= 0 && nearest < arr.length) {
                selectedIndex = nearest;
                targetCtx.drawImage(canvas, 0, 0);
                drawSelection(selectedIndex);

                const actualTimestamp = typeof arr[nearest] === 'number' ? arr[nearest] : new Date(arr[nearest]).getTime();

                // If there's a significant difference, sync back the actual timestamp to keep everything aligned
                // BUT skip this feedback when hovering on GPS map to avoid position conflicts
                if (Math.abs(actualTimestamp - timestampMs) > 10) {
                    // Don't sync back to GPS map if it's currently being controlled by mouse hover
                    const isGPSHover = window.eucChartSync?.gpsMap?.popupPinnedBy === 'map';
                    if (!isGPSHover) {
                        setTimeout(() => {
                            if (window.eucChartSync && window.eucChartSync.gpsMap && typeof window.eucChartSync.gpsMap.updatePositionByTimestamp === 'function') {
                                window.eucChartSync.gpsMap.updatePositionByTimestamp(actualTimestamp, { centerIfNearEdge: true, showPopup: true });
                            }
                        }, 10);
                    }
                }
            }
        },
        
        syncHoverOut: function() {
            // Keep vertical line visible when leaving graph area
            // selectedIndex = -1;
            // targetCtx.drawImage(canvas, 0, 0);
        },
        
        // Debug methods
        getDebugInfo: function() {
            return {
                containerId: containerId,
                chartWidth: chartWidth,
                chartHeight: chartHeight,
                canvasWidth: canvas ? canvas.width : 'not created',
                canvasHeight: canvas ? canvas.height : 'not created',
                hasData: chartData ? true : false,
                dataPoints: chartData?.datetime?.length || 0,
                seriesCount: chartData?.series?.length || 0,
                mouseInside: mouseInside,
                selectedIndex: selectedIndex
            };
        },
        
        isInitialized: function() {
            return canvas && targetCanvas && chartWidth > 0 && canvas.width > 0;
        },

        // Get render statistics
        getRenderStats: function() {
            if (!chartData || !chartData.datetime) {
                return {
                    totalPoints: 0,
                    renderedPoints: 0,
                    isDownsampled: false
                };
            }

            const totalPoints = chartData.datetime.length;
            // Calculate directly from data length (don't rely on isLargeDataset
            // which may not be set yet if draw() was deferred)
            const downsampled = totalPoints > maxRenderPoints;
            const renderedPoints = downsampled ? maxRenderPoints : totalPoints;

            return {
                totalPoints: totalPoints,
                renderedPoints: renderedPoints,
                isDownsampled: downsampled,
                downsampleThreshold: maxRenderPoints
            };
        },

        // Re-initialize when container becomes visible
        reinitialize: function() {
            console.log(`[CANVAS] ${containerId} manual re-initialization requested`);
            
            // Check if canvas elements exist, if not, call init first
            if (!canvas || !targetCanvas) {
                console.log(`[CANVAS] ${containerId} Canvas elements missing, calling init first`);
                if (!publicAPI.init()) {
                    console.error(`[CANVAS] ${containerId} Failed to initialize chart`);
                    return false;
                }
            }
            
            if (resize()) {
                console.log(`[CANVAS] ${containerId} re-initialization successful`);
                if (chartData) {
                    draw();
                }
                return true;
            }
            return false;
        },
        
        // Overlay control methods
        setOverlayVisibility: function(overlayKey, visible) {
            if (overlayState.hasOwnProperty(overlayKey)) {
                overlayState[overlayKey] = visible;
                
                // Update control button appearance
                if (overlayControlsContainer) {
                    const button = overlayControlsContainer.querySelector(`.chart-overlay-${overlayKey}`);
                    if (button) {
                        updateOverlayControlAppearance(button, overlayKey);
                    }
                }
                
                // Redraw chart
                if (chartData) {
                    draw();
                }
            }
        },
        
        getOverlayState: function() {
            return { ...overlayState };
        },
        
        // Listen for overlay state changes from GPS map
        updateOverlayVisibility: function(overlayId, isVisible) {
            // Map GPS overlay IDs to chart overlay keys
            const overlayMapping = {
                'maxSpeed': 'maxSpeed',           // 🚀 Max Speed
                'maxPower': 'maxPower',           // 🔌️ Max Power 
                'maxCurrent': 'maxCurrent',       // ⚡ Max Current
                'maxElevation': 'maxAltitude',    // 🏔️ Max Elevation/Altitude
                'maxMotorTemp': 'maxTemperature', // 🌡️ Max Motor Temp
                'maxControllerTemp': 'maxTemperature', // 🌡️ Max Controller Temp
                'maxBatteryTemp': 'maxTemperature',    // 🔥 Max Battery Temp
                'maxBatteryMin': 'minBattery',    // 🪫 Battery Min
                'safetyMarginMin': 'safetyMarginMin', // 🛡️ PWM Min
                'maxTilt': 'maxTilt',             // ↗️ Max Tilt
                'minTilt': 'minTilt',             // ↙️ Min Tilt
                'maxRoll': 'maxRoll',             // ↪️ Max Roll
                'minRoll': 'minRoll'              // ↩️ Min Roll
                // Note: speedRoute, safetyRoute, zeroSafety don't apply to charts
            };
            
            const chartOverlayKey = overlayMapping[overlayId];
            if (chartOverlayKey && overlayState.hasOwnProperty(chartOverlayKey)) {
                console.log(`[CANVAS] ${containerId} updating overlay ${chartOverlayKey} to ${isVisible}`);
                overlayState[chartOverlayKey] = isVisible;
                
                // Update control button appearance if it exists
                if (overlayControlsContainer) {
                    const button = overlayControlsContainer.querySelector(`.chart-overlay-${chartOverlayKey}`);
                    if (button) {
                        updateOverlayControlAppearance(button, chartOverlayKey);
                    }
                }
                
                // Redraw chart to show/hide overlay
                if (chartData) {
                    draw();
                }
            }
        },

        // Destroy chart instance and clean up resources
        destroy: function() {
            console.log(`[CANVAS] Destroying chart: ${containerId}`);

            // Disconnect ResizeObserver
            if (resizeObserver) {
                resizeObserver.disconnect();
                resizeObserver = null;
            }

            // Remove all event listeners from targetCanvas (where they were added)
            if (targetCanvas) {
                targetCanvas.removeEventListener('mousemove', onCanvasMouseMove);
                targetCanvas.removeEventListener('mouseout', onCanvasMouseOut);
                targetCanvas.removeEventListener('contextmenu', onCanvasContextMenu);
                targetCanvas.removeEventListener('touchstart', onCanvasTouchStart);
                targetCanvas.removeEventListener('touchmove', onCanvasTouchMove);
                targetCanvas.removeEventListener('touchend', onCanvasTouchEnd);
            }

            // Clean up overlay controls
            cleanupOverlayControls();

            // Clear canvases
            if (ctx) {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
            }
            if (targetCtx) {
                targetCtx.clearRect(0, 0, targetCanvas.width, targetCanvas.height);
            }

            // Remove canvases from DOM
            if (canvas && canvas.parentNode) {
                canvas.parentNode.removeChild(canvas);
            }
            if (targetCanvas && targetCanvas.parentNode) {
                targetCanvas.parentNode.removeChild(targetCanvas);
            }

            // Clear references
            canvas = null;
            ctx = null;
            targetCanvas = null;
            targetCtx = null;
            chartData = null;
            overlayState = {};
            overlayControls = [];
            overlayControlsContainer = null;

            console.log(`[CANVAS] Chart ${containerId} destroyed`);
        }
    };

    return publicAPI;
};

