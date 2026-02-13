/**
 * Base Processor Class
 * Abstract base class for all CSV processors
 * Ported from Python processors/base_processor.py
 */

export class BaseProcessor {
    constructor() {
        this.detectedMode = 1; // Auto-detected PWM mode (1 or 2)
        this.flipPWM = false;  // User-controlled transformation toggle
        this.numericColumns = [];
    }

    /**
     * Process CSV data and return standardized format
     * @param {Array} parsedData - Papa Parse result data
     * @param {string} filename - Original filename
     * @returns {Object} Processed data with charts and metadata
     */
    processCSV(parsedData, filename) {
        throw new Error('processCSV() must be implemented by subclass');
    }

    /**
     * Get processor format name
     * @returns {string} Format name
     */
    getFormatName() {
        throw new Error('getFormatName() must be implemented by subclass');
    }

    /**
     * Get supported features list
     * @returns {Array<string>} Feature names
     */
    getSupportedFeatures() {
        return [];
    }

    /**
     * Set PWM flip mode
     * @param {boolean} flip - Whether to flip PWM values
     */
    setPWMFlip(flip) {
        this.flipPWM = flip;
        console.log(`[${this.getFormatName()}] PWM flip: ${flip ? 'ENABLED' : 'DISABLED'}`);
    }

    /**
     * Auto-detect PWM orientation mode by analyzing first 10 valid values
     *
     * Logic:
     * - If first 10 values average < 50 → Mode 1: 0% safe, 100% unsafe (skull at 100%)
     * - If first 10 values average >= 50 → Mode 2: 100% safe, 0% unsafe (skull at 0%)
     *
     * Sets this.detectedMode (1 or 2) but does NOT apply transformation
     *
     * @param {Array<number|null>} pwmData - PWM data array
     */
    detectPWMMode(pwmData) {
        if (!pwmData || pwmData.length === 0) {
            this.detectedMode = 1;
            console.log(`[${this.getFormatName()}] No PWM data for mode detection, defaulting to Mode 1`);
            return;
        }

        // Collect first 10 valid (non-null, non-NaN) values
        const validValues = [];
        for (let i = 0; i < pwmData.length && validValues.length < 10; i++) {
            const val = pwmData[i];
            if (val !== null && val !== undefined && !isNaN(val)) {
                validValues.push(val);
            }
        }

        if (validValues.length === 0) {
            this.detectedMode = 1;
            console.log(`[${this.getFormatName()}] No valid PWM values found, defaulting to Mode 1`);
            return;
        }

        // Calculate average of first valid values
        const sum = validValues.reduce((a, b) => a + b, 0);
        const avg = sum / validValues.length;

        // Determine mode based on average
        // Low values (avg < 50) → Mode 1: 0% safe, 100% unsafe
        // High values (avg >= 50) → Mode 2: 100% safe, 0% unsafe
        this.detectedMode = avg >= 50 ? 2 : 1;

        const modeLabel = this.detectedMode === 2 ? 'Mode 2: 100% safe, 0% unsafe (skull at 0%)' : 'Mode 1: 0% safe, 100% unsafe (skull at 100%)';
        console.log(`[${this.getFormatName()}] PWM Mode Auto-Detection:`);
        console.log(`[${this.getFormatName()}]   - First ${validValues.length} values: [${validValues.slice(0, 5).map(v => v.toFixed(1)).join(', ')}${validValues.length > 5 ? '...' : ''}]`);
        console.log(`[${this.getFormatName()}]   - Average: ${avg.toFixed(1)}%`);
        console.log(`[${this.getFormatName()}]   - Detected: ${modeLabel}`);
    }

    /**
     * Get column mapping describing which CSV columns this processor handles.
     * Subclasses override to return their specific mappings.
     * @returns {Object} Map of CSV column name → { type, description, ... }
     */
    getColumnMapping() {
        return {};
    }

    /**
     * Clean numeric array - convert to numbers, handle invalid values
     * @param {Array} data - Raw array data
     * @param {string} columnName - Column name for the data
     * @returns {Array<number|null>} Cleaned array with null for invalid values
     */
    cleanNumericArray(data, columnName) {
        return data.map(value => {
            if (value === null || value === undefined || value === '') {
                return null;
            }
            const num = parseFloat(value);
            return isNaN(num) ? null : num;
        });
    }

