/**
 * EUC Ride Data Viewer - Main Application Controller
 * Client-Side Version
 */

import { FormatDetector } from './processors/format-detector.js';
import { EUCWorldProcessor } from './processors/eucworld-processor.js';
import { WheelLogProcessor } from './processors/wheellog-processor.js';
import { DarknessBotProcessor } from './processors/darknessbot-processor.js';
import { createTimeRangeManager } from './time-range-manager.mjs';
import { calculateRideStats } from './ride-stats.js';
import { calculateOverviewStats, formatExtraKey } from './overview-stats.js';
import { getTooltipContent } from './stat-metadata.js';
import { formatFileSize } from './format-utils.js';

/**
 * Initialize Bootstrap tooltips within a container element.
 * Disposes existing tooltip instances first to prevent duplicates.
 * Uses manual trigger so we control open/close entirely via click handler.
 * @param {HTMLElement} container - DOM element to search for tooltip triggers
 */
function initBootstrapTooltips(container) {
    if (!container) return;
    const triggers = container.querySelectorAll('[data-bs-toggle="tooltip"]');
    [...triggers].forEach(el => {
        const existing = bootstrap.Tooltip.getInstance(el);
        if (existing) existing.dispose();
        new bootstrap.Tooltip(el, { trigger: 'manual' });
    });
}

// Global state
let currentData = null;
let originalData = null;
let currentProcessor = null;
let gpsMapInstance = null;
let timeRangeManager = null;
let rawParsedCSV = null; // Store raw parsed CSV for reprocessing
let csvHeaders = null; // Store CSV column headers for diagnostic view
let currentFilename = null; // Store filename for reprocessing
let loadedFromServer = false; // Track if file was loaded from server directory listing
let currentFileModifiedDate = null; // Store file modified date for display

// ==================== Theme Hue Customization ====================

/**
 * Convert HSL to RGB.
 * @param {number} h - Hue (0-360)
 * @param {number} s - Saturation (0-100)
 * @param {number} l - Lightness (0-100)
 * @returns {number[]} [r, g, b] each 0-255
 */
function hslToRgb(h, s, l) {
    h /= 360;
    s /= 100;
    l /= 100;
    let r, g, b;
    if (s === 0) {
        r = g = b = l;
    } else {
        const hue2rgb = (p, q, t) => {
            if (t < 0) t += 1;
            if (t > 1) t -= 1;
            if (t < 1/6) return p + (q - p) * 6 * t;
            if (t < 1/2) return q;
            if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
            return p;
        };
        const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        const p = 2 * l - q;
        r = hue2rgb(p, q, h + 1/3);
        g = hue2rgb(p, q, h);
        b = hue2rgb(p, q, h - 1/3);
    }
    return [r * 255, g * 255, b * 255];
}

/**
 * Get contrast text color (black or white) for a given HSL background.
 * @param {number} h - Hue (0-360)
 * @param {number} s - Saturation (0-100)
 * @param {number} l - Lightness (0-100)
 * @returns {string} '#000' or '#fff'
 */
function getContrastText(h, s, l) {
    const [r, g, b] = hslToRgb(h, s, l);
    const brightness = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return brightness > 0.5 ? '#000' : '#fff';
}

/**
 * Apply theme hue to all CSS variables (accent, footer, charts). Null removes all overrides.
 * @param {number|null} hue - Hue value (0-360) or null to reset
 */
function applyThemeHue(hue) {
    const style = document.body.style;
    const allVars = [
        // Accent
        '--theme-accent', '--theme-accent-hover', '--theme-accent-outline',
        '--theme-accent-bg-hover', '--theme-accent-glow',
        '--theme-btn-primary-bg', '--theme-btn-primary-border', '--theme-btn-primary-text',
        '--theme-btn-primary-hover-bg', '--theme-btn-primary-hover-border',
        '--theme-btn-outline-border', '--theme-btn-outline-text',
        '--theme-btn-outline-hover-bg', '--theme-btn-outline-hover-text',
        '--theme-tooltip-border', '--theme-tooltip-shadow', '--theme-tooltip-arrow',
        '--theme-code-text', '--theme-table-secondary-strong',
        // Footer
        '--theme-footer-accent', '--theme-footer-link', '--theme-footer-link-hover',
        // Charts
        '--chart-grid', '--chart-axis-line', '--chart-axis-label', '--chart-axis-title',
        '--chart-hover-line', '--chart-empty-text', '--chart-gap-segment', '--chart-annotation-border'
    ];

    if (hue === null) {
        allVars.forEach(v => style.removeProperty(v));
        if (window.eucChartSync && window.eucChartSync.charts) {
            Object.values(window.eucChartSync.charts).forEach(chart => {
                if (chart && typeof chart.redraw === 'function') chart.redraw();
            });
        }
        return;
    }

    const H = hue;
    const isDark = document.body.classList.contains('dark-mode');

    if (isDark) {
        const contrast = getContrastText(H, 100, 50);
        // Accent
        style.setProperty('--theme-accent', `hsl(${H}, 100%, 50%)`);
        style.setProperty('--theme-accent-hover', `hsl(${H}, 100%, 40%)`);
        style.setProperty('--theme-accent-outline', `hsl(${H}, 100%, 50%)`);
        style.setProperty('--theme-accent-bg-hover', `hsl(${H}, 37%, 16%)`);
        style.setProperty('--theme-accent-glow', `hsla(${H}, 100%, 50%, 0.3)`);
        style.setProperty('--theme-btn-primary-bg', `hsl(${H}, 100%, 50%)`);
        style.setProperty('--theme-btn-primary-border', `hsl(${H}, 100%, 50%)`);
        style.setProperty('--theme-btn-primary-text', contrast);
        style.setProperty('--theme-btn-primary-hover-bg', `hsl(${H}, 100%, 40%)`);
        style.setProperty('--theme-btn-primary-hover-border', `hsl(${H}, 100%, 40%)`);
        style.setProperty('--theme-btn-outline-border', `hsl(${H}, 100%, 50%)`);
        style.setProperty('--theme-btn-outline-text', `hsl(${H}, 100%, 50%)`);
        style.setProperty('--theme-btn-outline-hover-bg', `hsl(${H}, 100%, 50%)`);
        style.setProperty('--theme-btn-outline-hover-text', contrast);
        style.setProperty('--theme-tooltip-border', `hsl(${H}, 100%, 50%)`);
        style.setProperty('--theme-tooltip-shadow', `0 4px 12px hsla(${H}, 100%, 50%, 0.15)`);
        style.setProperty('--theme-tooltip-arrow', `hsl(${H}, 100%, 50%)`);
        style.setProperty('--theme-code-text', `hsl(${H}, 100%, 50%)`);
        style.setProperty('--theme-table-secondary-strong', `hsl(${H}, 100%, 50%)`);
        // Footer
        style.setProperty('--theme-footer-accent', `hsl(${H}, 100%, 50%)`);
        style.setProperty('--theme-footer-link', `hsl(${H}, 90%, 64%)`);
        style.setProperty('--theme-footer-link-hover', `hsl(${H}, 95%, 72%)`);
        // Charts
        style.setProperty('--chart-grid', `hsla(${H}, 40%, 50%, 0.18)`);
        style.setProperty('--chart-axis-line', `hsl(${H}, 45%, 80%)`);
        style.setProperty('--chart-axis-label', `hsl(${H}, 35%, 65%)`);
        style.setProperty('--chart-axis-title', `hsl(${H}, 40%, 72%)`);
        style.setProperty('--chart-hover-line', `hsl(${H}, 45%, 80%)`);
        style.setProperty('--chart-empty-text', `hsl(${H}, 30%, 55%)`);
        style.setProperty('--chart-gap-segment', `hsla(${H}, 30%, 50%, 0.5)`);
        style.setProperty('--chart-annotation-border', `hsla(${H}, 35%, 50%, 0.15)`);
    } else {
        const contrast = getContrastText(H, 90, 52);
        // Accent
        style.setProperty('--theme-accent', `hsl(${H}, 90%, 52%)`);
        style.setProperty('--theme-accent-hover', `hsl(${H}, 100%, 35%)`);
        style.setProperty('--theme-accent-outline', `hsl(${H}, 100%, 50%)`);
        style.setProperty('--theme-accent-bg-hover', `hsl(${H}, 100%, 95%)`);
        style.setProperty('--theme-accent-glow', `hsla(${H}, 100%, 50%, 0.3)`);
        style.setProperty('--theme-btn-primary-bg', `hsl(${H}, 90%, 52%)`);
        style.setProperty('--theme-btn-primary-border', `hsl(${H}, 90%, 52%)`);
        style.setProperty('--theme-btn-primary-text', contrast);
        style.setProperty('--theme-btn-primary-hover-bg', `hsl(${H}, 90%, 45%)`);
        style.setProperty('--theme-btn-primary-hover-border', `hsl(${H}, 90%, 45%)`);
        style.setProperty('--theme-btn-outline-border', `hsl(${H}, 90%, 52%)`);
        style.setProperty('--theme-btn-outline-text', `hsl(${H}, 90%, 52%)`);
        style.setProperty('--theme-btn-outline-hover-bg', `hsl(${H}, 90%, 52%)`);
        style.setProperty('--theme-btn-outline-hover-text', contrast);
        style.setProperty('--theme-tooltip-border', `hsl(${H}, 40%, 35%)`);
        style.setProperty('--theme-tooltip-shadow', 'none');
        style.setProperty('--theme-tooltip-arrow', `hsl(${H}, 40%, 35%)`);
        style.removeProperty('--theme-code-text');
        style.removeProperty('--theme-table-secondary-strong');
        // Footer
        style.setProperty('--theme-footer-accent', `hsl(${H}, 70%, 31%)`);
        style.setProperty('--theme-footer-link', `hsl(${H}, 90%, 42%)`);
        style.setProperty('--theme-footer-link-hover', `hsl(${H}, 90%, 32%)`);
        // Charts
        style.setProperty('--chart-grid', `hsla(${H}, 40%, 50%, 0.18)`);
        style.setProperty('--chart-axis-line', `hsl(${H}, 50%, 28%)`);
        style.setProperty('--chart-axis-label', `hsl(${H}, 40%, 40%)`);
        style.setProperty('--chart-axis-title', `hsl(${H}, 45%, 32%)`);
        style.setProperty('--chart-hover-line', `hsl(${H}, 50%, 28%)`);
        style.setProperty('--chart-empty-text', `hsl(${H}, 35%, 42%)`);
        style.setProperty('--chart-gap-segment', `hsla(${H}, 30%, 50%, 0.5)`);
        style.setProperty('--chart-annotation-border', `hsla(${H}, 35%, 50%, 0.15)`);
    }

    // Redraw charts to pick up new CSS variables
    if (window.eucChartSync && window.eucChartSync.charts) {
        Object.values(window.eucChartSync.charts).forEach(chart => {
            if (chart && typeof chart.redraw === 'function') chart.redraw();
        });
    }
}

