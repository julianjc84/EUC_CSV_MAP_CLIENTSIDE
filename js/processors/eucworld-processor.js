/**
 * EUC World CSV Processor
 * Handles CSV files from EUC World app format
 */

import { BaseProcessor } from './base-processor.js';

export class EUCWorldProcessor extends BaseProcessor {
    constructor() {
        super();
        // PWM mode will be auto-detected from data (removed hardcoding)
        this.numericColumns = [
            'speed', 'gps_speed', 'gps_alt', 'gps_lat', 'gps_lon', 'gps_bearing', 'gps_distance',
            'battery', 'pwm', 'safety_margin', 'speed_avg_riding', 'distance', 'distance_total',
            'duration_riding', 'duration', 'power', 'energy_consumption', 'voltage', 'current',
            'current_phase', 'temp', 'temp_motor', 'temp_batt', 'tilt', 'roll', 'alert',
            'acceleration', 'battery_corrected_voltage', 'cpu_load', 'temp_cpu', 'temp_imu', 'fan', 'speed_limit'
        ];
    }

    getFormatName() {
        return 'EUC World';
    }

    getSupportedFeatures() {
        return [
            'speed_route',
            'safety_route',
            'skull_markers',
            'rocket_markers',
            'device_metadata',
            'timezone_detection',
            'full_telemetry'
        ];
    }

    getColumnMapping() {
        return {
            'datetime':           { type: 'timestamp', description: 'Date/time of each data point' },
            'speed':              { type: 'series', series: 'speed', label: 'Speed (Wheel)', unit: 'km/h', chartGroup: 'speed' },
            'gps_speed':          { type: 'series', series: 'gps_speed', label: 'Speed (GPS)', unit: 'km/h', chartGroup: 'speed' },
            'gps_alt':            { type: 'series', series: 'gps_alt', label: 'Altitude (GPS)', unit: 'm', chartGroup: 'speed' },
            'gps_lat':            { type: 'gps', description: 'GPS Latitude' },
            'gps_lon':            { type: 'gps', description: 'GPS Longitude' },
            'gps_bearing':        { type: 'series', series: 'gps_bearing', label: 'GPS Bearing', unit: '°' },
            'gps_distance':       { type: 'series', series: 'gps_distance', label: 'GPS Distance', unit: 'km' },
            'safety_margin':      { type: 'series', series: 'pwm', label: 'PWM %', chartGroup: 'battery', note: 'Falls back to "pwm" column' },
            'pwm':                { type: 'series', series: 'pwm', label: 'PWM %', chartGroup: 'battery', note: 'Used if safety_margin absent' },
            'battery':            { type: 'series', series: 'battery', label: 'Battery %', chartGroup: 'battery' },
            'power':              { type: 'series', series: 'power', label: 'Power', unit: 'W', chartGroup: 'power' },
            'energy_consumption': { type: 'series', series: 'energy_consumption', label: 'Energy Consumption', unit: 'Wh/km', chartGroup: 'power' },
            'voltage':            { type: 'series', series: 'voltage', label: 'Voltage', unit: 'V', chartGroup: 'electrical' },
            'current':            { type: 'series', series: 'current', label: 'Current', unit: 'A', chartGroup: 'electrical' },
            'current_phase':      { type: 'series', series: 'current_phase', label: 'Phase Current', unit: 'A', chartGroup: 'electrical' },
            'temp':               { type: 'series', series: 'temp', label: 'Temp (System)', unit: '°C', chartGroup: 'temperature' },
            'temp_motor':         { type: 'series', series: 'temp_motor', label: 'Temp (Motor)', unit: '°C', chartGroup: 'temperature' },
            'temp_batt':          { type: 'series', series: 'temp_batt', label: 'Temp (Battery)', unit: '°C', chartGroup: 'temperature' },
            'distance':           { type: 'series', series: 'distance', label: 'Trip Distance', unit: 'km' },
            'distance_total':     { type: 'series', series: 'distance_total', label: 'Odometer', unit: 'km' },
            'speed_avg_riding':   { type: 'series', series: 'speed_avg_riding', label: 'Avg Riding Speed', unit: 'km/h' },
            'duration_riding':    { type: 'series', series: 'duration_riding', label: 'Riding Duration' },
            'duration':           { type: 'series', series: 'duration', label: 'Duration' },
            'tilt':               { type: 'series', series: 'tilt', label: 'Tilt', unit: '°' },
            'roll':               { type: 'series', series: 'roll', label: 'Roll', unit: '°' },
            'alert':              { type: 'series', series: 'alert', label: 'Alert' },
            'acceleration':       { type: 'series', series: 'acceleration', label: 'Acceleration', unit: 'm/s²' },
            'battery_corrected_voltage': { type: 'series', series: 'battery_corrected_voltage', label: 'Corrected Voltage', unit: 'V', chartGroup: 'electrical' },
            'cpu_load':           { type: 'series', series: 'cpu_load', label: 'CPU Load', unit: '%' },
            'temp_cpu':           { type: 'series', series: 'temp_cpu', label: 'Temp (CPU)', unit: '°C', chartGroup: 'temperature' },
            'temp_imu':           { type: 'series', series: 'temp_imu', label: 'Temp (IMU)', unit: '°C', chartGroup: 'temperature' },
            'fan':                { type: 'series', series: 'fan', label: 'Fan Status' },
            'speed_limit':        { type: 'metadata', description: 'Configured speed limit (km/h)' },
            'extra':              { type: 'metadata', description: 'Device metadata (key=value pairs)' },
        };
    }

