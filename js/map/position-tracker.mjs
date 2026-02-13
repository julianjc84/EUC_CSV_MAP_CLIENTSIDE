/**
 * Position Tracker Module
 *
 * Handles position tracking and mouse interactions:
 * - Position updates by index or timestamp
 * - Mouse hover tracking on route
 * - GPS point lookup and interpolation
 * - Chart synchronization
 */

import { calculatePositionOnLineSegment, interpolateDataAtSegmentPosition, projectToPolyline } from './map-utils.mjs';
import { cleanupDebugBoxes } from './popup-manager.mjs';
import { DEBUG } from './debug-config.mjs';

/**
 * Create position tracker
 * @param {object} map - Leaflet map instance
 * @param {object} components - Map components (markerRefs, popupManager)
 * @returns {object} PositionTracker instance
 */
export function createPositionTracker(map, components) {
    let routeData = null;
    let indexToPointMap = {};
    let selectedIndex = -1;
    let lastNearestIdx = -1;
    let lastMouseSync = 0;
    let isHoveringRoute = false;
    let popupPinnedBy = null;
    let tooltipHideTimeout = null;
    let syncLineTimeout = null;

    return {
        /**
         * Set route data for tracking
         * @param {object} gpsRouteData - GPS route data
         */
        setRouteData(gpsRouteData) {
            routeData = gpsRouteData;

            // Create index-to-point mapping for O(1) lookups
            indexToPointMap = {};
            if (routeData && routeData.route_points) {
                routeData.route_points.forEach(point => {
                    indexToPointMap[point.index] = point;
                });
            }
        },

        /**
         * Update position by data index
         * @param {number} dataIndex - Data point index
         * @param {object} options - Update options
         */
        updatePosition(dataIndex, options = {}) {
            const perfStart = performance.now();

            if (!routeData || !routeData.route_points || dataIndex < 0) {
                // Only hide popup, but keep marker visible
                if (options.hidePopup || (options.pin && popupPinnedBy === options.pin)) {
                    components.popupManager.hidePopup();
                    popupPinnedBy = null;
                }
                return;
            }

            selectedIndex = dataIndex;

            // Find GPS point closest to the data index
            const findPointStart = performance.now();
            const gpsPoint = this.findGPSPointByIndex(dataIndex);
            const findPointTime = performance.now() - findPointStart;

            if (!gpsPoint) {
                return;
            }

            // Update current position marker
            const markerUpdateStart = performance.now();
            if (components.markerRefs.currentMarker) {
                const targetLatLng = L.latLng(gpsPoint.lat, gpsPoint.lng);
                components.markerRefs.currentMarker.setLatLng(targetLatLng);
                if (!map.hasLayer(components.markerRefs.currentMarker)) {
                    components.markerRefs.currentMarker.addTo(map);
                }

                // Show independent popup with current data
                if (options.showPopup !== false) {
                    components.popupManager.showIndependentPopup(gpsPoint, targetLatLng);
                }
            }
            const markerUpdateTime = performance.now() - markerUpdateStart;

            // Optionally center if near edge
            if (map && (options.centerIfNearEdge || options.center)) {
                const marginSides = 20;
                const marginBottom = 120;
                const size = map.getSize();

                const popupElement = document.querySelector('.independent-data-popup .leaflet-popup-content') ||
                                    document.querySelector('.independent-data-popup') ||
                                    document.querySelector('.leaflet-popup-content');
                let popupLeft, popupRight, popupTop, popupBottom, popupWidth, popupHeight;

                if (popupElement) {
                    const popupRect = popupElement.getBoundingClientRect();
                    const mapContainer = map.getContainer();
                    const mapRect = mapContainer.getBoundingClientRect();

                    popupLeft = popupRect.left - mapRect.left;
                    popupTop = popupRect.top - mapRect.top;
                    popupWidth = popupRect.width;
                    popupHeight = popupRect.height;
                    popupRight = popupLeft + popupWidth;
                    popupBottom = popupTop + popupHeight;
                } else {
                    const markerPixel = map.latLngToContainerPoint(components.markerRefs.currentMarker.getLatLng());
                    const popupPixel = L.point(markerPixel.x, markerPixel.y - 30);
                    popupWidth = 150;
                    popupHeight = 60;
                    popupLeft = popupPixel.x - (popupWidth / 2);
                    popupRight = popupPixel.x + (popupWidth / 2);
                    popupTop = popupPixel.y;
                    popupBottom = popupPixel.y + popupHeight;
                }

                const nearEdge = (
                    popupLeft < marginSides ||
                    popupRight > size.x - marginSides ||
                    popupTop < marginSides ||
                    popupBottom > size.y - marginBottom
                );

                // Debug visualization if enabled
                this._updateDebugVisualization(popupElement, popupLeft, popupTop, popupWidth, popupHeight, marginSides, marginBottom, size);

                if (nearEdge || options.center) {
                    if (DEBUG.POSITION_TRACKER) console.log(`[POSITION TRACKER] Edge triggered - centering map`);
                    map.panTo(components.markerRefs.currentMarker.getLatLng(), { animate: true, duration: 0.15 });
                }
            }

            // Trace for diagnostics
            if (window.EUC_DASH && window.EUC_DASH.syncTrace) {
                window.EUC_DASH.syncTrace.push({ when: Date.now(), src: 'gps-map', type: 'update', index: dataIndex, ts: gpsPoint.timestamp });
            }

            const totalTime = performance.now() - perfStart;
            // Only log if performance is poor (>33ms = <30fps)
            if (totalTime > 33) {
                console.log(`[PERF] Map updatePosition: ${totalTime.toFixed(2)}ms (find: ${findPointTime.toFixed(2)}ms, marker: ${markerUpdateTime.toFixed(2)}ms)`);
            }
        },

        /**
         * Update position by timestamp
         * @param {number} timestampMs - Timestamp in milliseconds
         * @param {object} options - Update options
         */
        updatePositionByTimestamp(timestampMs, options = {}) {
            if (!routeData || !routeData.route_points || !Array.isArray(routeData.route_points)) return;
            if (DEBUG.POSITION_TRACKER) console.log(`[POSITION TRACKER] Received timestamp sync: ${timestampMs}`);

            // Binary search nearest by timestamp
            const points = routeData.route_points;
            let lo = 0, hi = points.length - 1;
            while (lo < hi) {
                const mid = (lo + hi) >> 1;
                if (points[mid].timestamp < timestampMs) lo = mid + 1; else hi = mid;
            }
            let idx = lo;
            if (idx > 0 && Math.abs(points[idx].timestamp - timestampMs) > Math.abs(points[idx - 1].timestamp - timestampMs)) {
                idx = idx - 1;
            }

            const gpsPoint = points[idx];
            const actualTimestamp = gpsPoint?.timestamp;
            const timeDiff = actualTimestamp ? Math.abs(actualTimestamp - timestampMs) : 'N/A';
            if (DEBUG.POSITION_TRACKER) console.log(`[POSITION TRACKER] Selected GPS index=${idx}, actual ts=${actualTimestamp}, diff=${timeDiff}ms`);

            // Don't trigger sync when updating from timestamp (prevents sync loops)
            const optionsWithNoSync = { ...options, noSync: true };
            this.updatePosition(points[idx]?.index ?? -1, optionsWithNoSync);
        },

        /**
         * Find GPS point by data index (O(1) exact match or binary search)
         * @param {number} dataIndex - Data point index
         * @returns {object|null} GPS point or null
         */
        findGPSPointByIndex(dataIndex) {
            // Efficient O(1) lookup for exact match
            const exactMatch = indexToPointMap[dataIndex];
            if (exactMatch) {
                return exactMatch;
            }

            // If no exact match, find closest point using binary search
            const points = routeData.route_points;
            if (!points || points.length === 0) {
                return null;
            }

            // Handle out-of-bounds cases
            if (dataIndex < points[0].index) {
                return points[0];
            }
            if (dataIndex > points[points.length - 1].index) {
                return points[points.length - 1];
            }

            let low = 0;
            let high = points.length - 1;

            while (low <= high) {
                let mid = Math.floor((low + high) / 2);
                const point = points[mid];

                if (point.index === dataIndex) {
                    return point;
                }

                if (point.index < dataIndex) {
                    low = mid + 1;
                } else {
                    high = mid - 1;
                }
            }

            // After loop, find closer of the two neighbors
            if (low >= points.length) low = points.length - 1;
            if (high < 0) high = 0;

            const pointLow = points[low];
            const pointHigh = points[high];

            if (Math.abs(pointLow.index - dataIndex) < Math.abs(pointHigh.index - dataIndex)) {
                return pointLow;
            } else {
                return pointHigh;
            }
        },

        /**
         * Find data point by segment position (for mouse tracking)
         * @param {number} lat - Latitude
         * @param {number} lng - Longitude
         * @returns {object|null} GPS point or null
         */
        findDataPointBySegmentPosition(lat, lng) {
            if (!window.currentRouteSegments || !routeData || !routeData.route_points) return null;

            const cursorLatLng = L.latLng(lat, lng);
            let bestSegment = null;
            let bestSegmentDistance = Infinity;
            let bestPositionOnSegment = 0;

            // Find the closest segment to cursor
            window.currentRouteSegments.forEach(segment => {
                const segmentCoords = segment.coords;

                // Check distance to each line segment in this route segment
                for (let i = 0; i < segmentCoords.length - 1; i++) {
                    const p1 = L.latLng(segmentCoords[i]);
                    const p2 = L.latLng(segmentCoords[i + 1]);

                    // Find closest point on this line segment
                    const closestPoint = this._closestPointOnSegment(cursorLatLng, p1, p2);
                    const distance = map.distance(cursorLatLng, closestPoint);

                    if (distance < bestSegmentDistance) {
                        bestSegmentDistance = distance;
                        bestSegment = segment;

                        // Calculate relative position within entire segment (0.0 to 1.0)
                        const segmentLength = segmentCoords.length - 1;
                        const segmentProgress = i / segmentLength;

                        // Add fine position within this particular line segment
                        const lineSegmentProgress = calculatePositionOnLineSegment(cursorLatLng, p1, p2, map);
                        bestPositionOnSegment = segmentProgress + (lineSegmentProgress / segmentLength);
                        bestPositionOnSegment = Math.max(0, Math.min(1, bestPositionOnSegment));
                    }
                }
            });

            if (!bestSegment) return null;

            // Interpolate data within the segment
            return interpolateDataAtSegmentPosition(bestSegment, bestPositionOnSegment);
        },

        /**
         * Mouse move handler for route
         * @param {object} e - Leaflet mouse event
         */
        onRouteMouseMove(e) {
            if (DEBUG.POSITION_TRACKER) console.log('[POSITION TRACKER] Mouse move on route detected');
            if (!routeData || !routeData.route_points) return;

            // Set hovering state immediately to prevent hide timeout
            isHoveringRoute = true;
            popupPinnedBy = 'map';

            const now = Date.now();
            if (now - lastMouseSync < 50) return; // 20fps throttle

            lastMouseSync = now;

            const lat = e.latlng.lat;
            const lng = e.latlng.lng;
            const nearest = this.findDataPointBySegmentPosition(lat, lng);
            if (!nearest) return;

            // Update visual marker position
            if (components.markerRefs.currentMarker) {
                const cursorLatLng = L.latLng(lat, lng);
                const projectedPosition = projectToPolyline(cursorLatLng, routeData.route_points, map) || cursorLatLng;

                components.markerRefs.currentMarker.setLatLng(projectedPosition);
                if (!map.hasLayer(components.markerRefs.currentMarker)) {
                    components.markerRefs.currentMarker.addTo(map);
                }

                // Show independent popup with data
                components.popupManager.showIndependentPopup(nearest, projectedPosition);

                // Cancel any pending tooltip hide
                if (tooltipHideTimeout) {
                    clearTimeout(tooltipHideTimeout);
                    tooltipHideTimeout = null;
                }

                // Sync with graphs
                if (syncLineTimeout) {
                    clearTimeout(syncLineTimeout);
                    syncLineTimeout = null;
                }

                if (window.eucChartSync && typeof window.eucChartSync.syncHover === 'function') {
                    window.eucChartSync.syncHover({ index: nearest.index, timestamp: nearest.timestamp }, 'gps-map');
                }

                // Edge detection for direct map interaction
                this._handleEdgeDetection(projectedPosition);
            }
        },

        /**
         * Mouse out handler for route
         * @param {object} e - Leaflet mouse event
         */
        onRouteMouseOut(e) {
            if (DEBUG.POSITION_TRACKER) console.log('[POSITION TRACKER] Mouse OUT of route detected');
            popupPinnedBy = null;
            isHoveringRoute = false;

            // Delay hiding tooltip to prevent flashing
            if (tooltipHideTimeout) {
                clearTimeout(tooltipHideTimeout);
            }

            tooltipHideTimeout = setTimeout(() => {
                if (!isHoveringRoute) {
                    if (DEBUG.POSITION_TRACKER) console.log('[POSITION TRACKER] Hiding tooltip after delay');
                    components.popupManager.hidePopup();
                }
                tooltipHideTimeout = null;
            }, 150);
        },

        /**
         * Map click handler
         * @param {object} e - Leaflet mouse event
         */
        onMapClick(e) {
            // Map→Charts sync removed per user request
        },

        /**
         * Cleanup resources
         */
        cleanup() {
            routeData = null;
            indexToPointMap = {};
            selectedIndex = -1;
            lastNearestIdx = -1;
            isHoveringRoute = false;
            popupPinnedBy = null;

            if (tooltipHideTimeout) {
                clearTimeout(tooltipHideTimeout);
                tooltipHideTimeout = null;
            }
            if (syncLineTimeout) {
                clearTimeout(syncLineTimeout);
                syncLineTimeout = null;
            }

            cleanupDebugBoxes();
        },

        /**
         * Helper: Closest point on segment (internal use)
         * @private
         */
        _closestPointOnSegment(p, a, b) {
            const pPt = map.latLngToLayerPoint(p);
            const aPt = map.latLngToLayerPoint(a);
            const bPt = map.latLngToLayerPoint(b);
            const ab = bPt.subtract(aPt);
            const ap = pPt.subtract(aPt);
            const abLen2 = (ab.x * ab.x) + (ab.y * ab.y);
            let t = 0;
            if (abLen2 > 0) {
                const apDotAb = (ap.x * ab.x) + (ap.y * ab.y);
                t = apDotAb / abLen2;
            }
            t = Math.max(0, Math.min(1, t));
            const proj = new L.Point(aPt.x + ab.x * t, aPt.y + ab.y * t);
            return map.layerPointToLatLng(proj);
        },

        /**
         * Helper: Handle edge detection and panning
         * @private
         */
        _handleEdgeDetection(projectedPosition) {
            const marginSides = 20;
            const marginBottom = 120;
            const size = map.getSize();

            const popupElement = document.querySelector('.independent-data-popup .leaflet-popup-content') ||
                                document.querySelector('.independent-data-popup') ||
                                document.querySelector('.leaflet-popup-content');
            let popupLeft, popupRight, popupTop, popupBottom, popupWidth, popupHeight;

            if (popupElement) {
                const popupRect = popupElement.getBoundingClientRect();
                const mapContainer = map.getContainer();
                const mapRect = mapContainer.getBoundingClientRect();

                popupLeft = popupRect.left - mapRect.left;
                popupTop = popupRect.top - mapRect.top;
                popupWidth = popupRect.width;
                popupHeight = popupRect.height;
                popupRight = popupLeft + popupWidth;
                popupBottom = popupTop + popupHeight;
            } else {
                const markerPixel = map.latLngToContainerPoint(projectedPosition);
                const popupPixel = L.point(markerPixel.x, markerPixel.y - 30);
                popupWidth = 150;
                popupHeight = 60;
                popupLeft = popupPixel.x - (popupWidth / 2);
                popupRight = popupPixel.x + (popupWidth / 2);
                popupTop = popupPixel.y;
                popupBottom = popupPixel.y + popupHeight;
            }

            const nearEdge = (
                popupLeft < marginSides ||
                popupRight > size.x - marginSides ||
                popupTop < marginSides ||
                popupBottom > size.y - marginBottom
            );

            // Debug visualization
            this._updateDebugVisualization(popupElement, popupLeft, popupTop, popupWidth, popupHeight, marginSides, marginBottom, size);

            if (nearEdge) {
                if (DEBUG.POSITION_TRACKER) console.log(`[POSITION TRACKER] Direct map edge triggered - panning`);
                map.panTo(projectedPosition, { animate: true, duration: 0.15 });
            }
        },

        /**
         * Helper: Update debug visualization boxes
         * @private
         */
        _updateDebugVisualization(popupElement, popupLeft, popupTop, popupWidth, popupHeight, marginSides, marginBottom, size) {
            // Only show debug boxes if POPUP debug category is enabled
            if (!(window.EUC_DASH && window.EUC_DASH.DEBUG_CATEGORIES && window.EUC_DASH.DEBUG_CATEGORIES.POPUP)) {
                cleanupDebugBoxes();
                return;
            }

            // Create/update bounding box
            let boundingBox = document.getElementById('popup-bounding-box');
            if (!boundingBox) {
                boundingBox = document.createElement('div');
                boundingBox.id = 'popup-bounding-box';
                boundingBox.style.cssText = `
                    position: absolute;
                    border: 2px dashed red;
                    background: rgba(255, 0, 0, 0.1);
                    pointer-events: none;
                    z-index: 10000;
                    font-size: 10px;
                    color: red;
                    font-weight: bold;
                `;
                document.body.appendChild(boundingBox);
            }

            // Position bounding box
            if (popupElement) {
                const popupRect = popupElement.getBoundingClientRect();
                boundingBox.style.left = (popupRect.left + window.scrollX) + 'px';
                boundingBox.style.top = (popupRect.top + window.scrollY) + 'px';
                boundingBox.style.width = popupRect.width + 'px';
                boundingBox.style.height = popupRect.height + 'px';
            } else {
                const mapContainer = map.getContainer();
                const mapRect = mapContainer.getBoundingClientRect();
                boundingBox.style.left = (mapRect.left + popupLeft + window.scrollX) + 'px';
                boundingBox.style.top = (mapRect.top + popupTop + window.scrollY) + 'px';
                boundingBox.style.width = popupWidth + 'px';
                boundingBox.style.height = popupHeight + 'px';
            }
            boundingBox.innerHTML = `${popupWidth.toFixed(0)}x${popupHeight.toFixed(0)}`;

            // Create/update edge detection zone box
            let edgeBox = document.getElementById('edge-detection-box');
            if (!edgeBox) {
                edgeBox = document.createElement('div');
                edgeBox.id = 'edge-detection-box';
                edgeBox.style.cssText = `
                    position: absolute;
                    border: 2px dashed yellow;
                    background: rgba(255, 255, 0, 0.05);
                    pointer-events: none;
                    z-index: 9999;
                    font-size: 10px;
                    color: yellow;
                    font-weight: bold;
                `;
                document.body.appendChild(edgeBox);
            }

            // Position edge box
            const mapContainer = map.getContainer();
            const mapRect = mapContainer.getBoundingClientRect();
            edgeBox.style.left = (mapRect.left + marginSides + window.scrollX) + 'px';
            edgeBox.style.top = (mapRect.top + marginSides + window.scrollY) + 'px';
            edgeBox.style.width = (size.x - 2 * marginSides) + 'px';
            edgeBox.style.height = (size.y - marginSides - marginBottom) + 'px';
            edgeBox.innerHTML = `Safe Zone L/R/T:${marginSides}px B:${marginBottom}px`;
        }
    };
}