/**
 * Update the hue swatch background color.
 * @param {number|null} hue - Hue value (0-360) or null to read from current CSS variable
 */
function updateHueSwatch(hue) {
    const swatch = document.getElementById('hue-swatch');
    if (!swatch) return;

    if (hue === null) {
        swatch.style.backgroundColor = getComputedStyle(document.body).getPropertyValue('--theme-accent').trim();
    } else {
        const isDark = document.body.classList.contains('dark-mode');
        swatch.style.backgroundColor = isDark ? `hsl(${hue}, 100%, 50%)` : `hsl(${hue}, 90%, 52%)`;
    }
}

/**
 * Initialize the theme hue slider, load saved value, attach event listeners.
 */
function initHueSlider() {
    const slider = document.getElementById('hue-slider');
    const valueDisplay = document.getElementById('hue-value');
    const saved = localStorage.getItem('themeHue');

    if (saved !== null) {
        slider.value = saved;
        valueDisplay.textContent = saved + '°';
        applyThemeHue(parseInt(saved));
        updateHueSwatch(parseInt(saved));
    } else {
        updateHueSwatch(null);
    }

    slider.addEventListener('input', () => {
        const hue = parseInt(slider.value);
        valueDisplay.textContent = hue + '°';
        localStorage.setItem('themeHue', hue);
        applyThemeHue(hue);
        updateHueSwatch(hue);
    });

    document.getElementById('hue-random-btn').addEventListener('click', () => {
        const hue = Math.floor(Math.random() * 361);
        slider.value = hue;
        valueDisplay.textContent = hue + '°';
        localStorage.setItem('themeHue', hue);
        applyThemeHue(hue);
        updateHueSwatch(hue);
    });

    document.getElementById('hue-reset-btn').addEventListener('click', () => {
        slider.value = 180;
        valueDisplay.textContent = '—';
        localStorage.removeItem('themeHue');
        applyThemeHue(null);
        updateHueSwatch(null);
    });
}

/**
 * Initialize application
 */
function init() {
    // Initializing EUC Ride Data Viewer

    // Setup file input handler
    const fileInput = document.getElementById('csv-file-input');
    fileInput.addEventListener('change', handleFileSelect);

    // Setup drag and drop - entire page is drop zone
    const mainContainer = document.getElementById('main-container');
    mainContainer.addEventListener('dragover', handleDragOver);
    mainContainer.addEventListener('dragleave', handleDragLeave);
    mainContainer.addEventListener('drop', handleDrop);

    // Also handle drag/drop on document body for full coverage
    document.body.addEventListener('dragover', handleDragOver);
    document.body.addEventListener('drop', handleDrop);

    // Setup PWM flip toggle
    const pwmToggle = document.getElementById('pwm-flip-toggle');
    pwmToggle.addEventListener('change', handlePWMFlip);

    // Setup dark mode toggle
    const darkModeToggle = document.getElementById('dark-mode-toggle');
    darkModeToggle.addEventListener('change', handleDarkModeToggle);

    // Load dark mode preference from localStorage (default: on)
    const darkModeSaved = localStorage.getItem('darkMode');
    const darkModeEnabled = darkModeSaved === null || darkModeSaved === 'true';
    if (darkModeEnabled) {
        document.body.classList.add('dark-mode');
        darkModeToggle.checked = true;
    }

    // Initialize theme hue slider (must be after dark mode class is applied)
    initHueSlider();

    // Load marker pulse preference from localStorage (applies body class before map exists)
    const markerPulsePreference = localStorage.getItem('markerPulse') === 'true';
    if (markerPulsePreference) {
        document.body.classList.add('marker-animations-enabled');
    }

    // Setup diagnostic view toggle
    const diagnosticToggle = document.getElementById('diagnostic-view-toggle');
    diagnosticToggle.addEventListener('change', handleDiagnosticToggle);

    // Invalidate Leaflet map size when GPS map card is expanded
    const gpsMapCollapse = document.getElementById('collapse-gps-map');
    gpsMapCollapse.addEventListener('shown.bs.collapse', () => {
        if (window.gpsMapInstance && typeof window.gpsMapInstance.resize === 'function') {
            window.gpsMapInstance.resize();
        }
    });

    // Create time range manager (will be initialized when data loads)
    timeRangeManager = createTimeRangeManager(
        null, // GPS map instance will be set later
        handleApplyTimeRange,
        handleResetTimeRange
    );

    // Show initial placeholder state
    showPlaceholderState();

    // Initialize footer date/time updates
    initFooterDateTime();

    // Initialize Bootstrap tooltips on control toggles
    initBootstrapTooltips(document.querySelector('.card-body .row.align-items-center'));

    // Tooltip management: click/tap to open, click/tap anywhere outside to close
    // All tooltips use trigger:'manual' so we have full control
    // Clicking inside an open tooltip does NOT close it (allows text selection/copy)
    let activeTooltipEl = null;
    document.addEventListener('click', function(e) {
        const tappedTrigger = e.target.closest('[data-bs-toggle="tooltip"]');
        const insideTooltip = e.target.closest('.tooltip');

        if (activeTooltipEl) {
            // Click inside the open tooltip — do nothing (allow text selection)
            if (insideTooltip) return;

            // Click on a different trigger — close current, open new
            if (tappedTrigger && tappedTrigger !== activeTooltipEl) {
                if (document.contains(activeTooltipEl)) {
                    const activeTooltip = bootstrap.Tooltip.getInstance(activeTooltipEl);
                    if (activeTooltip) activeTooltip.hide();
                }
                const tooltip = bootstrap.Tooltip.getInstance(tappedTrigger);
                if (tooltip) {
                    tooltip.show();
                    activeTooltipEl = tappedTrigger;
                } else {
                    activeTooltipEl = null;
                }
                return;
            }

            // Click anywhere else — close the tooltip
            if (document.contains(activeTooltipEl)) {
                const activeTooltip = bootstrap.Tooltip.getInstance(activeTooltipEl);
                if (activeTooltip) activeTooltip.hide();
            }
            activeTooltipEl = null;
        } else if (tappedTrigger) {
            // No tooltip open — open this one
            const tooltip = bootstrap.Tooltip.getInstance(tappedTrigger);
            if (tooltip) {
                tooltip.show();
                activeTooltipEl = tappedTrigger;
            }
        }
    });
}

/**
 * Handle file selection from input
 * @param {Event} event - File input change event
 */
function handleFileSelect(event) {
    const file = event.target.files[0];
    if (file) {
        processFile(file);
    }
}

/**
 * Show placeholder state when no file is loaded
 */
function showPlaceholderState() {
    document.getElementById('file-info').textContent = 'No file loaded';

    // Show placeholder in overview - will be replaced with file browser
    const overviewContainer = document.getElementById('overview-stats');
    overviewContainer.innerHTML = `
        <div class="grid-full-width text-center py-5">
            <div class="spinner-border text-primary" role="status">
                <span class="visually-hidden">Loading...</span>
            </div>
            <p class="text-muted mt-3">Loading CSV file browser...</p>
        </div>
    `;

    // Load CSV file list from server
    loadCSVFileBrowser();

    // Show placeholder in GPS map
    const mapContainer = document.getElementById('gps-map');
    mapContainer.innerHTML = `
        <div class="d-flex align-items-center justify-content-center h-100" style="min-height: 400px;">
            <div class="text-center text-muted">
                <h4>🗺️ GPS Route Map</h4>
                <p>Interactive map will appear here after loading CSV with GPS data</p>
            </div>
        </div>
    `;

    // Show placeholder in charts
    const chartsContainer = document.getElementById('charts-container');
    chartsContainer.innerHTML = `
        <div class="text-center py-5">
            <h4 class="text-muted">📈 Data Charts</h4>
            <p class="text-muted">Speed, battery, power, temperature, and orientation charts will appear here</p>
            <p class="text-muted"><small>Charts are synchronized - hover over any chart to see data across all views</small></p>
        </div>
    `;
}

/**
 * Load and display CSV file browser
 */
