/**
 * Overview Statistics Module
 *
 * Calculates overview stats for display in the overview panel.
 * Extracted from app.js to reduce file size and eliminate repetition.
 *
 * @module overview-stats
 */

import { calculateRideStats } from './ride-stats.js';
import { formatDuration } from './format-utils.js';

// --- Helpers ---

/**
 * Format a single stat from a rideStats value.
 * Handles the null/undefined → N/A pattern that repeats for every stat.
 *
 * @param {string} label - Display label with emoji
 * @param {number|null|undefined} value - Raw numeric value
 * @param {string} unit - Unit suffix (e.g. '°C', ' km/h', '%')
 * @param {string} group - Stat group for column categorization
 * @param {Object} [opts] - Options
 * @param {number} [opts.decimals=1] - Decimal places for toFixed
 * @param {boolean} [opts.elevationStyle=false] - If true, never mark as isZeroOrNA when value exists
 * @returns {Object} Stat object { label, value, group, isZeroOrNA }
 */
function formatStat(label, value, unit, group, opts = {}) {
    const { decimals = 1, elevationStyle = false } = opts;
    if (value === null || value === undefined) {
        return { label, value: 'N/A', group, isZeroOrNA: true };
    }
    const formatted = `${value.toFixed(decimals)}${unit}`;
    return {
        label,
        value: formatted,
        group,
        isZeroOrNA: elevationStyle ? false : (value === 0)
    };
}

/**
 * Format a min/max/diff triplet (used for tilt, roll, elevation).
 *
 * @param {string} maxEmoji - Emoji for max stat
 * @param {string} minEmoji - Emoji for min stat
 * @param {string} diffEmoji - Emoji for diff stat
 * @param {string} name - Metric name (e.g. 'Tilt', 'Roll', 'Elevation')
 * @param {string} unit - Unit suffix
 * @param {string} group - Stat group
 * @param {Object|null|undefined} metricStats - rideStats entry with .max.value and .min.value
 * @param {Object} [opts] - Options passed to formatStat
 * @returns {Array} Array of 3 stat objects
 */
function formatMinMaxDiff(maxEmoji, minEmoji, diffEmoji, name, unit, group, metricStats, opts = {}) {
    const maxVal = metricStats?.max?.value;
    const minVal = metricStats?.min?.value;
    const { elevationStyle = false, prefixName = false } = opts;

    // Labels: "Max Tilt" (prefixName=false) vs "Elevation Max" (prefixName=true)
    const maxLabel = prefixName ? `${maxEmoji} ${name} Max` : `${maxEmoji} Max ${name}`;
    const minLabel = prefixName ? `${minEmoji} ${name} Min` : `${minEmoji} Min ${name}`;
    const diffLabel = `${diffEmoji} ${name} Diff`;

    if (maxVal !== null && maxVal !== undefined && minVal !== null && minVal !== undefined) {
        const diff = maxVal - minVal;
        return [
            { label: maxLabel, value: `${maxVal.toFixed(1)}${unit}`, group, isZeroOrNA: elevationStyle ? false : (maxVal === 0) },
            { label: minLabel, value: `${minVal.toFixed(1)}${unit}`, group, isZeroOrNA: elevationStyle ? false : (minVal === 0) },
            { label: diffLabel, value: diff === 0 ? `0.0${unit}` : `${diff.toFixed(1)}${unit}`, group, isZeroOrNA: diff === 0 }
        ];
    }

    return [
        { label: maxLabel, value: 'N/A', group, isZeroOrNA: true },
        { label: minLabel, value: 'N/A', group, isZeroOrNA: true },
        { label: diffLabel, value: 'N/A', group, isZeroOrNA: true }
    ];
}

/**
 * Format an offset stat (GPS - Wheel comparison).
 *
 * @param {string} label - Display label
 * @param {number|null} baseValue - Baseline value (wheel)
 * @param {number|null} compareValue - Comparison value (GPS)
 * @param {string} unit - Unit suffix
 * @param {string} group - Stat group
 * @param {number} [decimals=1] - Decimal places
 * @returns {Object} Stat object
 */
function formatOffset(label, baseValue, compareValue, unit, group, decimals = 1) {
    if (baseValue && compareValue) {
        const offset = compareValue - baseValue;
        const offsetPct = (offset / baseValue) * 100;
        const sign = offset >= 0 ? '+' : '';
        return {
            label,
            value: `${sign}${offset.toFixed(decimals)} ${unit} (${sign}${offsetPct.toFixed(1)}%)`,
            group,
            isZeroOrNA: offset === 0
        };
    }
    return { label, value: 'N/A', group, isZeroOrNA: true };
}

// --- Main function ---

