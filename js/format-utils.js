/**
 * Shared Formatting Utilities
 * DRY consolidation of formatting functions used across multiple modules.
 */

/**
 * Format duration from seconds to HH:MM:SS
 * @param {number} seconds - Duration in seconds
 * @returns {string} Formatted duration string
 */
export function formatDuration(seconds) {
    if (typeof seconds !== 'number' || seconds < 0 || isNaN(seconds)) {
        return 'N/A';
    }

    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Format timestamp to HH:MM:SS
 * @param {number} timestamp - Timestamp in milliseconds
 * @returns {string} Formatted time string
 */
export function formatTimestamp(timestamp) {
    const date = new Date(timestamp);
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const seconds = date.getSeconds().toString().padStart(2, '0');
    return `${hours}:${minutes}:${seconds}`;
}

/**
 * Format file size in bytes to human-readable string
 * @param {number} bytes - File size in bytes
 * @param {Object} [options] - Formatting options
 * @param {boolean} [options.uppercase=true] - Use uppercase units (KB vs kb)
 * @param {boolean} [options.space=true] - Space between number and unit (1.5 KB vs 1.5kb)
 * @returns {string} Formatted file size string
 */
export function formatFileSize(bytes, options = {}) {
    const { uppercase = true, space = true } = options;
    const sp = space ? ' ' : '';

    if (bytes < 1024) {
        const unit = uppercase ? 'B' : 'b';
        return `${bytes}${sp}${unit}`;
    } else if (bytes < 1024 * 1024) {
        const unit = uppercase ? 'KB' : 'kb';
        return `${(bytes / 1024).toFixed(1)}${sp}${unit}`;
    } else {
        const unit = uppercase ? 'MB' : 'mb';
        return `${(bytes / (1024 * 1024)).toFixed(2)}${sp}${unit}`;
    }
}
