/**
 * Stat Metadata Module
 *
 * Provides tooltip content (formulas and descriptions) for all overview statistics.
 * Used to generate Bootstrap tooltips with technical explanations.
 *
 * @module stat-metadata
 */

/**
 * Metadata for all overview statistics
 * Each stat includes:
 * - formula: Technical notation showing calculation logic
 * - description: Clear explanation of what the stat represents
 * - unit: Display unit (optional)
 * - modeAware: True if stat calculation depends on PWM mode (optional)
 */
export const STAT_METADATA = {
    // ===== DATE & TIME INFO =====
    'Date': {
        formula: 'First timestamp date',
        description: 'Date when the ride was recorded, extracted from the CSV log file timestamp data'
    },

    'Start Time': {
        formula: 'First timestamp time',
        description: 'Time when the ride started, based on the first data point in the CSV log'
    },

    'End Time': {
        formula: 'Last timestamp time',
        description: 'Time when the ride ended, based on the last data point in the CSV log'
    },

    'Journey Time': {
        formula: 'last_timestamp - first_timestamp',
        description: 'Total elapsed time from start to end of the ride, including stationary periods'
    },

    'Ride Time': {
        formula: 'sum(Δt where speed > 0)',
        description: 'Actual riding time excluding stationary periods. Only counts time when the wheel is moving (speed > 0)',
        unit: 'time'
    },

    'Make': {
        formula: 'Detected from CSV format/content',
        description: 'EUC manufacturer detected from the CSV file format or metadata'
    },

    'Model': {
        formula: 'Detected from CSV format/content',
        description: 'EUC model detected from the CSV file format or metadata'
    },

    'Odometer Start': {
        formula: 'first(distance_total where distance_total > 0)',
        description: 'Total odometer reading at the start of the ride. Skips initial zero values from sensor initialization',
        unit: 'km'
    },

    'Odometer End': {
        formula: 'last(distance_total where distance_total > 0)',
        description: 'Total odometer reading at the end of the ride. Shows the lifetime mileage of the EUC',
        unit: 'km'
    },

    // ===== SPEED & DISTANCE =====
    'Max Speed (Wheel)': {
        formula: 'max(speed_kmh)',
        description: 'Maximum speed recorded by the wheel sensor during the ride. This is the wheel-reported speed, which may differ from GPS speed',
        unit: 'km/h'
    },

    'Max Speed (GPS)': {
        formula: 'max(gps_speed_kmh)',
        description: 'Maximum speed recorded by GPS during the ride. GPS speed is typically more accurate than wheel speed on rough terrain',
        unit: 'km/h'
    },

    'Max Speed [offset]': {
        formula: 'gps_max_speed - wheel_max_speed',
        description: 'Difference between GPS max speed and Wheel max speed. Wheel speed is the baseline. Negative = GPS reads lower than wheel. Large offsets indicate wheel slip or sensor calibration issues',
        unit: 'km/h'
    },

    'Avg Speed (Wheel)': {
        formula: 'avg(speed_kmh where speed_kmh > 0)',
        description: 'Average speed while moving, calculated from wheel sensor data. Excludes stationary periods (speed = 0)',
        unit: 'km/h'
    },

    'Avg Speed (GPS)': {
        formula: 'avg(gps_speed_kmh where gps_speed_kmh > 0)',
        description: 'Average speed while moving, calculated from GPS data. Excludes stationary periods',
        unit: 'km/h'
    },

    'Distance (Wheel)': {
        formula: 'last(distance) - first(distance where distance > 0)',
        description: 'Trip distance calculated from wheel sensor odometer. Skips initial zero values from sensor initialization',
        unit: 'km'
    },

    'Distance (GPS)': {
        formula: 'last(gps_distance) - first(gps_distance where gps_distance > 0)',
        description: 'Trip distance calculated from GPS coordinates. May differ from wheel distance due to GPS accuracy and wheel slip',
        unit: 'km'
    },

    'Distance [offset]': {
        formula: 'gps_distance - wheel_distance',
        description: 'Difference between GPS distance and Wheel distance. Wheel distance is the baseline. Negative = GPS reads shorter than wheel. Large offsets indicate wheel slip or GPS drift',
        unit: 'km'
    },

    // ===== POWER & ELECTRICAL =====
    'Max Power': {
        formula: 'max(power_watt)',
        description: 'Peak power consumption during the ride. High values indicate aggressive acceleration, hill climbing, or high-speed riding',
        unit: 'W'
    },

    'Avg Power': {
        formula: 'avg(power_watt)',
        description: 'Average power consumption throughout the ride. Indicates overall energy demand and riding style',
        unit: 'W'
    },

    'Max Current': {
        formula: 'max(current_amp)',
        description: 'Peak current draw from the battery. High current indicates heavy loads and affects battery longevity',
        unit: 'A'
    },

    'Avg Current': {
        formula: 'avg(current_amp)',
        description: 'Average current draw from the battery during the ride. Lower values indicate efficient riding',
        unit: 'A'
    },

    'Battery Min': {
        formula: 'min(battery_pct)',
        description: 'Lowest battery percentage reached during the ride. Important for range planning and battery health',
        unit: '%'
    },

    'PWM (Mode 1)': {
        formula: 'max(pwm_pct where pwm_pct ≤ 100)',
        description: 'Safety margin indicator for standard PWM mode. Maximum PWM value reached (higher = less safety margin). Values >100% are filtered as sensor errors. PWM = 100% means zero safety margin',
        unit: '%',
        modeAware: true
    },

    'PWM (Mode 2)': {
        formula: 'min(pwm_pct where pwm_pct ≤ 100)',
        description: 'Safety margin indicator for inverted PWM mode (EUC World). Minimum PWM value reached (lower = less safety margin). Values >100% are filtered as sensor errors. PWM = 0% means zero safety margin',
        unit: '%',
        modeAware: true
    },

    'Max Wh/km': {
        formula: 'max(energy_consumption_wh_per_km)',
        description: 'Peak energy consumption per kilometer. High values indicate steep hills, aggressive acceleration, or high-speed riding',
        unit: 'Wh/km'
    },

    'Avg Wh/km': {
        formula: 'avg(energy_consumption_wh_per_km)',
        description: 'Average energy consumption per kilometer. Lower values indicate efficient riding and good range. Typical values: 10-20 Wh/km for efficient riding, 20-40 Wh/km for aggressive riding',
        unit: 'Wh/km'
    },

    'Voltage Min': {
        formula: 'min(voltage_v)',
        description: 'Lowest battery voltage during the ride. Low voltage under load can indicate battery sag and affects performance',
        unit: 'V'
    },

    // ===== TEMPERATURE =====
    'Controller Temp Max': {
        formula: 'max(temp_controller_c)',
        description: 'Maximum controller/system temperature reached. High temps (>80°C) can trigger thermal throttling and reduce performance',
        unit: '°C'
    },

    'Motor Temp Max': {
        formula: 'max(temp_motor_c)',
        description: 'Maximum motor temperature reached. High temps (>90°C) indicate heavy loads and can affect motor efficiency',
        unit: '°C'
    },

    'Battery Temp Max': {
        formula: 'max(temp_battery_c)',
        description: 'Maximum battery temperature reached. High temps (>50°C) can reduce battery lifespan and performance',
        unit: '°C'
    },

    // ===== TILT & ROLL & ELEVATION =====
    'Max Tilt': {
        formula: 'max(tilt_deg)',
        description: 'Maximum forward/backward tilt angle. Positive values indicate forward lean (acceleration/climbing), negative values indicate backward lean (braking/descending)',
        unit: '°'
    },

    'Min Tilt': {
        formula: 'min(tilt_deg)',
        description: 'Minimum forward/backward tilt angle. Large negative values indicate aggressive braking or steep descents',
        unit: '°'
    },

    'Tilt Diff': {
        formula: 'max(tilt_deg) - min(tilt_deg)',
        description: 'Total range of tilt angles during the ride. Indicates how dynamic the riding was (acceleration/braking variations)',
        unit: '°'
    },

    'Max Roll': {
        formula: 'max(roll_deg)',
        description: 'Maximum left/right roll angle. Indicates how much the wheel tilted sideways during turns',
        unit: '°'
    },

    'Min Roll': {
        formula: 'min(roll_deg)',
        description: 'Minimum left/right roll angle. Large values indicate aggressive cornering',
        unit: '°'
    },

    'Roll Diff': {
        formula: 'max(roll_deg) - min(roll_deg)',
        description: 'Total range of roll angles during the ride. Indicates how dynamic the turning was',
        unit: '°'
    },

    'Elevation Max': {
        formula: 'max(gps_altitude_m)',
        description: 'Highest elevation reached during the ride, measured by GPS altitude sensor',
        unit: 'm'
    },

    'Elevation Min': {
        formula: 'min(gps_altitude_m)',
        description: 'Lowest elevation reached during the ride, measured by GPS altitude sensor',
        unit: 'm'
    },

    'Elevation Diff': {
        formula: 'max(gps_altitude_m) - min(gps_altitude_m)',
        description: 'Total elevation change during the ride. Indicates how hilly the terrain was',
        unit: 'm'
    },

    // ===== NEW ADDITIONS =====
    'Max Acceleration': {
        formula: 'max(acceleration_m_s2)',
        description: 'Peak forward acceleration recorded during the ride. Higher values indicate harder acceleration or sudden speed increases',
        unit: 'm/s²'
    },

    'Min Acceleration': {
        formula: 'min(acceleration_m_s2)',
        description: 'Peak deceleration (braking) recorded during the ride. Large negative values indicate hard braking events',
        unit: 'm/s²'
    },

    'Corrected V Start': {
        formula: 'first(corrected_voltage_v)',
        description: 'Battery voltage at the start of the ride, corrected for load. More accurate than raw voltage for estimating state of charge',
        unit: 'V'
    },

    'Corrected V End': {
        formula: 'last(corrected_voltage_v)',
        description: 'Battery voltage at the end of the ride, corrected for load. Compare with start voltage to see total energy consumed',
        unit: 'V'
    },

    'Corrected V Drop': {
        formula: 'corrected_v_start - corrected_v_end',
        description: 'Total corrected voltage drop over the ride. Indicates how much battery energy was consumed. Larger drops mean more energy used',
        unit: 'V'
    },

    'Speed Limit': {
        formula: 'From CSV metadata/settings',
        description: 'Speed limit configured on the EUC at the time of recording. The wheel may apply tiltback or beep warnings when approaching this limit',
        unit: 'km/h'
    },

    'CPU Load Avg': {
        formula: 'avg(cpu_load_pct)',
        description: 'Average CPU load of the EUC controller during the ride. High values (>80%) may indicate the controller is under stress',
        unit: '%'
    },

    'Fan': {
        formula: 'max(fan_status) > 0 ? ON : OFF',
        description: 'Whether the cooling fan activated during the ride. Fan turns on when controller or motor temperatures exceed a threshold'
    }
};