    /**
     * Process EUC World CSV data
     * @param {Array} parsedData - Papa Parse result
     * @param {string} filename - Original filename
     * @returns {Object} Processed data structure
     */
    processCSV(parsedData, filename) {

        try {
            // Extract timestamps from datetime column
            const timestamps = this.extractTimestamps(parsedData, 'datetime');

            // Extract PWM data (safety_margin and pwm are the same data, different names)
            let rawPWMData;
            if (parsedData[0].hasOwnProperty('safety_margin')) {
                // EUC World uses 'safety_margin' column name (same as PWM data)
                rawPWMData = this.extractSeries(parsedData, 'safety_margin');
            } else if (parsedData[0].hasOwnProperty('pwm')) {
                // Some files may use 'pwm' column name directly
                rawPWMData = this.extractSeries(parsedData, 'pwm');
            } else {
                console.warn('[EUC WORLD] No PWM/safety_margin column found');
                rawPWMData = null;
            }

            // Auto-detect PWM mode and apply flip if enabled
            const pwmData = this.processPWM(rawPWMData);

            // Extract all series
            const series = this.extractAllSeries(parsedData, pwmData);

            // Extract GPS route
            const gpsRoute = this.extractGPSRoute(parsedData);

            // Extract metadata from extra column
            const metadata = this.extractMetadata(parsedData, filename);

            // Create chart groups
            const chartGroups = this.createChartGroups(series, timestamps);


            return {
                formatName: this.getFormatName(),
                dataCount: parsedData.length,
                timestamps: timestamps,
                series: series,
                chartGroups: chartGroups,
                gpsRoute: gpsRoute,
                metadata: metadata,
                supportedFeatures: this.getSupportedFeatures()
            };

        } catch (error) {
            console.error('[EUC WORLD] Processing error:', error);
            throw error;
        }
    }

    /**
     * Extract all data series
     * @param {Array} parsedData - Parsed CSV data
     * @param {Array} pwmData - Pre-processed PWM data
     * @returns {Object} Series data object
     */
    extractAllSeries(parsedData, pwmData) {
        const series = {};

        // Core columns
        series.speed = this.extractSeries(parsedData, 'speed');
        series.gps_speed = this.extractSeries(parsedData, 'gps_speed');
        series.gps_alt = this.extractSeries(parsedData, 'gps_alt');
        series.battery = this.extractSeries(parsedData, 'battery');
        series.pwm = pwmData;

        // Power and energy
        series.power = this.extractSeries(parsedData, 'power');
        series.energy_consumption = this.extractSeries(parsedData, 'energy_consumption');
        series.voltage = this.extractSeries(parsedData, 'voltage');
        series.current = this.extractSeries(parsedData, 'current');
        series.current_phase = this.extractSeries(parsedData, 'current_phase');

        // Temperature
        series.temp = this.extractSeries(parsedData, 'temp');
        series.temp_motor = this.extractSeries(parsedData, 'temp_motor');
        series.temp_batt = this.extractSeries(parsedData, 'temp_batt');

        // Distance
        series.distance = this.extractSeries(parsedData, 'distance');
        series.distance_total = this.extractSeries(parsedData, 'distance_total');
        series.gps_distance = this.extractSeries(parsedData, 'gps_distance');

        // Orientation
        series.tilt = this.extractSeries(parsedData, 'tilt');
        series.roll = this.extractSeries(parsedData, 'roll');

        // System & Diagnostics
        series.acceleration = this.extractSeries(parsedData, 'acceleration');
        series.battery_corrected_voltage = this.extractSeries(parsedData, 'battery_corrected_voltage');
        series.cpu_load = this.extractSeries(parsedData, 'cpu_load');
        series.temp_cpu = this.extractSeries(parsedData, 'temp_cpu');
        series.temp_imu = this.extractSeries(parsedData, 'temp_imu');
        series.fan = this.extractSeries(parsedData, 'fan');

        // Calculate energy consumption if not present or empty
        // Uses base class implementation (BaseProcessor.calculateEnergyConsumption)
        if (!series.energy_consumption || series.energy_consumption.every(v => v === null)) {
            series.energy_consumption = this.calculateEnergyConsumption(series);
        }

        return series;
    }

