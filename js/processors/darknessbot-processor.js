/**
 * DarknessBot CSV Processor
 * Handles CSV files from DarknessBot app format
 * Ported from Python processors/darknessbot_processor.py
 */

import { BaseProcessor } from './base-processor.js';

export class DarknessBotProcessor extends BaseProcessor {
    constructor() {
        super();
        this.columnMapping = {
            'Date': 'datetime',
            'Speed': 'speed',
            'Voltage': 'voltage',
            'PWM': 'pwm',
            'Current': 'current',
            'Power': 'power',
            'Battery level': 'battery',
            'Total mileage': 'distance_total',
            'Temperature': 'temp',
            'Pitch': 'tilt',
            'Roll': 'roll',
            'Latitude': 'gps_lat',
            'Longitude': 'gps_lon',
            'Altitude': 'gps_alt',
            'GPS Speed': 'gps_speed',
            'GPS Distance': 'gps_distance'
        };
    }

    getFormatName() {
        return 'DarknessBot';
    }

    getSupportedFeatures() {
        return [
            'speed_route',
            'safety_route',
            'gps_mapping',
            'power_charts',
            'temperature_monitoring',
            'voltage_current_charts',
            'pwm_data'
        ];
    }

    getColumnMapping() {
        return {
            'Date':              { type: 'timestamp', description: 'Date/time of each data point' },
            'Speed':             { type: 'series', series: 'speed', label: 'Speed (Wheel)', unit: 'km/h', chartGroup: 'speed' },
            'GPS Speed':         { type: 'series', series: 'gps_speed', label: 'Speed (GPS)', unit: 'km/h', chartGroup: 'speed' },
            'Altitude':          { type: 'series', series: 'gps_alt', label: 'Altitude (GPS)', unit: 'm', chartGroup: 'speed' },
            'Latitude':          { type: 'gps', description: 'GPS Latitude' },
            'Longitude':         { type: 'gps', description: 'GPS Longitude' },
            'GPS Distance':      { type: 'series', series: 'gps_distance', label: 'GPS Distance', unit: 'km' },
            'Battery level':     { type: 'series', series: 'battery', label: 'Battery %', chartGroup: 'battery' },
            'PWM':               { type: 'series', series: 'pwm', label: 'PWM %', chartGroup: 'battery' },
            'Power':             { type: 'series', series: 'power', label: 'Power', unit: 'W', chartGroup: 'power' },
            'Voltage':           { type: 'series', series: 'voltage', label: 'Voltage', unit: 'V', chartGroup: 'electrical' },
            'Current':           { type: 'series', series: 'current', label: 'Current', unit: 'A', chartGroup: 'electrical' },
            'Temperature':       { type: 'series', series: 'temp', label: 'Temperature', unit: '°C', chartGroup: 'temperature' },
            'Total mileage':     { type: 'series', series: 'distance_total', label: 'Odometer', unit: 'km' },
            'Pitch':             { type: 'series', series: 'tilt', label: 'Tilt (Pitch)', unit: '°' },
            'Roll':              { type: 'series', series: 'roll', label: 'Roll', unit: '°' },
        };
    }

    /**
     * Process DarknessBot CSV data
     * @param {Array} parsedData - Papa Parse result
     * @param {string} filename - Original filename
     * @returns {Object} Processed data structure
     */
    processCSV(parsedData, filename) {
        console.log('\n' + '='.repeat(80));
        console.log('[DARKNESSBOT] CSV Processing');
        console.log('='.repeat(80));
        console.log(`[DARKNESSBOT] Processing file: ${filename}`);
        console.log(`[DARKNESSBOT] Loaded ${parsedData.length} rows`);

        try {
            // Extract timestamps from Date column
            const timestamps = this.extractTimestamps(parsedData, 'Date');

            // Map and extract all series
            const series = this.extractAllSeries(parsedData);

            // Extract GPS route
            const gpsRoute = this.extractGPSRoute(parsedData);
            if (gpsRoute.has_gps) {
                console.log(`[DARKNESSBOT] GPS route: ${gpsRoute.total_points} points`);
            } else {
                console.log('[DARKNESSBOT] ⚠️ No GPS data detected');
            }

            // Extract metadata (limited for DarknessBot)
            const metadata = {
                make: 'N/A',
                model: 'N/A',
                firmware: 'N/A',
                source: 'DarknessBot'
            };

            // Create chart groups
            const chartGroups = this.createChartGroups(series, timestamps);

            console.log('='.repeat(80));
            console.log(`[DARKNESSBOT] Successfully processed ${parsedData.length} rows`);
            console.log('='.repeat(80) + '\n');

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
            console.error('[DARKNESSBOT] Processing error:', error);
            throw error;
        }
    }

