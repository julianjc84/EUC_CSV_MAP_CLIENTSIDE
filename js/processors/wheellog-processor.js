/**
 * WheelLog CSV Processor
 * Handles CSV files from WheelLog app format
 * Ported from Python processors/wheellog_processor.py
 */

import { BaseProcessor } from './base-processor.js';

export class WheelLogProcessor extends BaseProcessor {
    constructor() {
        super();
        // PWM mode will be auto-detected from data (removed hardcoding)
        this.columnMapping = {
            'latitude': 'gps_lat',
            'longitude': 'gps_lon',
            'battery_level': 'battery',
            'system_temp': 'temp',
            'temp2': 'temp_motor',
            'phase_current': 'current_phase',
            'gps_speed': 'gps_speed',
            'gps_alt': 'gps_alt',
            'gps_heading': 'gps_bearing',
            'gps_distance': 'gps_distance',
            'voltage': 'voltage',
            'current': 'current',
            'power': 'power',
            'speed': 'speed',
            'distance': 'distance',
            'totaldistance': 'distance_total',
            'pwm': 'pwm',
            'tilt': 'tilt',
            'roll': 'roll',
            'alert': 'alert'
        };
    }

    getFormatName() {
        return 'WheelLog';
    }

    getSupportedFeatures() {
        return [
            'speed_route',
            'gps_mapping',
            'power_charts',
            'temperature_monitoring',
            'voltage_current_charts'
        ];
    }

    getColumnMapping() {
        return {
            'date':              { type: 'timestamp', description: 'Date of each data point' },
            'time':              { type: 'timestamp', description: 'Time of each data point' },
            'speed':             { type: 'series', series: 'speed', label: 'Speed (Wheel)', unit: 'km/h', chartGroup: 'speed' },
            'gps_speed':         { type: 'series', series: 'gps_speed', label: 'Speed (GPS)', unit: 'km/h', chartGroup: 'speed' },
            'gps_alt':           { type: 'series', series: 'gps_alt', label: 'Altitude (GPS)', unit: 'm', chartGroup: 'speed' },
            'latitude':          { type: 'gps', description: 'GPS Latitude' },
            'longitude':         { type: 'gps', description: 'GPS Longitude' },
            'gps_heading':       { type: 'series', series: 'gps_bearing', label: 'GPS Heading', unit: '°' },
            'gps_distance':      { type: 'series', series: 'gps_distance', label: 'GPS Distance', unit: 'km' },
            'battery_level':     { type: 'series', series: 'battery', label: 'Battery %', chartGroup: 'battery' },
            'pwm':               { type: 'series', series: 'pwm', label: 'PWM %', chartGroup: 'battery' },
            'power':             { type: 'series', series: 'power', label: 'Power', unit: 'W', chartGroup: 'power' },
            'voltage':           { type: 'series', series: 'voltage', label: 'Voltage', unit: 'V', chartGroup: 'electrical' },
            'current':           { type: 'series', series: 'current', label: 'Current', unit: 'A', chartGroup: 'electrical' },
            'phase_current':     { type: 'series', series: 'current_phase', label: 'Phase Current', unit: 'A', chartGroup: 'electrical' },
            'system_temp':       { type: 'series', series: 'temp', label: 'Temp (System)', unit: '°C', chartGroup: 'temperature' },
            'temp2':             { type: 'series', series: 'temp_motor', label: 'Temp (Motor)', unit: '°C', chartGroup: 'temperature' },
            'distance':          { type: 'series', series: 'distance', label: 'Trip Distance', unit: 'km' },
            'totaldistance':     { type: 'series', series: 'distance_total', label: 'Odometer', unit: 'km' },
            'tilt':              { type: 'series', series: 'tilt', label: 'Tilt', unit: '°' },
            'roll':              { type: 'series', series: 'roll', label: 'Roll', unit: '°' },
            'alert':             { type: 'series', series: 'alert', label: 'Alert' },
        };
    }