    /**
     * Parse datetime from string
     * @param {string} dateStr - Date string
     * @param {string} timeStr - Time string (optional, can be combined with dateStr)
     * @returns {Date} Parsed date object
     */
    parseDateTime(dateStr, timeStr = null) {
        if (timeStr) {
            // Combine date and time
            const combined = `${dateStr} ${timeStr}`;
            return new Date(combined);
        }
        return new Date(dateStr);
    }

    /**
     * Convert Date object to Unix timestamp (milliseconds)
     * @param {Date} date - Date object
     * @returns {number} Unix timestamp in milliseconds
     */
    toTimestamp(date) {
        return date.getTime();
    }

    /**
     * Extract timestamps array from parsed data
     * @param {Array} parsedData - Parsed CSV data
     * @param {string} dateColumn - Date column name
     * @param {string} timeColumn - Time column name (optional)
     * @returns {Array<number>} Array of timestamps
     */
    extractTimestamps(parsedData, dateColumn, timeColumn = null) {
        return parsedData.map(row => {
            const date = this.parseDateTime(row[dateColumn], timeColumn ? row[timeColumn] : null);
            return this.toTimestamp(date);
        });
    }

    /**
     * Extract numeric series from parsed data
     * @param {Array} parsedData - Parsed CSV data
     * @param {string} columnName - Column name
     * @returns {Array<number|null>} Numeric array
     */
    extractSeries(parsedData, columnName) {
        const rawData = parsedData.map(row => row[columnName]);
        return this.cleanNumericArray(rawData, columnName);
    }

    /**
     * Calculate statistics for a numeric array
     * @param {Array<number|null>} data - Numeric data array
     * @returns {Object} Stats object with min, max, mean
     */
    calculateStats(data) {
        const validData = data.filter(v => v !== null && !isNaN(v));

        if (validData.length === 0) {
            return { min: 0, max: 0, mean: 0, count: 0 };
        }

        const min = Math.min(...validData);
        const max = Math.max(...validData);
        const sum = validData.reduce((a, b) => a + b, 0);
        const mean = sum / validData.length;

        return { min, max, mean, count: validData.length };
    }

    /**
     * Process raw PWM data: auto-detect mode and apply flip if enabled.
     * Consolidates the detect+flip pattern used by all three processors.
     * @param {Array<number|null>|null} rawPWM - Raw PWM data array
     * @returns {Array<number|null>|null} Processed PWM data (flipped if this.flipPWM is true)
     */
    processPWM(rawPWM) {
        if (!rawPWM) return null;

        this.detectPWMMode(rawPWM);

        if (this.flipPWM) {
            const flipped = rawPWM.map(v => v !== null ? 100 - v : null);
            console.log(`[${this.getFormatName()}] Applied PWM flip transformation (100 - value)`);
            return flipped;
        }

        return rawPWM;
    }

    /**
     * Convert distance from meters to kilometers if needed
     * @param {Array<number|null>} distanceData - Distance array
     * @param {string} columnName - Column name for logging
     * @returns {Array<number|null>} Distance in kilometers
     */
    convertDistanceIfNeeded(distanceData, columnName) {
        const validData = distanceData.filter(v => v !== null && !isNaN(v));

        if (validData.length === 0) {
            return distanceData;
        }

        const maxVal = Math.max(...validData);
        const medianVal = validData[Math.floor(validData.length / 2)];

        // Check if this is an odometer/total distance column (cumulative values)
        const isOdometerColumn = columnName.toLowerCase().includes('total') ||
                                  columnName.toLowerCase().includes('mileage') ||
                                  columnName.toLowerCase().includes('odometer');

        // Heuristic for odometer: if max > 500, likely already in km (odometers can be 1000+ km)
        // Heuristic for trip distance: if max > 1000 or median > 100, likely in meters
        if (isOdometerColumn) {
            // Odometer columns are usually already in km
            // Only convert if values are very large (>500,000 would be 500,000 km which is unrealistic)
            if (maxVal > 500000) {
                console.log(`[${this.getFormatName()}] Converting '${columnName}' from meters to km (max: ${maxVal.toFixed(1)}m)`);
                return distanceData.map(v => v !== null ? v / 1000.0 : null);
            } else {
                console.log(`[${this.getFormatName()}] '${columnName}' appears to be in km already (max: ${maxVal.toFixed(1)}km)`);
                return distanceData;
            }
        } else {
            // Trip distance: use original heuristic
            if (maxVal > 1000 || medianVal > 100) {
                console.log(`[${this.getFormatName()}] Converting '${columnName}' from meters to km (max: ${maxVal.toFixed(1)}m)`);
                return distanceData.map(v => v !== null ? v / 1000.0 : null);
            } else {
                console.log(`[${this.getFormatName()}] '${columnName}' appears to be in km already (max: ${maxVal.toFixed(1)}km)`);
                return distanceData;
            }
        }
    }