    /**
     * Extract all data series with column mapping
     * @param {Array} parsedData - Parsed CSV data
     * @returns {Object} Series data object
     */
    extractAllSeries(parsedData) {
        const series = {};

        // Extract and map columns
        series.speed = this.extractSeries(parsedData, 'Speed');
        series.gps_speed = this.extractSeries(parsedData, 'GPS Speed');
        series.gps_alt = this.extractSeries(parsedData, 'Altitude');
        series.battery = this.extractSeries(parsedData, 'Battery level');

        // Extract and process PWM data (auto-detect mode + apply flip if enabled)
        series.pwm = this.processPWM(this.extractSeries(parsedData, 'PWM'));

        // Power and electrical
        series.power = this.extractSeries(parsedData, 'Power');
        series.voltage = this.extractSeries(parsedData, 'Voltage');
        series.current = this.extractSeries(parsedData, 'Current');

        // Temperature
        series.temp = this.extractSeries(parsedData, 'Temperature');

        // Distance (convert from meters to km if needed)
        const rawTotalDistance = this.extractSeries(parsedData, 'Total mileage');
        const rawGPSDistance = this.extractSeries(parsedData, 'GPS Distance');

        series.distance_total = this.convertDistanceIfNeeded(rawTotalDistance, 'Total mileage');
        series.gps_distance = this.convertDistanceIfNeeded(rawGPSDistance, 'GPS Distance');

        // Orientation (Pitch = Tilt in DarknessBot)
        series.tilt = this.extractSeries(parsedData, 'Pitch');
        series.roll = this.extractSeries(parsedData, 'Roll');

        // Calculate energy consumption (Wh/km) if not present
        // Uses base class implementation (BaseProcessor.calculateEnergyConsumption)
        series.energy_consumption = this.calculateEnergyConsumption(series);

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
            'Energy Consumption': '#FF6B35',
            'Voltage': '#003366',
            'Current': '#8B4513',
            'Temperature': '#A02000',
            'Acceleration': '#E65100',
            'Tilt': '#7B1FA2',
            'Roll': '#00897B'
        };

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
                title: 'Power',
                series: [
                    { name: 'Power', data: series.power, color: plotlyColors['Power'], unit: 'W', secondaryY: true },
                    { name: 'Energy Consumption', data: series.energy_consumption, color: plotlyColors['Energy Consumption'], unit: 'Wh/km', secondaryY: false }
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
                series: [
                    { name: 'Temperature', data: series.temp, color: plotlyColors['Temperature'], unit: '°C', secondaryY: false }
                ],
                timestamps: timestamps
            },
            acceleration: {
                title: 'Acceleration',
                series: [
                    { name: 'Acceleration', data: series.acceleration || null, color: plotlyColors['Acceleration'], unit: 'm/s²', secondaryY: false }
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
     * Override extractTimestamps to parse DarknessBot date format
     * @param {Array} parsedData - Parsed CSV data
     * @param {string} dateColumn - Date column name
     * @returns {Array<number>} Array of timestamps
     */
    extractTimestamps(parsedData, dateColumn) {
        return parsedData.map(row => {
            const dateStr = row[dateColumn];
            // DarknessBot format: "09.10.2025 04:28:45.808"
            // Try parsing, JavaScript Date can handle various formats
            const date = new Date(dateStr);
            return date.getTime();
        });
    }

    /**
     * Override extractGPSRoute to handle DarknessBot column names
     * @param {Array} parsedData - Parsed CSV data
     * @returns {Object} GPS route object
     */
    extractGPSRoute(parsedData) {
        const latData = this.extractSeries(parsedData, 'Latitude');
        const lonData = this.extractSeries(parsedData, 'Longitude');

        if (!latData || !lonData) {
            return { has_gps: false, coordinates: [] };
        }

        // Filter valid coordinates
        const coordinates = [];
        for (let i = 0; i < Math.min(latData.length, lonData.length); i++) {
            const lat = latData[i];
            const lon = lonData[i];

            if (lat !== null && lon !== null && !isNaN(lat) && !isNaN(lon)) {
                if (lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180) {
                    coordinates.push([lat, lon]);
                }
            }
        }

        return {
            has_gps: coordinates.length > 0,
            coordinates: coordinates,
            total_points: coordinates.length
        };
    }
}

export default DarknessBotProcessor;