    /**
     * Create chart groups for rendering
     * @param {Object} series - All series data
     * @param {Array} timestamps - Timestamp array
     * @returns {Object} Chart group configuration
     */
    createChartGroups(series, timestamps) {
        const plotlyColors = {
            'Speed (Wheel)': '#885b3e',
            'Speed (GPS)': '#00d000',
            'Altitude (GPS)': '#b0b0b0',
            'Battery %': '#333333',
            'PWM %': '#006000',
            'Power': '#440064',
            'Energy Consumption': '#00AA00',
            'Voltage': '#003366',
            'Current': '#8B4513',
            'Temp (System)': '#A02000',
            'Temp (Motor)': '#777777',
            'Temp (Battery)': '#FFD700',
            'CPU Load': '#1565C0',
            'Temp (CPU)': '#E91E63',
            'Temp (IMU)': '#00BCD4',
            'Acceleration': '#E65100',
            'Tilt': '#7B1FA2',
            'Roll': '#00897B'
        };

        // Build temperature series (null-data series are filtered out centrally in renderCharts)
        const tempSeries = [
            { name: 'Temp (System)', data: series.temp, color: plotlyColors['Temp (System)'], unit: '°C', secondaryY: false },
            { name: 'Temp (Motor)', data: series.temp_motor, color: plotlyColors['Temp (Motor)'], unit: '°C', secondaryY: false },
            { name: 'Temp (Battery)', data: series.temp_batt, color: plotlyColors['Temp (Battery)'], unit: '°C', secondaryY: false },
            { name: 'Temp (CPU)', data: series.temp_cpu, color: plotlyColors['Temp (CPU)'], unit: '°C', secondaryY: false },
            { name: 'Temp (IMU)', data: series.temp_imu, color: plotlyColors['Temp (IMU)'], unit: '°C', secondaryY: false },
            { name: 'CPU Load', data: series.cpu_load, color: plotlyColors['CPU Load'], unit: '%', secondaryY: true }
        ];

        return {
            speed: {
                title: 'Speed & Altitude',
                series: [
                    { name: 'Altitude (GPS)', data: series.gps_alt, color: plotlyColors['Altitude (GPS)'], unit: 'm', secondaryY: true },
                    { name: 'Speed (GPS)', data: series.gps_speed, color: plotlyColors['Speed (GPS)'], unit: 'km/h', secondaryY: false },
                    { name: 'Speed (Wheel)', data: series.speed, color: plotlyColors['Speed (Wheel)'], unit: 'km/h', secondaryY: false }
                ],
                timestamps: timestamps
            },
            battery: {
                title: 'Battery & PWM',
                series: [
                    { name: 'Battery %', data: series.battery, color: plotlyColors['Battery %'], unit: '%', secondaryY: true },
                    { name: 'PWM %', data: series.pwm, color: plotlyColors['PWM %'], unit: '%', secondaryY: false }
                ],
                timestamps: timestamps
            },
            power: {
                title: 'Power & Energy',
                series: [
                    { name: 'Power', data: series.power, color: plotlyColors['Power'], unit: 'W', secondaryY: false },
                    { name: 'Energy Consumption', data: series.energy_consumption, color: plotlyColors['Energy Consumption'], unit: 'Wh/km', secondaryY: true }
                ],
                timestamps: timestamps
            },
            electrical: {
                title: 'Voltage & Current',
                series: [
                    { name: 'Voltage', data: series.voltage, color: plotlyColors['Voltage'], unit: 'V', secondaryY: false },
                    { name: 'Current', data: series.current, color: plotlyColors['Current'], unit: 'A', secondaryY: true }
                ],
                timestamps: timestamps
            },
            temperature: {
                title: 'Temperature',
                series: tempSeries,
                timestamps: timestamps
            },
            acceleration: {
                title: 'Acceleration',
                series: [
                    { name: 'Acceleration', data: series.acceleration, color: plotlyColors['Acceleration'], unit: 'm/s²', secondaryY: false }
                ],
                timestamps: timestamps
            },
            orientation: {
                title: 'Tilt & Roll',
                series: [
                    { name: 'Tilt', data: series.tilt, color: plotlyColors['Tilt'], unit: '°', secondaryY: false },
                    { name: 'Roll', data: series.roll, color: plotlyColors['Roll'], unit: '°', secondaryY: false }
                ],
                timestamps: timestamps
            }
        };
    }

