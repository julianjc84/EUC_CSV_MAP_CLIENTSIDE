/**
 * CSV Format Detector
 * Detects which EUC app format a CSV file uses
 */

export class FormatDetector {
    /**
     * Detect CSV format from content
     * @param {string} csvContent - Raw CSV content
     * @param {string} filename - Original filename
     * @returns {string} Format name: 'EUCWorld', 'WheelLog', 'DarknessBot', or 'Unknown'
     */
    static detectFormat(csvContent, filename = '') {

        try {
            // Get first line (header)
            const firstLine = csvContent.split('\n')[0];
            const columns = firstLine.split(',').map(col => col.trim());


            // EUC World Detection
            if (this.isEUCWorld(columns)) {
                return 'EUCWorld';
            }

            // DarknessBot Detection
            if (this.isDarknessBot(columns)) {
                return 'DarknessBot';
            }

            // WheelLog Detection
            if (this.isWheelLog(columns)) {
                return 'WheelLog';
            }

            console.warn('[FORMAT DETECTOR] ⚠️ Unknown format');
            return 'Unknown';

        } catch (error) {
            console.error('[FORMAT DETECTOR] Error:', error);
            return 'Unknown';
        }
    }

    /**
     * Check if CSV is EUC World format
     * Characteristics:
     * - Has 'extra' column
     * - Has 'datetime' column (not separate date/time)
     */
    static isEUCWorld(columns) {
        const hasExtra = columns.includes('extra');
        const hasDatetime = columns.includes('datetime');
        return hasExtra && hasDatetime;
    }

    /**
     * Check if CSV is DarknessBot format
     * Characteristics:
     * - Has 'Date' column (capital D, single column)
     * - Has 'Battery level' (with space)
     * - Has 'Pitch' (not 'tilt')
     * - Has 'Total mileage' (not 'distance_total')
     * - NO 'datetime' or 'extra' columns
     */
    static isDarknessBot(columns) {
        const hasDate = columns.includes('Date');
        const hasBatteryLevel = columns.includes('Battery level');
        const hasPitch = columns.includes('Pitch');
        const hasTotalMileage = columns.includes('Total mileage');

        const noDatetime = !columns.includes('datetime');
        const noExtra = !columns.includes('extra');
        const noSplitDateTime = !(columns.includes('date') && columns.includes('time'));

        return hasDate && hasBatteryLevel && hasPitch && hasTotalMileage &&
               noDatetime && noExtra && noSplitDateTime;
    }

    /**
     * Check if CSV is WheelLog format
     * Characteristics:
     * - Separate 'date' and 'time' columns (lowercase)
     * - NO 'extra' column
     * - NO 'datetime' column
     * - Has typical WheelLog columns like 'speed', 'voltage', etc.
     */
    static isWheelLog(columns) {
        const hasDate = columns.includes('date');
        const hasTime = columns.includes('time');
        const noExtra = !columns.includes('extra');
        const noDatetime = !columns.includes('datetime');

        // Require at least one WheelLog-specific column
        const hasWheelLogCols = columns.some(col =>
            ['speed', 'voltage', 'current', 'battery_level', 'pwm'].includes(col)
        );

        return hasDate && hasTime && noExtra && noDatetime && hasWheelLogCols;
    }

    /**
     * Get format display name
     * @param {string} format - Internal format name
     * @returns {string} Display name
     */
    static getDisplayName(format) {
        const names = {
            'EUCWorld': 'EUC World',
            'WheelLog': 'WheelLog',
            'DarknessBot': 'DarknessBot',
            'Unknown': 'Unknown Format'
        };
        return names[format] || format;
    }

    /**
     * Get format icon path
     * @param {string} format - Internal format name
     * @returns {string} Icon file path
     */
    static getIconPath(format) {
        const icons = {
            'EUCWorld': 'assets/icons/ew.png',
            'WheelLog': 'assets/icons/wl.png',
            'DarknessBot': 'assets/icons/db.png'
        };
        return icons[format] || null;
    }
}

// Export as default
export default FormatDetector;