/**
 * Get tooltip HTML content for a stat
 * @param {string} statLabel - The stat label (e.g., 'Max Speed (Wheel)')
 * @returns {string|null} HTML formatted tooltip content, or null if no metadata
 */
export function getTooltipContent(statLabel) {
    // Handle PWM mode-aware labels
    let lookupKey = statLabel;
    if (statLabel.includes('⚡ Min PWM') || statLabel.includes('⚡ Max PWM')) {
        // Determine which PWM mode based on label
        lookupKey = statLabel.includes('Min PWM') ? 'PWM (Mode 2)' : 'PWM (Mode 1)';
    }

    // Remove emoji and extra spacing from label for lookup
    const cleanLabel = lookupKey.replace(/[🚀⚡🔋🌡️↗️↙️🔄⛰️📏⏱️📅📍🏭🛞🕐⏰⏳🎖️🏁📡📊🛣️📈📉🚦💻🌀🆕]/g, '').trim();

    const metadata = STAT_METADATA[cleanLabel];
    if (!metadata) {
        console.warn(`[STAT METADATA] No metadata found for: "${statLabel}" (cleaned: "${cleanLabel}")`);
        return null;
    }

    // Build HTML tooltip content
    let html = `<strong>Formula:</strong> ${metadata.formula}<br>`;
    html += `<strong>Description:</strong> ${metadata.description}`;
    if (metadata.unit) {
        html += `<br><strong>Unit:</strong> ${metadata.unit}`;
    }

    return html;
}