    /**
     * Extract metadata from extra column
     * @param {Array} parsedData - Parsed CSV data
     * @param {string} filename - Original filename
     * @returns {Object} Metadata object
     */
    extractMetadata(parsedData, filename) {
        const metadata = {
            make: 'N/A',
            model: 'N/A',
            firmware: 'N/A'
        };

        // Try to parse first row's extra column
        if (parsedData.length > 0 && parsedData[0].extra) {
            const extraData = this.parseExtraColumn(parsedData[0].extra);
            metadata.make = extraData['euc.make'] || 'N/A';
            metadata.model = extraData['euc.model'] || extraData['euc.name'] || 'N/A';
            metadata.firmware = extraData['euc.firmware'] || 'N/A';
        }

        // Fallback to filename parsing if needed
        if (metadata.make === 'N/A' || metadata.model === 'N/A') {
            const filenameData = this.extractFromFilename(filename);
            if (metadata.make === 'N/A') metadata.make = filenameData.make;
            if (metadata.model === 'N/A') metadata.model = filenameData.model;
        }

        // Extract speed limit from speed_limit column (first valid numeric value)
        if (parsedData.length > 0 && parsedData[0].hasOwnProperty('speed_limit')) {
            for (const row of parsedData) {
                const val = parseFloat(row.speed_limit);
                if (!isNaN(val)) {
                    metadata.speedLimit = val;
                    break;
                }
            }
        }

        // Collect ALL extra column key-value pairs from every row
        const extraFields = {};
        for (const row of parsedData) {
            if (row.extra && typeof row.extra === 'string' && row.extra.includes('=')) {
                const parts = row.extra.split(/[;\n|]/).map(p => p.trim());
                for (const part of parts) {
                    const eqIdx = part.indexOf('=');
                    if (eqIdx > 0) {
                        const key = part.substring(0, eqIdx).trim();
                        const value = part.substring(eqIdx + 1).trim();
                        if (key && value && !extraFields[key]) {
                            extraFields[key] = value;
                        }
                    }
                }
            }
        }
        if (Object.keys(extraFields).length > 0) {
            metadata.extraFields = extraFields;
        }

        return metadata;
    }

    /**
     * Parse extra column data
     * @param {string} extraStr - Extra column value
     * @returns {Object} Parsed key-value pairs
     */
    parseExtraColumn(extraStr) {
        const data = {};

        if (!extraStr || typeof extraStr !== 'string') {
            return data;
        }

        // Split by newline, pipe, semicolon, or comma
        const parts = extraStr.split(/[\n|;,]/).map(p => p.trim());

        // Brand mappings
        const brandMappings = {
            'gotway': 'BEGODE',
            'begode': 'BEGODE',
            'veteran': 'LEAPERKIM',
            'leaperkim': 'LEAPERKIM',
            'kingsong': 'KING SONG',
            'king song': 'KING SONG',
            'ks': 'KING SONG'
        };

        for (const part of parts) {
            if (part.includes('=')) {
                const [key, value] = part.split('=').map(s => s.trim());

                // Apply brand normalization
                if (key === 'euc.make' && brandMappings[value.toLowerCase()]) {
                    data[key] = brandMappings[value.toLowerCase()];
                } else {
                    data[key] = value;
                }
            }
        }

        return data;
    }

    /**
     * Extract make/model from filename
     * @param {string} filename - Original filename
     * @returns {Object} Make and model
     */
    extractFromFilename(filename) {
        const filenameLower = filename.toLowerCase();
        let make = 'N/A';
        let model = 'N/A';

        if (filenameLower.includes('begode') || filenameLower.includes('gotway')) {
            make = 'BEGODE';
            if (filenameLower.includes('master')) model = 'Master';
            else if (filenameLower.includes('sherman')) model = 'Sherman';
        } else if (filenameLower.includes('kingsong') || filenameLower.includes('ks-') || filenameLower.includes('ks ')) {
            make = 'KING SONG';
            if (filenameLower.includes('s22')) model = 'S22';
            else if (filenameLower.includes('s18')) model = 'S18';
        } else if (filenameLower.includes('veteran') || filenameLower.includes('leaperkim')) {
            make = 'LEAPERKIM';
            if (filenameLower.includes('sherman')) model = 'Sherman L';
            else if (filenameLower.includes('patton')) model = 'Patton';
        }

        return { make, model };
    }
}

export default EUCWorldProcessor;
