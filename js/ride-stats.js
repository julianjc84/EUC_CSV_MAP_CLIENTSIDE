/**
 * Ride Statistics Module
 *
 * Single source of truth for all ride data statistical calculations.
 * Eliminates duplicate calculations across overview stats, map markers, and charts.
 *
 * @module ride-stats
 */

// Module loaded

/**
 * Calculate comprehensive statistics for a single metric/data array
 *
 * @param {Array} dataArray - Array of numeric values (may contain nulls/NaN)
 * @param {Object} options - Configuration options
 * @param {boolean} options.skipZeros - Filter out zero values (for distance/odometer)
 * @param {number} options.maxValue - Filter out values above this (for PWM filtering)
 * @param {boolean} options.findMin - Calculate minimum instead of maximum
 * @returns {Object} Comprehensive stats: {value, index, min, max, avg, count, minIndex, maxIndex}
 */
export function calculateMetricStats(dataArray, options = {}) {
    const {
        skipZeros = false,
        maxValue = Infinity,
        findMin = false
    } = options;

    if (!dataArray || dataArray.length === 0) {
        return {
            value: null,
            index: null,
            min: null,
            max: null,
            avg: null,
            count: 0,
            minIndex: null,
            maxIndex: null
        };
    }

    // Filter valid values
    let validData = [];
    let validIndices = [];

    for (let i = 0; i < dataArray.length; i++) {
        const val = dataArray[i];
        if (val !== null && val !== undefined && !isNaN(val)) {
            // Apply filters
            if (skipZeros && val === 0) continue;
            if (val > maxValue) continue;

            validData.push(val);
            validIndices.push(i);
        }
    }

    if (validData.length === 0) {
        return {
            value: null,
            index: null,
            min: null,
            max: null,
            avg: null,
            count: 0,
            minIndex: null,
            maxIndex: null
        };
    }

    // Calculate min, max, avg in single pass
    let min = validData[0];
    let max = validData[0];
    let sum = validData[0];
    let minIndex = validIndices[0];
    let maxIndex = validIndices[0];

    for (let i = 1; i < validData.length; i++) {
        const val = validData[i];
        sum += val;

        if (val < min) {
            min = val;
            minIndex = validIndices[i];
        }
        if (val > max) {
            max = val;
            maxIndex = validIndices[i];
        }
    }

    const avg = sum / validData.length;

    // Primary value and index based on findMin option
    const value = findMin ? min : max;
    const index = findMin ? minIndex : maxIndex;

    return {
        value,      // Primary value (max or min depending on options)
        index,      // Index of primary value in original array
        min,        // Minimum value
        max,        // Maximum value
        avg,        // Average value
        count: validData.length,  // Count of valid values
        minIndex,   // Index of minimum value
        maxIndex    // Index of maximum value
    };
}

/**
 * Find all indices where a condition is true
 * Used for finding all zero safety points (PWM = 0 or 100)
 *
 * @param {Array} dataArray - Array to search
 * @param {Function} condition - Function that returns true for matching values
 * @returns {Array} Array of indices where condition is true
 */
export function findAllIndices(dataArray, condition) {
    const indices = [];

    if (!dataArray || dataArray.length === 0) {
        return indices;
    }

    for (let i = 0; i < dataArray.length; i++) {
        const val = dataArray[i];
        if (val !== null && val !== undefined && !isNaN(val)) {
            if (condition(val)) {
                indices.push(i);
            }
        }
    }

    return indices;
}

/**
 * Calculate first and last non-zero values (for distance/odometer)
 *
 * @param {Array} dataArray - Array of distance/odometer values
 * @returns {Object} {start, end, startIndex, endIndex}
 */