async function loadCSVFileBrowser() {
    const overviewContainer = document.getElementById('overview-stats');
    const startTime = performance.now(); // Track detection time

    try {
        const response = await fetch('/api/files');

        // Check if Flask API is available
        if (!response.ok) {
            // API not available - show basic mode interface
            throw new Error('FILE_BROWSER_NOT_AVAILABLE');
        }

        const data = await response.json();

        if (!data.success) {
            throw new Error(data.error || 'Failed to load file list');
        }

        if (data.files.length === 0) {
            // No files found
            overviewContainer.innerHTML = `
                <div class="grid-full-width text-center py-5">
                    <h4 class="text-muted mb-4">📂 No CSV Files Found</h4>
                    <p class="text-muted mb-4">Place CSV files in the <code>/csv</code> directory or drag and drop anywhere on this page</p>
                    <button class="btn btn-primary btn-lg mt-2" onclick="document.getElementById('csv-file-input').click()">
                        Choose CSV File from Computer
                    </button>
                    <div class="mt-4">
                        <small class="text-muted">
                            <strong>Supported formats:</strong> EUC World, WheelLog, DarknessBot
                        </small>
                    </div>
                </div>
            `;
            return;
        }

        // Calculate detection time
        const detectionTime = ((performance.now() - startTime) / 1000).toFixed(2);

        // Count formats for summary
        const formatCounts = { eucworld: 0, wheellog: 0, darknessbot: 0, unknown: 0 };
        data.files.forEach(file => {
            if (file.format) formatCounts[file.format]++;
        });

        // Build format summary with abbreviated names
        const formatSummary = [];
        if (formatCounts.eucworld > 0) formatSummary.push(`<img src="assets/icons/ew.png" class="summary-icon" alt="EW"> EW EUC World [${formatCounts.eucworld}]`);
        if (formatCounts.wheellog > 0) formatSummary.push(`<img src="assets/icons/wl.png" class="summary-icon" alt="WL"> WL WheelLog [${formatCounts.wheellog}]`);
        if (formatCounts.darknessbot > 0) formatSummary.push(`<img src="assets/icons/db.png" class="summary-icon" alt="DB"> DB DarknessBot [${formatCounts.darknessbot}]`);
        // Always show Undetected count (even if 0)
        formatSummary.push(`❓ Undetected [${formatCounts.unknown}]`);

        // Build file browser table
        let html = `
            <div class="grid-full-width">
                <div class="d-flex justify-content-between align-items-center mb-2">
                    <div>
                        <h5 class="mb-1">📄 CSV Files [${data.count}] | Detected in ${detectionTime} seconds</h5>
                        <small class="text-muted">${formatSummary.join(' | ')}</small>
                    </div>
                    <button class="btn btn-sm btn-outline-primary" onclick="document.getElementById('csv-file-input').click()">
                        + Upload File
                    </button>
                </div>
                <div class="table-responsive">
                    <table class="table table-sm">
                        <thead>
                            <tr>
                                <th>Path</th>
                                <th>Format</th>
                                <th>Size</th>
                                <th>Modified</th>
                            </tr>
                        </thead>
                        <tbody>
        `;

        // Group files by folder
        let currentFolder = null;

        // Add each file as a row
        data.files.forEach(file => {
            // Format file size
            const sizeStr = formatFileSize(file.size);

            // Show folder separator if folder changed
            if (file.folder !== currentFolder) {
                currentFolder = file.folder;
                const folderDisplay = currentFolder === '/' ? 'Root' : currentFolder;
                html += `
                    <tr class="table-secondary" style="cursor: default;">
                        <td colspan="4"><strong>📂 ${folderDisplay}</strong></td>
                    </tr>
                `;
            }

            // Get format icon
            const formatIcons = {
                'eucworld': 'assets/icons/ew.png',
                'wheellog': 'assets/icons/wl.png',
                'darknessbot': 'assets/icons/db.png',
                'unknown': ''
            };
            const iconPath = formatIcons[file.format] || '';
            const formatCell = iconPath
                ? `<img src="${iconPath}" class="file-list-icon" alt="${file.format}" title="${file.format}">`
                : '<span class="text-warning" title="Undetected format">❓</span>';

            // Escape quotes in path for onclick handler
            const escapedPath = file.path.replace(/'/g, "\\'");
            const isUnknown = file.format === 'unknown';

            html += `
                <tr ${isUnknown ? 'class="format-unknown"' : `style="cursor: pointer;" onclick="loadCSVFromServer('${escapedPath}')"`}>
                    <td><strong>${file.name}</strong></td>
                    <td class="text-center">${formatCell}</td>
                    <td>${sizeStr}</td>
                    <td>${file.modified_date}</td>
                </tr>
            `;
        });

        html += `
                        </tbody>
                    </table>
                </div>
                <div class="text-center mt-3">
                    <small class="text-muted">Click on any file to load it, or drag & drop a file anywhere on the page</small>
                </div>
            </div>
        `;

        overviewContainer.innerHTML = html;

    } catch (error) {
        // Check if it's because Flask API is not available (basic mode)
        if (error.message === 'FILE_BROWSER_NOT_AVAILABLE') {
            overviewContainer.innerHTML = `
                <div class="grid-full-width text-center py-5">
                    <h4 class="text-muted mb-2">📂 EUC CSV Dashboard</h4>
                    <div class="mb-4 p-3 bg-light rounded">
                        <small class="text-muted">
                            <strong>🔒 100% Client-Side</strong><br>
                            All processing happens in your browser. Your CSV files are never uploaded or stored on any server.
                        </small>
                    </div>
                    <hr class="my-4">
                    <p class="text-muted mb-2">Drag and drop a CSV file anywhere on this page</p>
                    <p class="text-muted mb-4">
                        <small>Supported formats: EUC World, WheelLog, DarknessBot</small>
                    </p>
                    <button class="btn map-style-btn btn-lg" onclick="document.getElementById('csv-file-input').click()">
                        Choose CSV File
                    </button>
                    <hr class="my-4">
                    <small class="text-muted d-block mb-2">or preview a sample log</small>
                    <button class="btn map-style-btn" onclick="loadSampleData()">
                        Moscow Circle APEX — WheelLog
                    </button>
                </div>
            `;
        } else {
            // Actual error
            console.error('[APP] Error loading file browser:', error);
            overviewContainer.innerHTML = `
                <div class="grid-full-width text-center py-5">
                    <h4 class="text-danger mb-4">⚠️ Could Not Load File Browser</h4>
                    <p class="text-muted mb-4">${error.message}</p>
                    <p class="text-muted">Make sure the server is running with <code>./start_directory.sh</code></p>
                    <button class="btn btn-primary btn-lg mt-2" onclick="document.getElementById('csv-file-input').click()">
                        Choose CSV File from Computer
                    </button>
                </div>
            `;
        }
    }
}

/**
 * Load sample CSV data for demo purposes
 */
async function loadSampleData() {
    try {
        showLoading(true);
        const response = await fetch('sample-data/sample-wheellog.csv');
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        const csvText = await response.text();
        const file = new File([csvText], 'Moscow Circle APEX 2025_07_08_03_39_12.csv', { type: 'text/csv' });
        processFile(file);
    } catch (error) {
        console.error('[APP] Failed to load sample data:', error);
        alert('Failed to load sample data: ' + error.message);
        showLoading(false);
    }
}
window.loadSampleData = loadSampleData;

/**
 * Load CSV file from server
 * @param {string} filePath - CSV file path (relative to csv directory, may include subdirectories)
 */
async function loadCSVFromServer(filePath) {
    try {
        showLoading(true);

        // Mark that this file came from server
        loadedFromServer = true;

        // Fetch file metadata to get modified date
        try {
            const metaResponse = await fetch('/api/files');
            if (metaResponse.ok) {
                const metaData = await metaResponse.json();
                if (metaData.success && metaData.files) {
                    const fileInfo = metaData.files.find(f => f.path === filePath);
                    if (fileInfo && fileInfo.modified) {
                        currentFileModifiedDate = new Date(fileInfo.modified * 1000); // Convert Unix timestamp to Date
                    }
                }
            }
        } catch (metaError) {
            console.warn('[APP] Could not fetch file metadata:', metaError);
            currentFileModifiedDate = null;
        }

        const response = await fetch(`/api/csv/${encodeURIComponent(filePath)}`);
        if (!response.ok) {
            throw new Error(`Failed to load file: ${response.statusText}`);
        }

        const csvContent = await response.text();

        // Extract just the filename from the path for display
        const filename = filePath.split('/').pop();

        // Create a fake File object
        const file = new File([csvContent], filename, { type: 'text/csv' });

        // Process the file
        processFile(file);

    } catch (error) {
        console.error('[APP] Error loading CSV from server:', error);
        alert(`Error loading file: ${error.message}`);
        showLoading(false);
    }
}

/**
 * Handle drag over event
 * @param {DragEvent} event - Drag event
 */
function handleDragOver(event) {
    event.preventDefault();
    event.stopPropagation();

    // Visual feedback - add class to body or main container
    document.body.classList.add('drag-over');
}

/**
 * Handle drag leave event
 * @param {DragEvent} event - Drag event
 */
function handleDragLeave(event) {
    event.preventDefault();
    event.stopPropagation();

    // Only remove class if leaving the body
    if (event.target === document.body) {
        document.body.classList.remove('drag-over');
    }
}

/**
 * Handle file drop event
 * @param {DragEvent} event - Drop event
 */
function handleDrop(event) {
    event.preventDefault();
    event.stopPropagation();
    document.body.classList.remove('drag-over');

    const files = event.dataTransfer.files;
    if (files.length > 0) {
        processFile(files[0]);
    }
}

/**
 * Process uploaded CSV file
 * @param {File} file - File object
 */
function processFile(file) {
    // Store file modified date (if available from File object)
    if (file.lastModified) {
        currentFileModifiedDate = new Date(file.lastModified);
    } else {
        currentFileModifiedDate = null;
    }

    // Mark as not from server if this is being called directly
    // (loadCSVFromServer will have already set it to true before calling this)
    if (!loadedFromServer) {
        loadedFromServer = false; // Drag & drop or file input
    }

    // Validate file type
    if (!file.name.toLowerCase().endsWith('.csv')) {
        alert('Please upload a CSV file');
        return;
    }

    // Track file size and processing time
    const fileSize = file.size;
    const processingStartTime = performance.now();

    // Show loading overlay
    showLoading(true);

    // Read file content
    const reader = new FileReader();
    reader.onload = function(e) {
        const csvContent = e.target.result;

        // Detect format
        const format = FormatDetector.detectFormat(csvContent, file.name);

        if (format === 'Unknown') {
            alert('Unable to detect CSV format. Please ensure this is a valid EUC World, WheelLog, or DarknessBot CSV file.');
            showLoading(false);
            return;
        }

        // Create appropriate processor
        let processor;
        switch (format) {
            case 'EUCWorld':
                processor = new EUCWorldProcessor();
                break;
            case 'WheelLog':
                processor = new WheelLogProcessor();
                break;
            case 'DarknessBot':
                processor = new DarknessBotProcessor();
                break;
            default:
                alert('Unsupported format');
                showLoading(false);
                return;
        }

        currentProcessor = processor;

        // Parse CSV with Papa Parse
        Papa.parse(csvContent, {
            header: true,
            dynamicTyping: false, // Keep as strings, let processors handle conversion
            skipEmptyLines: true,
            complete: function(results) {
                try {
                    // Store raw parsed CSV for reprocessing (e.g., PWM flip)
                    rawParsedCSV = results.data;
                    csvHeaders = results.meta.fields;
                    currentFilename = file.name;

                    // Process data
                    const processedData = processor.processCSV(results.data, file.name);

                    // Store data
                    currentData = processedData;
                    originalData = JSON.parse(JSON.stringify(processedData)); // Deep copy

                    // Set PWM flip checkbox to OFF (user must manually toggle to apply transformation)
                    const pwmToggle = document.getElementById('pwm-flip-toggle');
                    pwmToggle.checked = false;

                    // Update PWM mode status display to show detected mode
                    updatePWMModeStatus(processor.detectedMode, false);

                    // Calculate processing time and get data point count
                    const processingTime = performance.now() - processingStartTime;
                    const dataPoints = processedData.timestamps ? processedData.timestamps.length : 0;

                    // Update UI with file stats
                    updateFileInfo(file.name, format, fileSize, dataPoints, processingTime, currentFileModifiedDate);
                    renderOverview(processedData);
                    renderCharts(processedData.chartGroups);

                    // Render GPS map with callback to initialize time range manager
                    renderGPSMap(processedData.gpsRoute, () => {
                        // Cleanup existing time range manager if present
                        if (timeRangeManager) {
                            timeRangeManager.cleanup();
                        }

                        // Create new time range manager with GPS map instance
                        timeRangeManager = createTimeRangeManager(
                            window.gpsMapInstance,
                            handleApplyTimeRange,
                            handleResetTimeRange
                        );

                        // Initialize with processed data
                        timeRangeManager.initialize(processedData);

                        // Update render statistics after everything is loaded
                        updateRenderStatsFromCurrentData();
                    });

                    showLoading(false);

                    // Reset diagnostic toggle and hide card on new file load
                    const diagToggle = document.getElementById('diagnostic-view-toggle');
                    diagToggle.checked = false;
                    document.getElementById('diagnostic-card').style.display = 'none';

                } catch (error) {
                    console.error('[APP] Processing error:', error);
                    alert(`Error processing CSV: ${error.message}`);
                    showLoading(false);
                }
            },
            error: function(error) {
                console.error('[APP] CSV parsing error:', error);
                alert(`Error parsing CSV: ${error.message}`);
                showLoading(false);
            }
        });
    };

    reader.onerror = function() {
        console.error('[APP] File reading error');
        alert('Error reading file');
        showLoading(false);
    };

    reader.readAsText(file);
}

/**
 * Update file info display
 * @param {string} filename - File name
 * @param {string} format - Detected format
 * @param {number} fileSize - File size in bytes
 * @param {number} dataPoints - Number of data points
 * @param {number} processingTime - Processing time in milliseconds
 * @param {Date|number|string} fileModifiedDate - File modified date (optional)
 */
function updateFileInfo(filename, format, fileSize = 0, dataPoints = 0, processingTime = 0, fileModifiedDate = null) {
    const displayName = FormatDetector.getDisplayName(format);
    const iconPath = FormatDetector.getIconPath(format);

    // Format file size (console style: lowercase, no space)
    const fileSizeStr = formatFileSize(fileSize, { uppercase: false, space: false });

    // Format data points with thousands separator
    const dataPointsStr = dataPoints.toLocaleString();

    // Format processing time (console style: lowercase)
    let processingTimeStr = '';
    if (processingTime < 1000) {
        processingTimeStr = `${Math.round(processingTime)}ms`;
    } else {
        processingTimeStr = `${(processingTime / 1000).toFixed(2)}s`;
    }

    let fileInfoHTML = '';

    // Add icon first (left side)
    if (iconPath) {
        fileInfoHTML += `<img src="${iconPath}" class="format-icon" alt="${displayName}">`;
    }

    // Add file info in a wrapper div
    fileInfoHTML += `<div>`;
    fileInfoHTML += `${filename} (${displayName})`;

    // Add file stats
    if (fileSize > 0) {
        fileInfoHTML += `<br><span class="badge">size: ${fileSizeStr}</span> `;
        fileInfoHTML += `<span class="text-muted">|</span> `;
        fileInfoHTML += `<span class="badge">points: ${dataPointsStr}</span> `;
        fileInfoHTML += `<span class="text-muted">|</span> `;
        fileInfoHTML += `<span class="badge">render: ${processingTimeStr}</span>`;

        // Add file modified date if available
        if (fileModifiedDate) {
            const modDate = new Date(fileModifiedDate);
            if (!isNaN(modDate.getTime())) {
                const dateStr = modDate.toISOString().split('T')[0]; // YYYY-MM-DD
                const timeStr = modDate.toTimeString().split(' ')[0]; // HH:MM:SS
                fileInfoHTML += `<span class="text-muted"> | </span>`;
                fileInfoHTML += `<span class="badge">modified: ${dateStr} ${timeStr}</span>`;
            }
        }
    }

    // Add "drop another CSV" hint if not loaded from server (no back button)
    if (!loadedFromServer && fileSize > 0) {
        fileInfoHTML += ` <span class="text-muted">• drop another CSV anywhere on this page</span>`;
    }

    fileInfoHTML += `</div>`; // Close wrapper div

    document.getElementById('file-info').innerHTML = fileInfoHTML;

    // Update render stats section with file size and render time
    const statFileSize = document.getElementById('stat-file-size');
    if (statFileSize && fileSize > 0) {
        statFileSize.textContent = fileSizeStr;
    }
    const statRenderTime = document.getElementById('stat-render-time');
    if (statRenderTime && processingTime > 0) {
        statRenderTime.textContent = processingTimeStr;
    }

    // Show/hide back button based on whether file was loaded from server
    const backBtn = document.getElementById('back-to-files-btn');
    if (backBtn) {
        backBtn.style.display = loadedFromServer ? 'inline-block' : 'none';
    }
}

/**
 * Update render statistics display
 * @param {number} sourcePoints - Original document data points
 * @param {number} displayedPoints - Currently displayed data points
 * @param {number} mapSegments - Number of map route segments
 * @param {number} chartPoints - Number of points rendered in charts
 */
function updateRenderStats(sourcePoints = 0, displayedPoints = 0, mapSegments = 0, chartPoints = 0) {
    // Show the render stats section
    const section = document.getElementById('render-stats-section');
    if (section && sourcePoints > 0) {
        section.style.display = 'block';
    }

    // Update individual stats
    const statSourcePoints = document.getElementById('stat-source-points');
    const statDisplayedPoints = document.getElementById('stat-displayed-points');
    const statMapSegments = document.getElementById('stat-map-segments');
    const statChartPoints = document.getElementById('stat-chart-points');

    if (statSourcePoints) {
        statSourcePoints.textContent = `${sourcePoints.toLocaleString()} points`;
    }

    if (statDisplayedPoints) {
        statDisplayedPoints.textContent = `${displayedPoints.toLocaleString()} points`;
    }

    if (statMapSegments) {
        statMapSegments.textContent = `${mapSegments.toLocaleString()} segments`;
    }

    if (statChartPoints) {
        // Show actual vs downsampled if different
        if (chartPoints < displayedPoints) {
            statChartPoints.textContent = `${chartPoints.toLocaleString()} / ${displayedPoints.toLocaleString()} points`;
        } else {
            statChartPoints.textContent = `${chartPoints.toLocaleString()} points`;
        }
    }

    // Second row: derived stats
    const statPointsPerSegment = document.getElementById('stat-points-per-segment');
    const statSecondsPerSegment = document.getElementById('stat-seconds-per-segment');
    const statChartDownsample = document.getElementById('stat-chart-downsample');

    if (statPointsPerSegment) {
        if (mapSegments > 0 && displayedPoints > 0) {
            const pps = Math.round(displayedPoints / mapSegments);
            statPointsPerSegment.textContent = `${pps} pts/seg`;
        } else {
            statPointsPerSegment.textContent = '—';
        }
    }

    if (statSecondsPerSegment) {
        if (mapSegments > 0 && currentData?.timestamps?.length >= 2) {
            const totalMs = currentData.timestamps[currentData.timestamps.length - 1] - currentData.timestamps[0];
            const totalSec = totalMs / 1000;
            const secPerSeg = totalSec / mapSegments;
            if (secPerSeg >= 60) {
                const mins = Math.floor(secPerSeg / 60);
                const secs = Math.round(secPerSeg % 60);
                statSecondsPerSegment.textContent = `${mins}m ${secs}s/seg`;
            } else {
                statSecondsPerSegment.textContent = `${secPerSeg.toFixed(1)}s/seg`;
            }
        } else {
            statSecondsPerSegment.textContent = '—';
        }
    }

    if (statChartDownsample) {
        if (chartPoints < displayedPoints) {
            const step = Math.ceil(displayedPoints / chartPoints);
            statChartDownsample.textContent = `every ${step}${step === 2 ? 'nd' : step === 3 ? 'rd' : 'th'} point`;
        } else {
            statChartDownsample.textContent = '1:1 (all points)';
        }
    }

    const statSampleRate = document.getElementById('stat-sample-rate');
    if (statSampleRate) {
        if (displayedPoints >= 2 && currentData?.timestamps?.length >= 2) {
            const totalMs = currentData.timestamps[currentData.timestamps.length - 1] - currentData.timestamps[0];
            const totalSec = totalMs / 1000;
            const rate = displayedPoints / totalSec;
            statSampleRate.textContent = `${rate.toFixed(1)} pts/sec`;
        } else {
            statSampleRate.textContent = '—';
        }
    }

    // Third row: file metadata + extras
    const statGpsPoints = document.getElementById('stat-gps-points');
    if (statGpsPoints) {
        const gpsCount = currentData?.gpsRoute?.coordinates?.length || 0;
        if (gpsCount > 0) {
            statGpsPoints.textContent = `${gpsCount.toLocaleString()} points`;
        } else {
            statGpsPoints.textContent = 'No GPS';
        }
    }

    const statChartsRendered = document.getElementById('stat-charts-rendered');
    if (statChartsRendered) {
        const chartGroups = currentData?.chartGroups;
        if (chartGroups) {
            const entries = Object.entries(chartGroups);
            const chartCount = entries.length;
            // Count only series with at least one non-null value
            const perChart = entries.map(([key, group]) => {
                const active = group.series.filter(s =>
                    s.data && s.data.some(v => v !== null && v !== undefined)
                ).length;
                return { key, active };
            });
            const totalActive = perChart.reduce((a, c) => a + c.active, 0);
            statChartsRendered.textContent = `${chartCount} charts (${totalActive} series)`;

            // Build per-chart breakdown for tooltip
            const breakdown = perChart.map(c => `${c.key}: ${c.active}`).join('<br>');
            const tooltipEl = statChartsRendered.closest('[data-bs-toggle="tooltip"]');
            if (tooltipEl) {
                const newTitle = `<strong>Charts Rendered</strong><br><br>${chartCount} chart canvases drawn with ${totalActive} active data series.<br><br><strong>Per chart:</strong><br>${breakdown}`;
                tooltipEl.setAttribute('data-bs-title', newTitle);
            }
        } else {
            statChartsRendered.textContent = '—';
        }
    }

    // Initialize Bootstrap tooltips for render stats section
    initBootstrapTooltips(document.getElementById('render-stats-section'));
}

/**
 * Collect and update render statistics from all current data sources
 */
function updateRenderStatsFromCurrentData() {
    // Source points - from original data
    const sourcePoints = originalData?.timestamps?.length || 0;

    // Currently displayed points - from current data
    const displayedPoints = currentData?.timestamps?.length || 0;

    // Map segments - from GPS map instance
    let mapSegments = 0;
    if (window.gpsMapInstance && typeof window.gpsMapInstance.getRenderStats === 'function') {
        const mapStats = window.gpsMapInstance.getRenderStats();
        mapSegments = mapStats.totalSegments || 0;
    }

    // Chart render points - get from any registered chart instance
    let chartPoints = displayedPoints; // Default to all points

    // Get chart stats from the sync system where charts are actually registered
    if (window.eucChartSync && window.eucChartSync.charts) {
        for (const chartId of Object.keys(window.eucChartSync.charts)) {
            const chart = window.eucChartSync.charts[chartId];
            if (chart && typeof chart.getRenderStats === 'function') {
                const chartStats = chart.getRenderStats();
                if (chartStats.renderedPoints > 0) {
                    chartPoints = chartStats.renderedPoints;
                    break; // Use first valid chart stats
                }
            }
        }
    }

    // Update the UI
    updateRenderStats(sourcePoints, displayedPoints, mapSegments, chartPoints);
}

/**
 * Format an extra column key into a human-readable label.
 * Strips euc./info. prefix, converts camelCase to Title Case.
 * @param {string} key - Raw key (e.g. 'euc.batteryCircuitResistance')
 * @returns {string} Formatted label (e.g. 'Battery Circuit Resistance')
 */
/**
 * Render overview statistics in columns
 * @param {Object} data - Processed data
 */
function renderOverview(data) {
    const overviewContainer = document.getElementById('overview-stats');

    // Dispose existing tooltips to prevent memory leaks
    const existingTooltips = document.querySelectorAll('[data-bs-toggle="tooltip"]');
    existingTooltips.forEach(el => {
        const tooltip = bootstrap.Tooltip.getInstance(el);
        if (tooltip) {
            tooltip.dispose();
        }
    });

    // Calculate overview stats (also caches rideStats on data for convertGPSRouteData)
    const stats = calculateOverviewStats(data, {
        detectedMode: currentProcessor?.detectedMode || 1,
        flipPWM: currentProcessor?.flipPWM || false
    });

    // Group stats by category
    const columns = {
        time: [],
        speed: [],
        battery: [],
        voltage: [],
        temperature: [],
        elevation: [],
        tilt: [],
        system: []
    };

    // Categorize each stat
    for (const stat of stats) {
        if (stat.group === 'datetime' || stat.group === 'device') {
            columns.time.push(stat);
        } else if (stat.group === 'speed' || stat.group === 'distance') {
            columns.speed.push(stat);
        } else if (stat.group === 'temperature' || stat.label.includes('Temp')) {
            // Temperature stats (including battery temp) - check BEFORE battery
            columns.temperature.push(stat);
        } else if (stat.label.includes('Battery') || stat.label.includes('PWM') || stat.label.includes('Current') || stat.label.includes('Wh/km')) {
            // Battery & Current (temperature already filtered out above)
            columns.battery.push(stat);
        } else if (stat.label.includes('Voltage') || stat.label.includes('Power')) {
            columns.voltage.push(stat);
        } else if (stat.group === 'elevation' || stat.label.includes('Elevation') || stat.label.includes('Altitude')) {
            columns.elevation.push(stat);
        } else if (stat.group === 'orientation') {
            columns.tilt.push(stat);
        } else if (stat.group === 'system') {
            columns.system.push(stat);
        }
    }

    // Build column HTML
    let html = '';

    // Helper function to render a column
    // All columns are collapsible. collapseId is the unique ID for the collapse target.
    // startCollapsed: if true, column body starts hidden (default: false = expanded)
    const renderColumn = (title, stats, showIfEmpty, collapseId, startCollapsed = false) => {
        const expandedClass = startCollapsed ? 'collapsed' : '';
        const ariaExpanded = startCollapsed ? 'false' : 'true';
        const showClass = startCollapsed ? '' : 'show';

        let columnHtml = `<div class="overview-column">`;

        columnHtml += `
            <div class="overview-column-title overview-column-toggle ${expandedClass}"
                 data-bs-toggle="collapse" data-bs-target="#${collapseId}"
                 role="button" aria-expanded="${ariaExpanded}" aria-controls="${collapseId}">
                <span class="collapse-indicator"></span> ${title}
            </div>
            <div class="collapse ${showClass}" id="${collapseId}">
        `;

        if (stats.length === 0 && showIfEmpty) {
            columnHtml += `
                <div class="overview-item">
                    <div class="overview-label">No Data</div>
                    <div class="overview-value text-muted">N/A</div>
                </div>
            `;
        } else {
            for (const stat of stats) {
                const valueClass = (stat.isZeroOrNA || stat.isNegative) ? 'overview-value overview-value-na' : 'overview-value';

                // Get tooltip content from metadata (skip for extra fields — raw device values)
                const tooltipContent = stat.group !== 'extra' ? getTooltipContent(stat.label) : null;
                const tooltipAttrs = tooltipContent ?
                    `data-bs-toggle="tooltip" data-bs-placement="auto" data-bs-html="true" data-bs-title="${tooltipContent.replace(/"/g, '&quot;')}"` :
                    '';

                const chartBadge = stat.hasChart ? ' <span title="Charted below" style="font-size:0.75em;opacity:0.5;cursor:help">📊</span>' : '';

                columnHtml += `
                    <div class="overview-item" ${tooltipAttrs}>
                        <div class="overview-label">${stat.label}${chartBadge}</div>
                        <div class="${valueClass}">${stat.value}</div>
                    </div>
                `;
            }
        }

        columnHtml += `</div>`; // close .collapse
        columnHtml += `</div>`; // close .overview-column

        return columnHtml;
    };

    // Render each column (all collapsible, start expanded)
    html += renderColumn('⏱️ Time & Device', columns.time, true, 'col-time');
    html += renderColumn('🚀 Speed & Distance', columns.speed, true, 'col-speed');
    html += renderColumn('🔋 Battery & Current', columns.battery, true, 'col-battery');
    html += renderColumn('⚡ Voltage & Power', columns.voltage, true, 'col-voltage');
    html += renderColumn('🌡️ Temperature', columns.temperature, true, 'col-temperature');
    html += renderColumn('⛰️ Elevation', columns.elevation, true, 'col-elevation');
    html += renderColumn('🔄 Tilt Angle', columns.tilt, true, 'col-tilt');
    html += renderColumn('🆕 New Additions', columns.system, true, 'col-system');

    // EUC World Details column - dynamic from extra column data (starts collapsed)
    const extraFields = data.metadata?.extraFields;
    if (extraFields && Object.keys(extraFields).length > 0) {
        const keys = Object.keys(extraFields);
        const eucKeys = keys.filter(k => k.startsWith('euc.')).sort();
        const infoKeys = keys.filter(k => k.startsWith('info.')).sort();
        const otherKeys = keys.filter(k => !k.startsWith('euc.') && !k.startsWith('info.')).sort();
        const sortedKeys = [...eucKeys, ...infoKeys, ...otherKeys];

        const extraStats = sortedKeys.map(key => ({
            label: formatExtraKey(key),
            value: extraFields[key],
            group: 'extra'
        }));

        html += renderColumn('📋 EUC World Details', extraStats, false, 'col-extra', true);
    }

    overviewContainer.innerHTML = html;

    // Initialize Bootstrap tooltips on all stat items
    initBootstrapTooltips(overviewContainer);
}

/**
 * Render GPS map using advanced GPS map module
 * @param {Object} gpsRoute - GPS route data
 */
function renderGPSMap(gpsRoute, onMapReadyCallback) {

    const mapContainer = document.getElementById('gps-map');

    if (!gpsRoute || !gpsRoute.has_gps) {
        mapContainer.innerHTML = `
            <div class="alert alert-warning m-3">
                ⚠️ No GPS data detected in this file
            </div>
        `;
        // Still call callback even if no GPS (time range should still work)
        if (onMapReadyCallback) {
            setTimeout(onMapReadyCallback, 50);
        }
        return;
    }

    // Clear container
    mapContainer.innerHTML = '';

    // Wait for EUCGPSMap to be available (it's loaded as a module)
    setTimeout(() => {
        if (typeof window.EUCGPSMap !== 'function') {
            console.error('[APP] EUCGPSMap not available');
            mapContainer.innerHTML = `
                <div class="alert alert-danger m-3">
                    ❌ GPS map module failed to load
                </div>
            `;
            return;
        }


        // Clean up existing map instance
        if (window.gpsMapInstance && typeof window.gpsMapInstance.destroy === 'function') {
            window.gpsMapInstance.destroy();
            window.gpsMapInstance = null;
        }

        // Create new map instance
        try {
            window.gpsMapInstance = window.EUCGPSMap('gps-map');

            if (window.gpsMapInstance.init()) {

                // Register with sync system
                if (window.eucChartSync) {
                    window.eucChartSync.registerGPSMap(window.gpsMapInstance);
                }

                // Convert GPS route data to format expected by GPS map module
                const gpsData = convertGPSRouteData(gpsRoute, currentData);

                if (gpsData && gpsData.has_gps) {
                    window.gpsMapInstance.setRouteData(gpsData);
                } else {
                    console.warn('[APP] GPS data conversion failed');
                }

                // Call callback - GPS map is ready
                if (onMapReadyCallback) {
                    onMapReadyCallback();
                }
            } else {
                console.error('[APP] Failed to initialize GPS map');
                mapContainer.innerHTML = `
                    <div class="alert alert-danger m-3">
                        ❌ Failed to initialize GPS map
                    </div>
                `;
                // Call callback even on failure
                if (onMapReadyCallback) {
                    onMapReadyCallback();
                }
            }
        } catch (error) {
            console.error('[APP] Error creating GPS map:', error);
            mapContainer.innerHTML = `
                <div class="alert alert-danger m-3">
                    ❌ Error creating GPS map: ${error.message}
                </div>
            `;
            // Call callback even on error
            if (onMapReadyCallback) {
                onMapReadyCallback();
            }
        }
    }, 300); // Wait for module to load
}

/**
 * Calculate overlay marker positions from data
 * @param {Object} fullData - Full processed data including series
 * @param {Object} gpsRoute - GPS route with coordinates
 * @param {Object} rideStats - Calculated ride statistics
 * @param {boolean} flipPWM - PWM mode flag (false=Mode1, true=Mode2)
 * @returns {Array} Array of overlay objects with position and value
 */
function calculateOverlays(fullData, gpsRoute, rideStats, flipPWM = false) {
    const overlays = [];
    const coords = gpsRoute.coordinates;
    const originalIndices = gpsRoute.originalIndices || [];

    if (!coords || coords.length === 0) {
        return overlays;
    }


    // Helper to convert original CSV row index to coords array index
    const rowIndexToCoordsIndex = (rowIndex) => {
        if (!originalIndices || originalIndices.length === 0) {
            // Fallback for backward compatibility (if originalIndices not available)
            return rowIndex;
        }
        return originalIndices.indexOf(rowIndex);
    };

    // Helper to add overlay if valid coordinates exist
    // NOTE: 'rowIndex' is the original CSV row index, not coords array index!
    const addOverlay = (overlayId, value, rowIndex) => {
        if (value === null || value === undefined || rowIndex === null || rowIndex === undefined) return;

        // Convert original row index to coords array index
        const coordsIndex = rowIndexToCoordsIndex(rowIndex);

        if (coordsIndex === -1) {
            console.warn(`[OVERLAY] ${overlayId}: Row index ${rowIndex} not found in GPS coordinates (no GPS data at this point)`);
            return;
        }

        if (coordsIndex >= coords.length) {
            console.warn(`[OVERLAY] ${overlayId}: Coords index ${coordsIndex} out of range (max: ${coords.length})`);
            return;
        }

        const coord = coords[coordsIndex];
        if (!coord || !Array.isArray(coord)) return;
        const [lat, lng] = coord;
        if (lat == null || lng == null || isNaN(lat) || isNaN(lng)) return;

        overlays.push({
            overlayId: overlayId,
            index: coordsIndex,  // Store coords array index for map rendering
            value: value,
            lat: lat,
            lng: lng
        });
    };

    // Use pre-calculated stats from ride-stats module
    if (rideStats.speed?.max) {
        addOverlay('maxSpeed', rideStats.speed.max.value, rideStats.speed.max.index);
    }

    if (rideStats.power?.max) {
        addOverlay('maxPower', rideStats.power.max.value, rideStats.power.max.index);
    }

    if (rideStats.current?.max) {
        addOverlay('maxCurrent', rideStats.current.max.value, rideStats.current.max.index);
    }

    if (rideStats.elevation?.max && rideStats.elevation?.min) {
        addOverlay('maxElevation', rideStats.elevation.max.value, rideStats.elevation.max.index);
        addOverlay('minElevation', rideStats.elevation.min.value, rideStats.elevation.min.index);
    }

    if (rideStats.tempMotor?.max) {
        addOverlay('maxMotorTemp', rideStats.tempMotor.max.value, rideStats.tempMotor.max.index);
    }

    if (rideStats.tempController?.max) {
        addOverlay('maxControllerTemp', rideStats.tempController.max.value, rideStats.tempController.max.index);
    }

    if (rideStats.tempBattery?.max) {
        addOverlay('maxBatteryTemp', rideStats.tempBattery.max.value, rideStats.tempBattery.max.index);
    }

    if (rideStats.battery?.min) {
        addOverlay('minBattery', rideStats.battery.min.value, rideStats.battery.min.index);
    }

    if (rideStats.pwm) {
        // Add single PWM extreme marker
        addOverlay('safetyMarginMin', rideStats.pwm.value, rideStats.pwm.index);

        // Add ALL zero safety points (PWM at critical threshold)
        if (rideStats.pwmZeroIndices && rideStats.pwmZeroIndices.length > 0) {
            // PWM Mode Logic:
            // - flipPWM = false (Mode 1): Danger at HIGH (100%)
            // - flipPWM = true (Mode 2): Danger at LOW (0%)
            const criticalThreshold = flipPWM ? 0 : 100;
            const criticalLabel = `PWM = ${criticalThreshold}%`;


            let criticalCount = 0;
            rideStats.pwmZeroIndices.forEach(rowIndex => {
                // Convert original row index to coords array index
                const coordsIndex = rowIndexToCoordsIndex(rowIndex);

                if (coordsIndex === -1) {
                    console.warn(`[OVERLAY] zeroSafety: Row ${rowIndex} has no GPS data (skipping)`);
                    return;
                }

                if (coordsIndex >= coords.length) return;

                const coord = coords[coordsIndex];
                if (coord && Array.isArray(coord)) {
                    const [lat, lng] = coord;
                    if (lat != null && lng != null && !isNaN(lat) && !isNaN(lng)) {
                        overlays.push({
                            overlayId: 'zeroSafety',
                            index: coordsIndex,  // Use coords array index, not row index
                            value: criticalThreshold,
                            lat: lat,
                            lng: lng
                        });
                        criticalCount++;
                    }
                }
            });

        }
    }

    if (rideStats.voltage?.min) {
        addOverlay('minVoltage', rideStats.voltage.min.value, rideStats.voltage.min.index);
    }

    if (rideStats.tilt?.max && rideStats.tilt?.min) {
        addOverlay('maxTilt', rideStats.tilt.max.value, rideStats.tilt.max.index);
        addOverlay('minTilt', rideStats.tilt.min.value, rideStats.tilt.min.index);
    }

    if (rideStats.roll?.max && rideStats.roll?.min) {
        addOverlay('maxRoll', rideStats.roll.max.value, rideStats.roll.max.index);
        addOverlay('minRoll', rideStats.roll.min.value, rideStats.roll.min.index);
    }

    return overlays;
}

/**
 * Convert GPS route data to format expected by GPS map module
 * @param {Object} gpsRoute - GPS route from processor
 * @param {Object} fullData - Full processed data including timestamps and series
 * @returns {Object} GPS data in map module format
 */
function convertGPSRouteData(gpsRoute, fullData) {
    if (!gpsRoute || !gpsRoute.has_gps || !gpsRoute.coordinates || gpsRoute.coordinates.length === 0) {
        return { has_gps: false, route_points: [] };
    }


    // Build route_points array with all required data
    const routePoints = [];
    const timestamps = fullData.timestamps;
    const series = fullData.series;

    // GPS coordinates should match the data length 1:1
    // Each coordinate corresponds to the same index in the data arrays
    for (let i = 0; i < gpsRoute.coordinates.length; i++) {
        const coord = gpsRoute.coordinates[i];

        // Skip undefined or invalid coordinates
        if (!coord || !Array.isArray(coord)) {
            continue;
        }

        const [lat, lon] = coord;

        // Skip invalid coordinates
        if (lat === null || lon === null || isNaN(lat) || isNaN(lon)) {
            continue;
        }

        // Use the same index for all data - they should all be aligned
        const dataIndex = i;

        // Only add if we have valid timestamp at this index
        if (dataIndex < timestamps.length && timestamps[dataIndex]) {
            routePoints.push({
                lat: lat,
                lng: lon,
                timestamp: timestamps[dataIndex],
                index: dataIndex,  // CRITICAL: This maps GPS point to data array index
                wheel_speed: series.speed ? series.speed[dataIndex] : null,
                speed: series.gps_speed ? series.gps_speed[dataIndex] : null,
                altitude: series.gps_alt ? series.gps_alt[dataIndex] : null,
                battery: series.battery ? series.battery[dataIndex] : null,
                power: series.power ? series.power[dataIndex] : null,
                pwm: series.pwm ? series.pwm[dataIndex] : null,
                voltage: series.voltage ? series.voltage[dataIndex] : null,
                current: series.current ? series.current[dataIndex] : null,
                temp: series.temp ? series.temp[dataIndex] : null,
                temp_motor: series.temp_motor ? series.temp_motor[dataIndex] : null,
                temp_batt: series.temp_batt ? series.temp_batt[dataIndex] : null,
                energy_consumption: series.energy_consumption ? series.energy_consumption[dataIndex] : null,
                distance: series.distance ? series.distance[dataIndex] : null,
                tilt: series.tilt ? series.tilt[dataIndex] : null,
                roll: series.roll ? series.roll[dataIndex] : null,
                pwmFlipped: currentProcessor ? currentProcessor.flipPWM : false  // Add flip state per point
            });
        }
    }

    if (routePoints.length > 0) {
    }

    // Calculate bounds
    const lats = routePoints.map(p => p.lat);
    const lngs = routePoints.map(p => p.lng);

    // Use cached rideStats from calculateOverviewStats() (which always runs before this),
    // or calculate if not yet available
    const rideStats = fullData.rideStats || calculateRideStats(fullData, {
        detectedMode: currentProcessor?.detectedMode || 1,
        flipPWM: currentProcessor?.flipPWM || false
    });

    // Calculate overlay markers (max speed, max power, etc.) using ride stats
    const overlays = calculateOverlays(fullData, gpsRoute, rideStats, currentProcessor?.flipPWM || false);

    return {
        has_gps: true,
        route_points: routePoints,
        total_points: routePoints.length,
        overlays: overlays,
        bounds: {
            north: Math.max(...lats),
            south: Math.min(...lats),
            east: Math.max(...lngs),
            west: Math.min(...lngs)
        },
        pwmFlipped: currentProcessor ? currentProcessor.flipPWM : false  // Add flip state for map color inversion
    };
}

/**
 * Render charts using canvas chart library
 * @param {Object} chartGroups - Chart group data
 */
function renderCharts(chartGroups) {

    const chartsContainer = document.getElementById('charts-container');

    // Build HTML structure for charts
    let html = '';
    for (const [key, chartData] of Object.entries(chartGroups)) {
        html += `
            <div class="chart-wrapper">
                <div class="chart-title">${chartData.title}</div>
                <div id="chart-${key}" style="height: 250px; width: 100%;"></div>
            </div>
        `;
    }

    chartsContainer.innerHTML = html;

    // Initialize canvas charts after DOM is ready
    setTimeout(() => {
        for (const [key, chartData] of Object.entries(chartGroups)) {
            const containerId = `chart-${key}`;

            try {
                // Create canvas chart instance
                const chart = window.EUCCanvasChart(containerId, {
                    chartType: key,
                    leftAxisTitle: getLeftAxisTitle(key),
                    rightAxisTitle: getRightAxisTitle(key),
                    hasSecondaryY: hasSecondaryAxis(chartData)
                });

                // CRITICAL: Initialize the chart first (creates canvas elements)
                chart.init();

                // Prepare data for chart — only include series with non-null data
                const activeSeries = chartData.series.filter(s =>
                    s.data && s.data.some(v => v !== null && v !== undefined)
                );
                const chartInput = {
                    datetime: chartData.timestamps,
                    series: activeSeries.map(s => ({
                        name: s.name,
                        data: s.data,
                        color: s.color,
                        unit: s.unit,
                        secondary_y: s.secondaryY || false
                    }))
                };

                // Add distance data if available (for top x-axis)
                if (currentData && currentData.series) {
                    // Use distance column (not distance_total), fallback to GPS distance
                    const distanceData = currentData.series.distance ||
                                       currentData.series.gps_distance;
                    if (distanceData && distanceData.length === chartData.timestamps.length) {
                        chartInput.distance = distanceData;
                    }
                }

                // Set data and render (after init)
                chart.setData(chartInput);

            } catch (error) {
                console.error(`[APP] Error rendering chart ${key}:`, error);
            }
        }

        // Initialize synchronized hover if available
        if (window.EUCChartSync) {
            window.EUCChartSync.init();
        }

        // Update render stats now that charts have data (may have been called
        // earlier by the map callback before charts existed)
        updateRenderStatsFromCurrentData();
    }, 200);
}

/**
 * Get left axis title for chart type
 * @param {string} chartType - Chart type key
 * @returns {string} Axis title
 */
function getLeftAxisTitle(chartType) {
    const titles = {
        'speed': 'Speed (km/h)',
        'battery': 'PWM %',
        'power': 'Power (W)',
        'electrical': 'Voltage (V)',
        'temperature': 'Temperature (°C)',
        'acceleration': 'Acceleration (m/s²)',
        'orientation': 'Angle (°)'
    };
    return titles[chartType] || '';
}

/**
 * Get right axis title for chart type
 * @param {string} chartType - Chart type key
 * @returns {string} Axis title
 */
function getRightAxisTitle(chartType) {
    const titles = {
        'speed': 'Altitude (m)',
        'battery': 'Battery %',
        'power': 'Energy (Wh/km)',
        'electrical': 'Current (A)',
        'temperature': 'CPU Load (%)'
    };
    return titles[chartType] || '';
}

/**
 * Check if chart has secondary Y axis
 * @param {Object} chartData - Chart data
 * @returns {boolean} True if has secondary axis
 */
function hasSecondaryAxis(chartData) {
    return chartData.series.some(s => s.secondaryY === true);
}

/**
 * Handle diagnostic view toggle
 * @param {Event} event - Change event
 */
function handleDiagnosticToggle(event) {
    const diagnosticCard = document.getElementById('diagnostic-card');
    if (event.target.checked) {
        renderDiagnosticView();
        diagnosticCard.style.display = '';
    } else {
        diagnosticCard.style.display = 'none';
    }
}

/**
 * Render the CSV Column Diagnostic View.
 * Analyzes loaded CSV headers against the current processor's column mapping.
 */
function renderDiagnosticView() {
    if (!currentProcessor || !csvHeaders || !rawParsedCSV) {
        document.getElementById('diagnostic-summary').innerHTML = '';
        document.getElementById('diagnostic-table-container').innerHTML =
            '<p class="text-muted">Load a CSV file to see column diagnostics.</p>';
        return;
    }

    const columnMapping = currentProcessor.getColumnMapping();
    const formatName = currentProcessor.getFormatName();
    const totalColumns = csvHeaders.length;

    // Classify each CSV header as mapped or unmapped
    const columns = csvHeaders.map(header => {
        const mapping = columnMapping[header];
        const samples = [];
        for (let i = 0; i < Math.min(3, rawParsedCSV.length); i++) {
            const val = rawParsedCSV[i][header];
            if (val !== undefined && val !== null && val !== '') {
                samples.push(String(val).length > 50 ? String(val).substring(0, 50) + '...' : String(val));
            }
        }
        return {
            header: header,
            mapped: !!mapping,
            mapping: mapping || null,
            samples: samples
        };
    });

    // Sort: unmapped first, then mapped alphabetically
    columns.sort((a, b) => {
        if (a.mapped !== b.mapped) return a.mapped ? 1 : -1;
        return a.header.localeCompare(b.header);
    });

    const mappedCount = columns.filter(c => c.mapped).length;
    const unmappedCount = totalColumns - mappedCount;

    // --- Summary ---
    const summaryEl = document.getElementById('diagnostic-summary');
    summaryEl.innerHTML = `
        <span class="badge bg-secondary">${formatName}</span>
        <span class="badge bg-primary">${totalColumns} columns</span>
        <span class="badge bg-success">${mappedCount} mapped</span>
        <span class="badge ${unmappedCount > 0 ? 'bg-warning text-dark' : 'bg-success'}">${unmappedCount} unmapped</span>
    `;

    // --- Column Analysis Table ---
    let tableHtml = `
        <h6 class="mt-3 mb-2">Column Analysis</h6>
        <p class="text-muted small">${totalColumns} columns in file (${mappedCount} mapped, ${unmappedCount} unmapped)</p>
        <div class="table-responsive">
            <table class="table table-sm table-bordered">
                <thead>
                    <tr>
                        <th>Status</th>
                        <th>CSV Column</th>
                        <th>Maps To</th>
                        <th>Type</th>
                        <th>Sample Values</th>
                    </tr>
                </thead>
                <tbody>
    `;

    for (const col of columns) {
        const rowClass = col.mapped ? '' : 'diagnostic-unmapped';
        const statusBadge = col.mapped
            ? '<span class="badge bg-success">Mapped</span>'
            : '<span class="badge bg-warning text-dark">Unmapped</span>';

        let mapsTo = '—';
        let colType = '—';

        if (col.mapping) {
            colType = col.mapping.type;
            if (col.mapping.type === 'series') {
                mapsTo = `<code>${col.mapping.series}</code> → ${col.mapping.label}`;
                if (col.mapping.unit) mapsTo += ` (${col.mapping.unit})`;
            } else if (col.mapping.type === 'timestamp') {
                mapsTo = 'timestamps';
            } else if (col.mapping.type === 'gps') {
                mapsTo = col.mapping.description || 'GPS Route';
            } else if (col.mapping.type === 'metadata') {
                mapsTo = col.mapping.description || 'Metadata';
            }
        }

        const samplesHtml = col.samples.length > 0
            ? col.samples.map(s => `<code>${s}</code>`).join(', ')
            : '<span class="text-muted">—</span>';

        tableHtml += `
            <tr class="${rowClass}">
                <td>${statusBadge}</td>
                <td><code>${col.header}</code></td>
                <td>${mapsTo}</td>
                <td>${colType}</td>
                <td>${samplesHtml}</td>
            </tr>
        `;
    }

    tableHtml += `
                </tbody>
            </table>
        </div>
    `;

    // --- Format Template Reference ---
    const templateColumns = Object.keys(columnMapping);
    const presentInFile = new Set(csvHeaders);
    const presentCount = templateColumns.filter(c => presentInFile.has(c)).length;
    const absentCount = templateColumns.length - presentCount;

    tableHtml += `
        <h6 class="mt-4 mb-2">Format Template Reference — ${formatName}</h6>
        <p class="text-muted small">${templateColumns.length} known columns (${presentCount} present, ${absentCount} absent in this file)</p>
        <div class="table-responsive">
            <table class="table table-sm table-bordered">
                <thead>
                    <tr>
                        <th>Status</th>
                        <th>CSV Column</th>
                        <th>Maps To</th>
                        <th>Type</th>
                    </tr>
                </thead>
                <tbody>
    `;

    for (const colName of templateColumns) {
        const mapping = columnMapping[colName];
        const isPresent = presentInFile.has(colName);
        const rowClass = isPresent ? '' : 'diagnostic-absent';
        const statusBadge = isPresent
            ? '<span class="badge bg-success">Present</span>'
            : '<span class="badge bg-secondary">Absent</span>';

        let mapsTo = '';
        if (mapping.type === 'series') {
            mapsTo = `<code>${mapping.series}</code> → ${mapping.label}`;
            if (mapping.unit) mapsTo += ` (${mapping.unit})`;
            if (mapping.note) mapsTo += ` <span class="text-muted">— ${mapping.note}</span>`;
        } else if (mapping.type === 'timestamp') {
            mapsTo = 'timestamps';
        } else if (mapping.type === 'gps') {
            mapsTo = mapping.description || 'GPS Route';
        } else if (mapping.type === 'metadata') {
            mapsTo = mapping.description || 'Metadata';
        }

        tableHtml += `
            <tr class="${rowClass}">
                <td>${statusBadge}</td>
                <td><code>${colName}</code></td>
                <td>${mapsTo}</td>
                <td>${mapping.type}</td>
            </tr>
        `;
    }

    tableHtml += `
                </tbody>
            </table>
        </div>
    `;

    document.getElementById('diagnostic-table-container').innerHTML = tableHtml;
}

/**
 * Handle dark mode toggle
 * @param {Event} event - Change event
 */
function handleDarkModeToggle(event) {
    const darkModeEnabled = event.target.checked;

    if (darkModeEnabled) {
        document.body.classList.add('dark-mode');
        localStorage.setItem('darkMode', 'true');
    } else {
        document.body.classList.remove('dark-mode');
        localStorage.setItem('darkMode', 'false');
    }

    // Switch map tiles if map exists
    if (window.gpsMapInstance && window.gpsMapInstance.setMapStyle) {
        const mapStyle = darkModeEnabled ? 'dark' : 'grayscale';
        window.gpsMapInstance.setMapStyle(mapStyle);
    }

    // Re-apply theme hue for new mode (S/L formulas change between light/dark)
    const savedHue = localStorage.getItem('themeHue');
    if (savedHue !== null) {
        applyThemeHue(parseInt(savedHue));
    }
    updateHueSwatch(savedHue !== null ? parseInt(savedHue) : null);

    // Redraw charts so they pick up new CSS theme variables
    if (window.eucChartSync && window.eucChartSync.charts) {
        Object.values(window.eucChartSync.charts).forEach(chart => {
            if (chart && typeof chart.redraw === 'function') chart.redraw();
        });
    }
}

/**
 * Update PWM mode status display
 * @param {number} detectedMode - Auto-detected PWM mode (1 or 2)
 * @param {boolean} flipped - Whether transformation is applied
 */
function updatePWMModeStatus(detectedMode, flipped) {
    const statusElement = document.getElementById('pwm-mode-status');
    if (!statusElement) {
        console.warn('[APP] PWM mode status element not found');
        return;
    }

    // Calculate current mode after transformation
    // If Mode 1 and flipped → becomes Mode 2
    // If Mode 2 and flipped → becomes Mode 1
    const currentMode = (detectedMode === 1 && !flipped) || (detectedMode === 2 && flipped) ? 1 : 2;

    if (currentMode === 1) {
        // Mode 1: Low values at rest, danger at HIGH (100%)
        statusElement.textContent = 'Mode 1: 0% safe, 100% unsafe';
    } else {
        // Mode 2: High values at rest, danger at LOW (0%)
        statusElement.textContent = 'Mode 2: 100% safe, 0% unsafe';
    }

}

/**
 * Flip PWM data in a processed data object.
 * Creates new arrays (does not mutate the original pwm array).
 * Also updates the matching chart series reference and clears cached rideStats.
 * @param {Object} data - Processed data object (currentData or originalData)
 */
function flipPWMData(data) {
    if (data.series.pwm) {
        data.series.pwm = data.series.pwm.map(v => v !== null ? 100 - v : null);
    }
    // Point the chart series to the already-flipped array
    if (data.chartGroups?.battery) {
        for (const s of data.chartGroups.battery.series) {
            if (s.name === 'PWM %') {
                s.data = data.series.pwm;
                break;
            }
        }
    }
    // Clear cached rideStats since PWM values changed
    delete data.rideStats;
}

/**
 * Handle PWM flip toggle.
 * Flips PWM values in-place on both currentData and originalData,
 * preserving any active time range trim.
 * @param {Event} event - Change event
 */
function handlePWMFlip(event) {
    const flipEnabled = event.target.checked;

    if (!currentProcessor || !currentData) {
        console.warn('[APP] Cannot flip PWM - no data loaded');
        return;
    }

    currentProcessor.setPWMFlip(flipEnabled);

    // Flip PWM on both current and original (preserves any active trim)
    flipPWMData(currentData);
    flipPWMData(originalData);

    // Re-render components that depend on PWM
    renderOverview(currentData);
    renderCharts(currentData.chartGroups);

    // Update GPS map (overlays + route colors)
    if (window.gpsMapInstance && currentData.gpsRoute?.has_gps) {
        const gpsData = convertGPSRouteData(currentData.gpsRoute, currentData);
        if (gpsData?.has_gps) {
            window.gpsMapInstance.setRouteData(gpsData);
        }
    }

    // Update PWM mode status display
    updatePWMModeStatus(currentProcessor.detectedMode, flipEnabled);
}

/**
 * Show/hide loading overlay
 * @param {boolean} show - Show or hide
 */
function showLoading(show) {
    document.getElementById('loading-overlay').style.display = show ? 'flex' : 'none';
}

/**
 * Handle Apply Time Range button (called by time range manager)
 * @param {number} startTime - Start time in milliseconds
 * @param {number} endTime - End time in milliseconds
 */
function handleApplyTimeRange(startTime, endTime) {
    if (!originalData) {
        console.warn('[TIME RANGE] No original data to filter');
        return;
    }


    // Filter data
    const filteredData = filterDataByTimeRange(originalData, startTime, endTime);

    if (!filteredData) {
        alert('Time range filtering failed - no data in selected range');
        return;
    }

    // Update current data
    currentData = filteredData;

    // Re-render all components
    renderOverview(filteredData);
    renderCharts(filteredData.chartGroups);

    // Render GPS map with callback to reinitialize time range manager with new data
    renderGPSMap(filteredData.gpsRoute, () => {

        // Cleanup existing time range manager
        if (timeRangeManager) {
            timeRangeManager.cleanup();
        }

        // Create new time range manager with updated GPS map instance
        timeRangeManager = createTimeRangeManager(
            window.gpsMapInstance,
            handleApplyTimeRange,
            handleResetTimeRange
        );

        // Initialize with FILTERED data (new range is the trimmed range)
        timeRangeManager.initialize(filteredData);

        // Update render statistics after trim
        updateRenderStatsFromCurrentData();
    });

}

/**
 * Handle Reset Time Range button (called by time range manager)
 */
function handleResetTimeRange() {

    if (!originalData) {
        console.warn('[TIME RANGE] No original data to reset to');
        return;
    }

    // Reset to original data
    currentData = JSON.parse(JSON.stringify(originalData));

    // Re-render all components
    renderOverview(currentData);
    renderCharts(currentData.chartGroups);

    // Render GPS map with callback to reinitialize time range manager with original data
    renderGPSMap(currentData.gpsRoute, () => {

        // Cleanup existing time range manager
        if (timeRangeManager) {
            timeRangeManager.cleanup();
        }

        // Create new time range manager with updated GPS map instance
        timeRangeManager = createTimeRangeManager(
            window.gpsMapInstance,
            handleApplyTimeRange,
            handleResetTimeRange
        );

        // Initialize with ORIGINAL data (full range restored)
        timeRangeManager.initialize(currentData);

        // Update render statistics after reset
        updateRenderStatsFromCurrentData();
    });

}

/**
 * Filter data by time range
 * @param {Object} data - Original data
 * @param {number} startTime - Start time in milliseconds
 * @param {number} endTime - End time in milliseconds
 * @returns {Object} Filtered data
 */
function filterDataByTimeRange(data, startTime, endTime) {

    // Filter timestamps and find indices
    const filteredIndices = [];
    const filteredTimestamps = [];

    for (let i = 0; i < data.timestamps.length; i++) {
        const ts = data.timestamps[i];
        if (ts >= startTime && ts <= endTime) {
            filteredIndices.push(i);
            filteredTimestamps.push(ts);
        }
    }

    if (filteredIndices.length === 0) {
        console.error('[TIME RANGE] No data points in selected range');
        return null;
    }


    // Filter all series
    const filteredSeries = {};
    for (const [key, values] of Object.entries(data.series)) {
        filteredSeries[key] = filteredIndices.map(i => values[i]);
    }

    // Filter GPS route
    let filteredGPSRoute = { has_gps: false };
    if (data.gpsRoute && data.gpsRoute.has_gps && data.gpsRoute.coordinates) {
        const filteredCoordinates = filteredIndices.map(i => data.gpsRoute.coordinates[i]);
        filteredGPSRoute = {
            has_gps: true,
            coordinates: filteredCoordinates
        };
    }

    // Filter chart groups
    const filteredChartGroups = {};
    for (const [groupKey, chartData] of Object.entries(data.chartGroups)) {
        const filteredChartSeries = chartData.series.map(s => ({
            ...s,
            data: s.data ? filteredIndices.map(i => s.data[i]) : null
        }));

        filteredChartGroups[groupKey] = {
            ...chartData,
            timestamps: filteredTimestamps,
            series: filteredChartSeries
        };
    }

    return {
        timestamps: filteredTimestamps,
        series: filteredSeries,
        gpsRoute: filteredGPSRoute,
        chartGroups: filteredChartGroups,
        metadata: data.metadata
    };
}

/**
 * Go back to file list browser
 */
function backToFileList() {

    // Clear current data
    currentData = null;
    originalData = null;
    rawParsedCSV = null;
    csvHeaders = null;
    currentFilename = null;
    loadedFromServer = false;

    // Reset diagnostic view
    document.getElementById('diagnostic-view-toggle').checked = false;
    document.getElementById('diagnostic-card').style.display = 'none';

    // Cleanup charts through sync system (removes resize listeners)
    if (window.eucChartSync && typeof window.eucChartSync.cleanup === 'function') {
        window.eucChartSync.cleanup();
    }

    // Destroy GPS map if it exists
    if (window.gpsMapInstance && typeof window.gpsMapInstance.destroy === 'function') {
        window.gpsMapInstance.destroy();
        window.gpsMapInstance = null;
    }

    // Cleanup time range manager
    if (timeRangeManager) {
        timeRangeManager.cleanup();
        timeRangeManager = null;
    }

    // Reset file info
    document.getElementById('file-info').textContent = 'Select a file from the list';

    // Hide back button
    const backBtn = document.getElementById('back-to-files-btn');
    if (backBtn) {
        backBtn.style.display = 'none';
    }

    // Show file browser again
    showPlaceholderState();

}

// Expose functions to global scope for inline event handlers
window.loadCSVFromServer = loadCSVFromServer;
window.backToFileList = backToFileList;

// ==================== Footer Date/Time Update ====================

/**
 * Update footer date and time display
 */
function updateFooterDateTime() {
    const footerDateTime = document.getElementById('footer-datetime');
    if (!footerDateTime) return;

    const now = new Date();

    // Format: "Day, Month DD, YYYY - HH:MM:SS AM/PM"
    const options = {
        weekday: 'short',
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
    };

    const formattedDateTime = now.toLocaleString('en-US', options);
    footerDateTime.textContent = formattedDateTime;
}

/**
 * Initialize footer date/time updates
 */
let footerDateTimeInterval = null;
function initFooterDateTime() {
    // Clear any existing interval (prevents duplicates if called multiple times)
    if (footerDateTimeInterval) clearInterval(footerDateTimeInterval);

    // Update immediately
    updateFooterDateTime();

    // Update every second
    footerDateTimeInterval = setInterval(updateFooterDateTime, 1000);
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