/**
 * Calculate overview statistics from processed ride data.
 *
 * @param {Object} data - Processed data with timestamps, series, metadata
 * @param {Object} processorConfig - Processor configuration
 * @param {number} processorConfig.detectedMode - PWM mode (1 or 2)
 * @param {boolean} processorConfig.flipPWM - Whether PWM is flipped
 * @returns {Array} Array of stat objects { label, value, group, isZeroOrNA }
 */
export function calculateOverviewStats(data, { detectedMode, flipPWM }) {
    const stats = [];
    const series = data.series;
    const timestamps = data.timestamps;
    const metadata = data.metadata || {};

    // Calculate all ride statistics once (single source of truth)
    // Cache on data object so convertGPSRouteData() can reuse without recalculating
    const rideStats = calculateRideStats(data, { detectedMode, flipPWM });
    data.rideStats = rideStats;

    // GROUP 1: Date & Time Info
    if (timestamps && timestamps.length > 0) {
        const firstDate = new Date(timestamps[0]);
        stats.push({
            label: '📅 Date',
            value: firstDate.toISOString().split('T')[0],
            group: 'datetime'
        });

        stats.push({
            label: '🕐 Start Time',
            value: firstDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true }),
            group: 'datetime'
        });

        const lastDate = new Date(timestamps[timestamps.length - 1]);
        stats.push({
            label: '🕐 End Time',
            value: lastDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true }),
            group: 'datetime'
        });

        if (timestamps.length > 1) {
            const journeySeconds = (timestamps[timestamps.length - 1] - timestamps[0]) / 1000;
            stats.push({
                label: '⏰ Journey Time',
                value: formatDuration(journeySeconds),
                group: 'datetime'
            });
        }
    }

    // Ride Time (time while moving, speed > 0)
    if (series.speed && timestamps && timestamps.length > 1) {
        const validSpeed = series.speed.filter(v => v !== null && !isNaN(v) && v > 0);
        const totalSeconds = (timestamps[timestamps.length - 1] - timestamps[0]) / 1000;
        const timePerPoint = totalSeconds / (timestamps.length - 1);
        const rideSeconds = validSpeed.length * timePerPoint;
        stats.push({
            label: '⏳ Ride Time',
            value: formatDuration(rideSeconds),
            group: 'datetime'
        });
    }

    // Device Info
    stats.push({ label: '🎖️ Make', value: metadata.make || 'N/A', group: 'device', isZeroOrNA: !metadata.make });
    stats.push({ label: '🛞 Model', value: metadata.model || 'N/A', group: 'device', isZeroOrNA: !metadata.model });

    // Odometer
    if (rideStats.odometer) {
        const fmtOdo = (v) => v ? `${v.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} km` : 'N/A';
        stats.push({ label: '🏁 Odometer Start', value: fmtOdo(rideStats.odometer.start), group: 'device', isZeroOrNA: !rideStats.odometer.start });
        stats.push({ label: '🏁 Odometer End', value: fmtOdo(rideStats.odometer.end), group: 'device', isZeroOrNA: !rideStats.odometer.end });
    } else {
        stats.push({ label: '🏁 Odometer Start', value: 'N/A', group: 'device', isZeroOrNA: true });
        stats.push({ label: '🏁 Odometer End', value: 'N/A', group: 'device', isZeroOrNA: true });
    }

    // GROUP 2: Speed & Distance
    const maxSpeedWheel = rideStats.speed?.max?.value;
    const maxSpeedGPS = rideStats.speedGPS?.max?.value;
    stats.push(formatStat('🚀 Max Speed (Wheel)', maxSpeedWheel, ' km/h', 'speed'));
    stats.push(formatStat('📡 Max Speed (GPS)', maxSpeedGPS, ' km/h', 'speed'));
    stats.push(formatOffset('📊 Max Speed [offset]', maxSpeedWheel, maxSpeedGPS, 'km/h', 'speed'));
    stats.push(formatStat('⚡ Avg Speed (Wheel)', rideStats.speed?.avg, ' km/h', 'speed'));
    stats.push(formatStat('⚡ Avg Speed (GPS)', rideStats.speedGPS?.avg, ' km/h', 'speed'));

    const distanceWheel = rideStats.distance?.trip;
    const distanceGPS = rideStats.gpsDistance?.trip;
    stats.push(formatStat('🛣️ Distance (Wheel)', distanceWheel, ' km', 'distance', { decimals: 2 }));
    stats.push(formatStat('🛣️ Distance (GPS)', distanceGPS, ' km', 'distance', { decimals: 2 }));
    stats.push(formatOffset('📊 Distance [offset]', distanceWheel, distanceGPS, 'km', 'distance', 2));

    // GROUP 3: Power & Electrical
    stats.push(formatStat('⚡ Max Power', rideStats.power?.max?.value, ' W', 'power', { decimals: 0 }));
    stats.push(formatStat('⚡ Avg Power', rideStats.power?.avg, ' W', 'power', { decimals: 0 }));
    stats.push(formatStat('🔋 Max Current', rideStats.current?.max?.value, ' A', 'electrical'));
    stats.push(formatStat('🔋 Avg Current', rideStats.current?.avg, ' A', 'electrical'));
    stats.push(formatStat('🔋 Battery Min', rideStats.battery?.min?.value, '%', 'electrical'));

    // PWM (special — uses label from rideStats, has isNegative flag)
    if (rideStats.pwm) {
        const pwmValue = rideStats.pwm.value;
        stats.push({
            label: rideStats.pwm.label,
            value: pwmValue !== null ? `${pwmValue.toFixed(1)}%` : 'N/A',
            group: 'electrical',
            isZeroOrNA: pwmValue === null || pwmValue === 0,
            isNegative: pwmValue !== null && pwmValue < 0
        });
    } else {
        stats.push({ label: '⚡ PWM', value: 'N/A', group: 'electrical', isZeroOrNA: true });
    }

    stats.push(formatStat('⚡ Max Wh/km', rideStats.energyConsumption?.max?.value, ' Wh/km', 'electrical'));
    stats.push(formatStat('⚡ Avg Wh/km', rideStats.energyConsumption?.avg, ' Wh/km', 'electrical'));
    stats.push(formatStat('⚡ Voltage Min', rideStats.voltage?.min?.value, ' V', 'electrical'));

    // GROUP 4: Temperature
    stats.push(formatStat('🌡️ Controller Temp Max', rideStats.tempController?.max?.value, '°C', 'temperature'));
    stats.push(formatStat('🌡️ Motor Temp Max', rideStats.tempMotor?.max?.value, '°C', 'temperature'));
    stats.push(formatStat('🌡️ Battery Temp Max', rideStats.tempBattery?.max?.value, '°C', 'temperature'));

    // GROUP 5: Tilt, Roll, Elevation
    stats.push(...formatMinMaxDiff('↗️', '↙️', '🔄', 'Tilt', '°', 'orientation', rideStats.tilt));
    stats.push(...formatMinMaxDiff('↗️', '↙️', '🔄', 'Roll', '°', 'orientation', rideStats.roll));
    stats.push(...formatMinMaxDiff('⛰️', '⛰️', '📏', 'Elevation', ' m', 'elevation', rideStats.elevation, { elevationStyle: true, prefixName: true }));

    // GROUP 6: System & Diagnostics
    stats.push(formatStat('📈 Max Acceleration', rideStats.acceleration?.max?.value, ' m/s²', 'system'));
    stats.push(formatStat('📉 Min Acceleration', rideStats.acceleration?.min?.value, ' m/s²', 'system'));
    stats.push(formatStat('🔋 Corrected V Start', rideStats.correctedVoltage?.start, ' V', 'system', { decimals: 2 }));
    stats.push(formatStat('🔋 Corrected V End', rideStats.correctedVoltage?.end, ' V', 'system', { decimals: 2 }));
    stats.push(formatStat('🔋 Corrected V Drop', rideStats.correctedVoltage?.drop, ' V', 'system', { decimals: 2 }));
    stats.push({
        label: '🚦 Speed Limit',
        value: metadata.speedLimit != null ? `${metadata.speedLimit} km/h` : 'N/A',
        group: 'system',
        isZeroOrNA: metadata.speedLimit == null
    });
    stats.push({
        label: '💻 CPU Load Avg',
        value: rideStats.cpuLoad?.avg != null ? `${rideStats.cpuLoad.avg.toFixed(0)}%` : 'N/A',
        group: 'system',
        isZeroOrNA: rideStats.cpuLoad?.avg == null
    });
    stats.push({
        label: '🌀 Fan',
        value: rideStats.fan != null ? (rideStats.fan.max > 0 ? 'ON' : 'OFF') : 'N/A',
        group: 'system',
        isZeroOrNA: rideStats.fan == null
    });

    // Add hasChart flag — stats whose underlying data appears in a chart
    const chartedGroups = new Set(['speed', 'power', 'electrical', 'temperature', 'elevation']);
    for (const stat of stats) {
        stat.hasChart = chartedGroups.has(stat.group);
    }

    return stats;
}

/**
 * Format an extra field key for display in the EUC World Details column.
 * Strips 'euc.' / 'info.' prefix and converts camelCase to Title Case.
 *
 * @param {string} key - Raw key from extra fields (e.g. 'euc.deviceName')
 * @returns {string} Formatted display name (e.g. 'Device Name')
 */
export function formatExtraKey(key) {
    const stripped = key.replace(/^(euc|info)\./, '');
    return stripped
        .replace(/([A-Z])/g, ' $1')
        .replace(/([0-9]+)/g, ' $1')
        .replace(/^./, c => c.toUpperCase())
        .trim();
}
