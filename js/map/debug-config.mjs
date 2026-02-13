/**
 * Debug Configuration Module
 *
 * Centralized debug logging control to reduce console spam.
 * Set DEBUG flags to true to enable verbose logging for specific components.
 */

export const DEBUG = {
    // Core components
    MAP_CORE: false,           // Map initialization, route loading
    POSITION_TRACKER: false,   // Mouse tracking, position updates (VERY SPAMMY)
    ROUTE_RENDERER: false,     // Route segment creation
    MARKER_MANAGER: false,     // Marker registration

    // UI components
    UI_CONTROLS: false,        // Panel interactions, button clicks
    PRIVACY_FILTER: false,     // Privacy mode filtering
    POPUP_MANAGER: false,      // Popup display

    // Utilities
    MAP_UTILS: false,          // Segment averaging, PWM analysis
    RESOURCE_MANAGER: false,   // Resource registration and cleanup

    // Lifecycle events
    INIT: false,               // Initialization, DOM ready
    CLEANUP: false,            // Total wipe, cleanup operations
    DRAG_DROP: false,          // File drag and drop

    // Keep these enabled for important events
    ERRORS: true,              // Always show errors
    WARNINGS: true,            // Always show warnings
    CRITICAL: true             // Critical state changes
};

// Expose to window for easy runtime toggling
window.EUC_DEBUG = DEBUG;

// Silent load - use window.EUC_DEBUG to toggle debug flags
// Example: window.EUC_DEBUG.POSITION_TRACKER = true