    /**
     * Process WheelLog CSV data
     * @param {Array} parsedData - Papa Parse result
     * @param {string} filename - Original filename
     * @returns {Object} Processed data structure
     */
    processCSV(parsedData, filename) {
        console.log('\n' + '='.repeat(80));
        console.log('[WHEELLOG] CSV Processing');
        console.log('='.repeat(80));
        console.log(`[WHEELLOG] Processing file: ${filename}`);
        console.log(`[WHEELLOG] Loaded ${parsedData.length} rows`);

        try {
            // Extract timestamps from date + time columns
            const timestamps = parsedData.map(row => {
                const dateStr = row.date;
                const timeStr = row.time;
                const combined = `${dateStr} ${timeStr}`;
                return new Date(combined).getTime();
            });

            // Map and extract all series
            const series = this.extractAllSeries(parsedData);

            // Extract GPS route
            const gpsRoute = this.extractGPSRoute(parsedData);
            if (gpsRoute.has_gps) {
                console.log(`[WHEELLOG] GPS route: ${gpsRoute.total_points} points`);
            } else {
                console.log('[WHEELLOG] ⚠️ No GPS data detected');
            }

            // Extract metadata (limited for WheelLog)
            const metadata = {
                make: 'N/A',
                model: 'N/A',
                firmware: 'N/A',
                source: 'WheelLog'
            };

            // Create chart groups
            const chartGroups = this.createChartGroups(series, timestamps);

            console.log('='.repeat(80));
            console.log(`[WHEELLOG] Successfully processed ${parsedData.length} rows`);
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
            console.error('[WHEELLOG] Processing error:', error);
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
        series.speed = this.extractSeries(parsedData, 'speed');
        series.gps_speed = this.extractSeries(parsedData, 'gps_speed');
        series.gps_alt = this.extractSeries(parsedData, 'gps_alt');
        series.battery = this.extractSeries(parsedData, 'battery_level');

        // Extract and process PWM data (auto-detect mode + apply flip if enabled)
        series.pwm = this.processPWM(this.extractSeries(parsedData, 'pwm'));

        // Power and electrical
        series.power = this.extractSeries(parsedData, 'power');
        series.voltage = this.extractSeries(parsedData, 'voltage');
        series.current = this.extractSeries(parsedData, 'current');
        series.current_phase = this.extractSeries(parsedData, 'phase_current');

        // Temperature
        series.temp = this.extractSeries(parsedData, 'system_temp');
        series.temp_motor = this.extractSeries(parsedData, 'temp2');

        // Distance (convert from meters to km if needed)
        const rawDistance = this.extractSeries(parsedData, 'distance');
        const rawTotalDistance = this.extractSeries(parsedData, 'totaldistance');
        const rawGPSDistance = this.extractSeries(parsedData, 'gps_distance');

        series.distance = this.convertDistanceIfNeeded(rawDistance, 'distance');
        series.distance_total = this.convertDistanceIfNeeded(rawTotalDistance, 'totaldistance');
        series.gps_distance = this.convertDistanceIfNeeded(rawGPSDistance, 'gps_distance');

        // Orientation
        series.tilt = this.extractSeries(parsedData, 'tilt');
        series.roll = this.extractSeries(parsedData, 'roll');

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
            'Temp (System)': '#A02000',
            'Temp (Motor)': '#777777',
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
                    { name: 'Temp (System)', data: series.temp, color: plotlyColors['Temp (System)'], unit: '°C', secondaryY: false },
                    { name: 'Temp (Motor)', data: series.temp_motor, color: plotlyColors['Temp (Motor)'], unit: '°C', secondaryY: false }
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
     * Override extractGPSRoute to handle WheelLog column names
     * @param {Array} parsedData - Parsed CSV data
     * @returns {Object} GPS route object
     */
    extractGPSRoute(parsedData) {
        const latData = this.extractSeries(parsedData, 'latitude');
        const lonData = this.extractSeries(parsedData, 'longitude');

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

export default WheelLogProcessor;