    /**
     * Extract GPS route data
     * @param {Array} parsedData - Parsed CSV data
     * @returns {Object} GPS route object
     */
    extractGPSRoute(parsedData) {
        const latData = this.extractSeries(parsedData, 'gps_lat') || this.extractSeries(parsedData, 'latitude');
        const lonData = this.extractSeries(parsedData, 'gps_lon') || this.extractSeries(parsedData, 'longitude');

        if (!latData || !lonData) {
            return { has_gps: false, coordinates: [], originalIndices: [] };
        }

        // Filter valid coordinates and track original row indices
        const coordinates = [];
        const originalIndices = [];  // Track which CSV row each coordinate came from

        for (let i = 0; i < Math.min(latData.length, lonData.length); i++) {
            const lat = latData[i];
            const lon = lonData[i];

            if (lat !== null && lon !== null && !isNaN(lat) && !isNaN(lon)) {
                // Validate reasonable GPS coordinates
                if (lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180) {
                    coordinates.push([lat, lon]);
                    originalIndices.push(i);  // Store original CSV row index
                }
            }
        }

        console.log(`[${this.getFormatName()}] GPS route: ${coordinates.length} valid points from ${latData.length} total rows`);

        return {
            has_gps: coordinates.length > 0,
            coordinates: coordinates,
            originalIndices: originalIndices,  // NEW: Maps coords[i] → original CSV row index
            total_points: coordinates.length
        };
    }

    /**
     * Calculate energy consumption (Wh/km) from current, voltage, and speed
     * Formula: Wh/km = (Current × Voltage) / Speed
     * Only calculates for speeds >= 5.0 km/h to avoid division by small numbers
     * @param {Object} series - Series data object containing current, voltage, and speed arrays
     * @returns {Array<number|null>} Energy consumption array in Wh/km, or null if required data missing
     */
    calculateEnergyConsumption(series) {
        // Check for required fields
        if (!series.current || !series.voltage || !series.speed) {
            console.log(`[${this.getFormatName()}] Cannot calculate energy_consumption: missing current, voltage, or speed`);
            return null;
        }

        console.log(`[${this.getFormatName()}] Calculating energy_consumption (Wh/km)...`);

        const energyConsumption = [];
        let validCount = 0;
        let sumEnergy = 0;
        let minEnergy = Infinity;
        let maxEnergy = -Infinity;

        for (let i = 0; i < series.current.length; i++) {
            const current = series.current[i];
            const voltage = series.voltage[i];
            const speed = series.speed[i];

            // Check for valid data and minimum speed (>= 5.0 km/h to avoid division by small numbers)
            if (current !== null && voltage !== null && speed !== null && speed >= 5.0) {
                // Calculate power (watts)
                const power = current * voltage;

                // Calculate Wh/km
                let whPerKm = power / speed;

                // Apply sanity limits (-300 to 300 Wh/km)
                // Negative values = regenerative braking (energy recovery)
                // Positive values = energy consumption
                if (whPerKm < -300) whPerKm = -300;  // Max regen limit
                if (whPerKm > 300) whPerKm = 300;    // Max consumption limit

                energyConsumption.push(whPerKm);

                // Track statistics
                validCount++;
                sumEnergy += whPerKm;
                if (whPerKm < minEnergy) minEnergy = whPerKm;
                if (whPerKm > maxEnergy) maxEnergy = whPerKm;
            } else {
                energyConsumption.push(null);
            }
        }

        if (validCount > 0) {
            const avgEnergy = sumEnergy / validCount;
            console.log(`[${this.getFormatName()}] ✓ Calculated energy_consumption: ${validCount} valid values, range=${minEnergy.toFixed(1)}-${maxEnergy.toFixed(1)} Wh/km, avg=${avgEnergy.toFixed(1)} Wh/km`);
        } else {
            console.log(`[${this.getFormatName()}] ✗ Warning: energy_consumption calculation produced no valid values`);
        }

        return energyConsumption;
    }
}

export default BaseProcessor;