export function calculateDistanceRange(dataArray) {
    if (!dataArray || dataArray.length === 0) {
        return { start: null, end: null, startIndex: null, endIndex: null };
    }

    // Find first non-zero value
    let start = null;
    let startIndex = null;
    for (let i = 0; i < dataArray.length; i++) {
        const val = dataArray[i];
        if (val !== null && val !== undefined && !isNaN(val) && val > 0) {
            start = val;
            startIndex = i;
            break;
        }
    }

    // Find last non-zero value
    let end = null;
    let endIndex = null;
    for (let i = dataArray.length - 1; i >= 0; i--) {
        const val = dataArray[i];
        if (val !== null && val !== undefined && !isNaN(val) && val > 0) {
            end = val;
            endIndex = i;
            break;
        }
    }

    return { start, end, startIndex, endIndex };
}

/**
 * Main entry point: Calculate all ride statistics
 *
 * @param {Object} fullData - Full ride data object with timestamps and series
 * @param {Object} options - Configuration options
 * @param {number} options.detectedMode - Auto-detected PWM mode (1 or 2)
 * @param {boolean} options.flipPWM - Whether transformation is applied
 * @returns {Object} Complete statistics object with all calculated metrics
 */
export function calculateRideStats(fullData, options = {}) {
    const { detectedMode = 1, flipPWM = false } = options;
    const { series } = fullData;

    // Calculate current mode after transformation
    const currentMode = (detectedMode === 1 && !flipPWM) || (detectedMode === 2 && flipPWM) ? 1 : 2;

    // Calculating comprehensive ride statistics
    const stats = {};

    // Speed (Wheel)
    if (series.speed) {
        stats.speed = {
            max: calculateMetricStats(series.speed, { findMin: false }),
            avg: calculateMetricStats(series.speed, { findMin: false }).avg
        };
    }

    // Speed (GPS)
    if (series.gps_speed) {
        stats.speedGPS = {
            max: calculateMetricStats(series.gps_speed, { findMin: false }),
            avg: calculateMetricStats(series.gps_speed, { findMin: false }).avg
        };
    }

    // Power
    if (series.power) {
        stats.power = {
            max: calculateMetricStats(series.power, { findMin: false }),
            avg: calculateMetricStats(series.power, { findMin: false }).avg
        };
    }

    // Current
    if (series.current) {
        stats.current = {
            max: calculateMetricStats(series.current, { findMin: false }),
            avg: calculateMetricStats(series.current, { findMin: false }).avg
        };
    }

    // Battery
    if (series.battery || series.battery_level) {
        const batteryData = series.battery || series.battery_level;
        stats.battery = {
            min: calculateMetricStats(batteryData, { findMin: true })
        };
    }

    // PWM (mode-aware with >100% filtering)
    if (series.pwm) {
        // PWM Mode Logic (after transformation):
        // - Mode 1: 0% safe → 100% unsafe (skull at 100%)
        // - Mode 2: 100% safe → 0% unsafe (skull at 0%)

        const isMode2 = currentMode === 2;
        const pwmFiltered = calculateMetricStats(series.pwm, { findMin: isMode2, maxValue: 100 });
        const pwmUnfiltered = calculateMetricStats(series.pwm, { findMin: isMode2 });
        const filteredCount = pwmUnfiltered.count - pwmFiltered.count;

        stats.pwm = {
            value: pwmFiltered.value,
            index: pwmFiltered.index,
            label: isMode2 ? '⚡ Min PWM' : '⚡ Max PWM',
            filteredInvalidCount: filteredCount
        };

        // Find all zero safety points (PWM at extreme danger value)
        // Mode 1: Danger at 100%
        // Mode 2: Danger at 0%
        const dangerThreshold = isMode2 ? 0 : 100;
        const zeroCondition = isMode2 ? (val => val === 0) : (val => val === 100);
        stats.pwmZeroIndices = findAllIndices(series.pwm, zeroCondition);
    }

    // Energy Consumption (Wh/km)
    if (series.energy_consumption) {
        stats.energyConsumption = {
            max: calculateMetricStats(series.energy_consumption, { findMin: false }),
            avg: calculateMetricStats(series.energy_consumption, { findMin: false }).avg
        };
    }

    // Voltage
    if (series.voltage) {
        stats.voltage = {
            min: calculateMetricStats(series.voltage, { findMin: true })
        };
    }

    // Controller Temperature
    if (series.temp || series.system_temp) {
        const tempData = series.temp || series.system_temp;
        stats.tempController = {
            max: calculateMetricStats(tempData, { findMin: false })
        };
    }

    // Motor Temperature
    if (series.temp_motor || series.temp2) {
        const tempData = series.temp_motor || series.temp2;
        stats.tempMotor = {
            max: calculateMetricStats(tempData, { findMin: false })
        };
    }

    // Battery Temperature
    if (series.temp_batt) {
        stats.tempBattery = {
            max: calculateMetricStats(series.temp_batt, { findMin: false })
        };
    }

    // Tilt
    if (series.tilt) {
        const tiltStats = calculateMetricStats(series.tilt, { findMin: false });
        stats.tilt = {
            max: { value: tiltStats.max, index: tiltStats.maxIndex },
            min: { value: tiltStats.min, index: tiltStats.minIndex }
        };
    }

    // Roll
    if (series.roll) {
        const rollStats = calculateMetricStats(series.roll, { findMin: false });
        stats.roll = {
            max: { value: rollStats.max, index: rollStats.maxIndex },
            min: { value: rollStats.min, index: rollStats.minIndex }
        };
    }

    // Elevation (GPS Altitude)
    if (series.gps_alt) {
        const elevStats = calculateMetricStats(series.gps_alt, { findMin: false });
        stats.elevation = {
            max: { value: elevStats.max, index: elevStats.maxIndex },
            min: { value: elevStats.min, index: elevStats.minIndex }
        };
    }

    // Acceleration (min/max range)
    if (series.acceleration) {
        const accelStats = calculateMetricStats(series.acceleration);
        stats.acceleration = {
            max: { value: accelStats.max, index: accelStats.maxIndex },
            min: { value: accelStats.min, index: accelStats.minIndex }
        };
    }

    // Corrected Voltage (start/end like odometer pattern)
    if (series.battery_corrected_voltage) {
        const cvData = series.battery_corrected_voltage;
        let start = null, end = null;
        for (let i = 0; i < cvData.length; i++) {
            if (cvData[i] !== null && !isNaN(cvData[i])) { start = cvData[i]; break; }
        }
        for (let i = cvData.length - 1; i >= 0; i--) {
            if (cvData[i] !== null && !isNaN(cvData[i])) { end = cvData[i]; break; }
        }
        stats.correctedVoltage = {
            start,
            end,
            drop: (start !== null && end !== null) ? start - end : null
        };
    }

    // CPU Load (average only)
    if (series.cpu_load) {
        stats.cpuLoad = { avg: calculateMetricStats(series.cpu_load).avg };
    }

    // Fan (max — 0 means OFF, >0 means ON at some point)
    if (series.fan) {
        stats.fan = { max: calculateMetricStats(series.fan).max };
    }

    // Distance (Wheel) - skip zeros for sensor initialization
    if (series.distance || series.distance_total) {
        const distanceData = series.distance || series.distance_total;
        const distRange = calculateDistanceRange(distanceData);
        stats.distance = {
            start: distRange.start,
            end: distRange.end,
            startIndex: distRange.startIndex,
            endIndex: distRange.endIndex,
            trip: distRange.end && distRange.start ? distRange.end - distRange.start : null
        };
    }

    // Odometer (distance_total) - skip zeros
    if (series.distance_total) {
        const odometerRange = calculateDistanceRange(series.distance_total);
        stats.odometer = {
            start: odometerRange.start,
            end: odometerRange.end,
            startIndex: odometerRange.startIndex,
            endIndex: odometerRange.endIndex
        };
    }

    // GPS Distance - skip zeros
    if (series.gps_distance) {
        const gpsDistRange = calculateDistanceRange(series.gps_distance);
        stats.gpsDistance = {
            start: gpsDistRange.start,
            end: gpsDistRange.end,
            startIndex: gpsDistRange.startIndex,
            endIndex: gpsDistRange.endIndex,
            trip: gpsDistRange.end && gpsDistRange.start ? gpsDistRange.end - gpsDistRange.start : null
        };
    }

    return stats;
}
