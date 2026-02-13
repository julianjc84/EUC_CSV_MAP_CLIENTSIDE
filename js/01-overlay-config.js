// Global Overlay Configuration
// Single source of truth for all overlay styling, icons, and behavior
// Used by both GPS map markers and chart overlay markers

window.EUCOverlayConfig = {
    // Overlay definitions with consistent styling
    overlays: {
        maxSpeed: {
            id: 'maxSpeed',
            icon: '🚀',
            label: 'Max Speed',
            title: 'Maximum speed reached',
            color: 'linear-gradient(135deg, #ff6b35, #f7931e)',
            shadowColor: 'rgba(255,107,53,0.6)',
            animation: 'rocketPulse',
            duration: '3s',
            unit: ' km/h',
            decimals: 1,
            mapKey: 'maxSpeed',
            chartKey: 'maxSpeed'
        },
        maxPower: {
            id: 'maxPower',
            icon: '🔌',
            label: 'Max Power',
            title: 'Maximum power consumption',
            color: 'linear-gradient(135deg, #ffc107, #e0a800)',
            shadowColor: 'rgba(255,193,7,0.6)',
            animation: 'plugPulse',
            duration: '3s',
            unit: ' W',
            decimals: 0,
            mapKey: 'maxPower',
            chartKey: 'maxPower'
        },
        maxCurrent: {
            id: 'maxCurrent',
            icon: '⚡',
            label: 'Max Current',
            title: 'Maximum current draw',
            color: 'linear-gradient(135deg, #17a2b8, #138496)',
            shadowColor: 'rgba(23,162,184,0.6)',
            animation: 'currentPulse',
            duration: '3s',
            unit: ' A',
            decimals: 1,
            mapKey: 'maxCurrent',
            chartKey: 'maxCurrent'
        },
        maxElevation: {
            id: 'maxElevation',
            icon: '🏔️',
            label: 'Max Elevation',
            title: 'Maximum elevation reached',
            color: 'linear-gradient(135deg, #6f7d86, #8b9aa8)',
            shadowColor: 'rgba(111,125,134,0.6)',
            animation: 'mountainPulse',
            duration: '3s',
            unit: ' m',
            decimals: 0,
            mapKey: 'maxElevation',
            chartKey: 'maxAltitude'
        },
        minElevation: {
            id: 'minElevation',
            icon: '⛰️',
            label: 'Min Elevation',
            title: 'Minimum elevation reached',
            color: 'linear-gradient(135deg, #4a5f6f, #5d7a8c)',
            shadowColor: 'rgba(74,95,111,0.6)',
            animation: 'mountainPulse',
            duration: '3s',
            unit: ' m',
            decimals: 0,
            mapKey: 'minElevation',
            chartKey: 'minAltitude'
        },
        maxMotorTemp: {
            id: 'maxMotorTemp',
            icon: '🌡️',
            label: 'Max Motor Temp',
            title: 'Maximum motor temperature',
            color: 'linear-gradient(135deg, #dc3545, #c82333)',
            shadowColor: 'rgba(220,53,69,0.6)',
            animation: 'tempPulse',
            duration: '3s',
            unit: ' °C',
            decimals: 1,
            mapKey: 'maxMotorTemp',
            chartKey: 'maxTemperature'
        },
        maxControllerTemp: {
            id: 'maxControllerTemp',
            icon: '🌡️',
            label: 'Max Controller Temp',
            title: 'Maximum controller temperature',
            color: 'linear-gradient(135deg, #fd7e14, #e55a00)',
            shadowColor: 'rgba(253,126,20,0.6)',
            animation: 'tempPulse',
            duration: '3s',
            unit: ' °C',
            decimals: 1,
            mapKey: 'maxControllerTemp',
            chartKey: 'maxTemperature'
        },
        maxBatteryTemp: {
            id: 'maxBatteryTemp',
            icon: '🌡️',
            label: 'Max Battery Temp',
            title: 'Maximum battery temperature',
            color: 'linear-gradient(135deg, #ff4757, #ff3742)',
            shadowColor: 'rgba(255,71,87,0.6)',
            animation: 'firePulse',
            duration: '3s',
            unit: ' °C',
            decimals: 1,
            mapKey: 'maxBatteryTemp',
            chartKey: 'maxTemperature'
        },
        minBattery: {
            id: 'minBattery',
            icon: '🪫',
            label: 'Battery Min',
            title: 'Minimum battery level reached',
            color: 'linear-gradient(135deg, #dc3545, #bd2130)',
            shadowColor: 'rgba(220,53,69,0.6)',
            animation: 'batteryMinPulse',
            duration: '3s',
            unit: ' %',
            decimals: 1,
            mapKey: 'minBattery',
            chartKey: 'minBattery'
        },
        safetyMarginMin: {
            id: 'safetyMarginMin',
            icon: '🛡️',
            label: 'PWM Min',
            title: 'Minimum PWM reached',
            color: 'linear-gradient(135deg, #ffc107, #e0a800)',
            shadowColor: 'rgba(255,193,7,0.6)',
            animation: 'shieldPulse',
            duration: '3s',
            unit: ' %',
            decimals: 1,
            mapKey: 'safetyMarginMin',
            chartKey: 'safetyMarginMin'
        },
        minVoltage: {
            id: 'minVoltage',
            icon: '⚡',
            label: 'Voltage Min',
            title: 'Minimum voltage reached',
            color: 'linear-gradient(135deg, #e74c3c, #c0392b)',
            shadowColor: 'rgba(231,76,60,0.6)',
            animation: 'voltagePulse',
            duration: '3s',
            unit: ' V',
            decimals: 1,
            mapKey: 'minVoltage',
            chartKey: 'minVoltage'
        },
        lowSafety: {
            id: 'lowSafety',
            icon: '💀',
            label: 'Critical Safety',
            title: 'Critical safety margin point',
            color: 'black',
            shadowColor: 'rgba(0,0,0,0.7)',
            animation: 'skullPulse',
            duration: '3s',
            unit: ' %',
            decimals: 1,
            mapKey: 'lowSafety',
            chartKey: 'lowSafety'
        },
        zeroSafety: {
            id: 'zeroSafety',
            icon: '💀',
            label: 'Critical Safety',
            title: 'Critical safety margin point (PWM ≤ 5%)',
            color: 'black',
            shadowColor: 'rgba(0,0,0,0.7)',
            animation: 'skullPulse',
            duration: '3s',
            unit: ' %',
            decimals: 1,
            mapKey: 'zeroSafety',
            chartKey: 'zeroSafety'
        },
        maxTilt: {
            id: 'maxTilt',
            icon: '↗️',
            label: 'Max Tilt',
            title: 'Maximum tilt reached',
            color: 'linear-gradient(135deg, #FF6B35, #e55a00)',
            shadowColor: 'rgba(255,107,53,0.6)',
            animation: 'tiltPulse',
            duration: '3s',
            unit: '°',
            decimals: 1,
            mapKey: 'maxTilt',
            chartKey: 'maxTilt'
        },
        minTilt: {
            id: 'minTilt',
            icon: '↙️',
            label: 'Min Tilt',
            title: 'Minimum tilt reached',
            color: 'linear-gradient(135deg, #4ECDC4, #3db8b0)',
            shadowColor: 'rgba(78,205,196,0.6)',
            animation: 'tiltPulse',
            duration: '3s',
            unit: '°',
            decimals: 1,
            mapKey: 'minTilt',
            chartKey: 'minTilt'
        },
        maxRoll: {
            id: 'maxRoll',
            icon: '↪️',
            label: 'Max Roll',
            title: 'Maximum roll reached',
            color: 'linear-gradient(135deg, #9B59B6, #8E44AD)',
            shadowColor: 'rgba(155,89,182,0.6)',
            animation: 'rollPulse',
            duration: '3s',
            unit: '°',
            decimals: 1,
            mapKey: 'maxRoll',
            chartKey: 'maxRoll'
        },
        minRoll: {
            id: 'minRoll',
            icon: '↩️',
            label: 'Min Roll',
            title: 'Minimum roll reached',
            color: 'linear-gradient(135deg, #E74C3C, #C0392B)',
            shadowColor: 'rgba(231,76,60,0.6)',
            animation: 'rollPulse',
            duration: '3s',
            unit: '°',
            decimals: 1,
            mapKey: 'minRoll',
            chartKey: 'minRoll'
        }
    },

    // Animation keyframes - consistent across map and charts
    animations: {
        rocketPulse: `
            @keyframes rocketPulse {
                0% { transform: scale(1) rotate(0deg); box-shadow: 0 3px 10px rgba(255,107,53,0.6); }
                25% { transform: scale(1.1) rotate(-2deg); box-shadow: 0 4px 12px rgba(255,107,53,0.7); }
                50% { transform: scale(1.2) rotate(2deg); box-shadow: 0 5px 15px rgba(255,107,53,0.9); }
                75% { transform: scale(1.1) rotate(-1deg); box-shadow: 0 4px 12px rgba(255,107,53,0.7); }
                100% { transform: scale(1) rotate(0deg); box-shadow: 0 3px 10px rgba(255,107,53,0.6); }
            }`,
        plugPulse: `
            @keyframes plugPulse {
                0% { transform: scale(1); box-shadow: 0 3px 10px rgba(255,193,7,0.6); }
                50% { transform: scale(1.15); box-shadow: 0 5px 15px rgba(255,193,7,0.9); }
                100% { transform: scale(1); box-shadow: 0 3px 10px rgba(255,193,7,0.6); }
            }`,
        currentPulse: `
            @keyframes currentPulse {
                0% { transform: scale(1) rotate(0deg); box-shadow: 0 3px 10px rgba(23,162,184,0.6); }
                25% { transform: scale(1.1) rotate(-3deg); box-shadow: 0 4px 12px rgba(23,162,184,0.7); }
                50% { transform: scale(1.2) rotate(3deg); box-shadow: 0 5px 15px rgba(23,162,184,0.9); }
                75% { transform: scale(1.1) rotate(-2deg); box-shadow: 0 4px 12px rgba(23,162,184,0.7); }
                100% { transform: scale(1) rotate(0deg); box-shadow: 0 3px 10px rgba(23,162,184,0.6); }
            }`,
        mountainPulse: `
            @keyframes mountainPulse {
                0% { transform: scale(1); box-shadow: 0 3px 10px rgba(111,125,134,0.6); }
                50% { transform: scale(1.15); box-shadow: 0 5px 15px rgba(111,125,134,0.8); }
                100% { transform: scale(1); box-shadow: 0 3px 10px rgba(111,125,134,0.6); }
            }`,
        tempPulse: `
            @keyframes tempPulse {
                0% { transform: scale(1); box-shadow: 0 3px 10px rgba(220,53,69,0.6); }
                50% { transform: scale(1.2); box-shadow: 0 5px 15px rgba(220,53,69,0.8); }
                100% { transform: scale(1); box-shadow: 0 3px 10px rgba(220,53,69,0.6); }
            }`,
        firePulse: `
            @keyframes firePulse {
                0% { transform: scale(1); box-shadow: 0 3px 10px rgba(255,71,87,0.6), inset 0 0 10px rgba(255,255,255,0.3); }
                50% { transform: scale(1.25); box-shadow: 0 5px 20px rgba(255,71,87,0.9), inset 0 0 15px rgba(255,255,255,0.5); }
                100% { transform: scale(1); box-shadow: 0 3px 10px rgba(255,71,87,0.6), inset 0 0 10px rgba(255,255,255,0.3); }
            }`,
        batteryMinPulse: `
            @keyframes batteryMinPulse {
                0% { transform: scale(1); box-shadow: 0 3px 10px rgba(220,53,69,0.6); opacity: 0.9; }
                33% { transform: scale(0.85); box-shadow: 0 2px 8px rgba(220,53,69,0.4); opacity: 0.6; }
                66% { transform: scale(1.1); box-shadow: 0 4px 12px rgba(220,53,69,0.8); opacity: 1; }
                100% { transform: scale(1); box-shadow: 0 3px 10px rgba(220,53,69,0.6); opacity: 0.9; }
            }`,
        shieldPulse: `
            @keyframes shieldPulse {
                0% { transform: scale(1); box-shadow: 0 3px 10px rgba(255,193,7,0.6); }
                50% { transform: scale(1.15); box-shadow: 0 5px 15px rgba(255,193,7,0.9); }
                100% { transform: scale(1); box-shadow: 0 3px 10px rgba(255,193,7,0.6); }
            }`,
        voltagePulse: `
            @keyframes voltagePulse {
                0% { transform: scale(1) rotate(0deg); box-shadow: 0 3px 10px rgba(231,76,60,0.6); }
                25% { transform: scale(1.1) rotate(-3deg); box-shadow: 0 4px 12px rgba(231,76,60,0.7); }
                50% { transform: scale(1.2) rotate(3deg); box-shadow: 0 5px 15px rgba(231,76,60,0.9); }
                75% { transform: scale(1.1) rotate(-2deg); box-shadow: 0 4px 12px rgba(231,76,60,0.7); }
                100% { transform: scale(1) rotate(0deg); box-shadow: 0 3px 10px rgba(231,76,60,0.6); }
            }`,
        skullPulse: `
            @keyframes skullPulse {
                0% { transform: scale(1); box-shadow: 0 3px 10px rgba(0,0,0,0.7); }
                50% { transform: scale(1.3); box-shadow: 0 5px 20px rgba(0,0,0,0.9); }
                100% { transform: scale(1); box-shadow: 0 3px 10px rgba(0,0,0,0.7); }
            }`,
        tiltPulse: `
            @keyframes tiltPulse {
                0% { transform: scale(1) rotate(0deg); box-shadow: 0 3px 10px rgba(255,107,53,0.6); }
                50% { transform: scale(1.15) rotate(3deg); box-shadow: 0 5px 15px rgba(255,107,53,0.8); }
                100% { transform: scale(1) rotate(0deg); box-shadow: 0 3px 10px rgba(255,107,53,0.6); }
            }`,
        rollPulse: `
            @keyframes rollPulse {
                0% { transform: scale(1) rotate(0deg); box-shadow: 0 3px 10px rgba(155,89,182,0.6); }
                50% { transform: scale(1.15) rotate(-3deg); box-shadow: 0 5px 15px rgba(155,89,182,0.8); }
                100% { transform: scale(1) rotate(0deg); box-shadow: 0 3px 10px rgba(155,89,182,0.6); }
            }`
    },

    // Utility functions for consistent behavior
    utils: {
        // Get overlay configuration by ID
        getOverlay: function(overlayId) {
            return window.EUCOverlayConfig.overlays[overlayId] || null;
        },

        // Format value with consistent units and decimals
        formatValue: function(value, overlayId) {
            const overlay = this.getOverlay(overlayId);
            if (!overlay) return value?.toString() || 'N/A';

            // Handle null/undefined/NaN values
            if (value === null || value === undefined || isNaN(value)) {
                return 'N/A';
            }

            const formatted = value.toFixed(overlay.decimals);
            return formatted + overlay.unit;
        },

        // Get map overlay ID from chart overlay key
        getMapKey: function(chartKey) {
            for (const [id, overlay] of Object.entries(window.EUCOverlayConfig.overlays)) {
                if (overlay.chartKey === chartKey) {
                    return overlay.mapKey;
                }
            }
            return null;
        },

        // Get chart overlay key from map overlay ID
        getChartKey: function(mapKey) {
            for (const [id, overlay] of Object.entries(window.EUCOverlayConfig.overlays)) {
                if (overlay.mapKey === mapKey) {
                    return overlay.chartKey;
                }
            }
            return null;
        },

        // Create consistent marker HTML for maps
        createMarkerHTML: function(overlayId, size = 24) {
            const overlay = this.getOverlay(overlayId);
            if (!overlay) return '';

            // Use CSS custom properties to store animation settings
            // This allows CSS to conditionally apply animations via the marker-animations-enabled class
            return `<div style="--animation-name: ${overlay.animation}; --animation-duration: ${overlay.duration}; background: ${overlay.color}; width: ${size}px; height: ${size}px; border-radius: 50%; border: 2px solid white; box-shadow: 0 3px 10px ${overlay.shadowColor}; display: flex; align-items: center; justify-content: center; font-size: ${Math.floor(size * 0.6)}px;">${overlay.icon}</div>`;
        },

        // Install CSS animations
        installAnimations: function() {
            if (document.getElementById('euc-overlay-animations')) {
                return; // Already installed
            }

            const style = document.createElement('style');
            style.id = 'euc-overlay-animations';
            style.textContent = Object.values(window.EUCOverlayConfig.animations).join('\n');
            document.head.appendChild(style);
            
            // Silent unless debug enabled
        }
    }
};

// Route overlay registry — data-driven route coloring for the GPS map
// Each entry defines how to color the route when that overlay is active.
// colorMode: 'custom' uses existing hand-tuned color functions,
//            'scale' interpolates linearly between colorStops,
//            'diverging' centers on 0 for bipolar data (tilt, roll).
window.EUCOverlayConfig.routes = {
    wheel_speed: {
        id: 'wheel_speed',
        label: 'Speed (Wheel)',
        icon: '\u{1F3C3}',
        group: 'Speed & Altitude',
        field: 'wheel_speed',
        unit: ' km/h',
        decimals: 1,
        colorMode: 'custom',
        colorFn: 'getSpeedColor',
        legendGradient: 'linear-gradient(to right, #808080, rgb(0,255,0), rgb(255,255,0), rgb(255,165,0), rgb(255,0,0), rgb(128,128,128), rgb(0,0,0))',
        legendLabels: ['0', '30', '40', '50', '70', '100+'],
        order: 0
    },
    speed: {
        id: 'speed',
        label: 'Speed (GPS)',
        icon: '\u{1F6F0}\uFE0F',
        group: 'Speed & Altitude',
        field: 'speed',
        unit: ' km/h',
        decimals: 1,
        colorMode: 'custom',
        colorFn: 'getSpeedColor',
        legendGradient: 'linear-gradient(to right, #808080, rgb(0,255,0), rgb(255,255,0), rgb(255,165,0), rgb(255,0,0), rgb(128,128,128), rgb(0,0,0))',
        legendLabels: ['0', '30', '40', '50', '70', '100+'],
        order: 1
    },
    elevation: {
        id: 'elevation',
        label: 'Elevation',
        icon: '\u{1F3D4}\uFE0F',
        group: 'Speed & Altitude',
        field: 'altitude',
        unit: ' m',
        decimals: 0,
        colorMode: 'custom',
        colorFn: 'getElevationColor',
        needsMinMax: true,
        legendGradient: 'linear-gradient(to right, rgb(173,216,230), rgb(0,0,139))',
        order: 2
    },
    battery: {
        id: 'battery',
        label: 'Battery %',
        icon: '\u{1F50B}',
        group: 'Battery & PWM',
        field: 'battery',
        unit: '%',
        decimals: 1,
        colorMode: 'custom',
        colorFn: 'getBatteryColor',
        legendGradient: 'linear-gradient(to right, rgb(240,255,240), rgb(34,139,34))',
        legendLabels: ['0%', '100%'],
        order: 0
    },
    pwm: {
        id: 'pwm',
        label: 'PWM / Safety',
        icon: '\u26A0\uFE0F',
        group: 'Battery & PWM',
        field: 'pwm',
        unit: '%',
        decimals: 1,
        colorMode: 'custom',
        colorFn: 'getPWMColor',
        needsPWMFlip: true,
        legendGradient: 'linear-gradient(to right, rgb(0,0,0), rgb(64,64,64), rgb(255,215,0), rgb(255,215,0))',
        legendLabels: ['0%', '10%', '20%', '100%'],
        order: 1
    },
    power: {
        id: 'power',
        label: 'Power',
        icon: '\u26A1',
        group: 'Power & Energy',
        field: 'power',
        unit: ' W',
        decimals: 0,
        colorMode: 'scale',
        colorStops: [[0,[0,0,255]], [0.25,[0,255,255]], [0.5,[0,255,0]], [0.75,[255,255,0]], [1,[255,0,0]]],
        legendGradient: 'linear-gradient(to right, rgb(0,0,255), rgb(0,255,255), rgb(0,255,0), rgb(255,255,0), rgb(255,0,0))',
        order: 0
    },
    energy_consumption: {
        id: 'energy_consumption',
        label: 'Energy Consumption',
        icon: '\u{1F4CA}',
        group: 'Power & Energy',
        field: 'energy_consumption',
        unit: ' Wh/km',
        decimals: 1,
        colorMode: 'scale',
        colorStops: [[0,[0,180,0]], [0.5,[255,255,0]], [1,[255,0,0]]],
        legendGradient: 'linear-gradient(to right, rgb(0,180,0), rgb(255,255,0), rgb(255,0,0))',
        order: 1
    },
    voltage: {
        id: 'voltage',
        label: 'Voltage',
        icon: '\u{1F50C}',
        group: 'Electrical',
        field: 'voltage',
        unit: ' V',
        decimals: 1,
        colorMode: 'scale',
        colorStops: [[0,[220,50,50]], [0.5,[255,255,0]], [1,[50,200,50]]],
        legendGradient: 'linear-gradient(to right, rgb(220,50,50), rgb(255,255,0), rgb(50,200,50))',
        order: 0
    },
    current: {
        id: 'current',
        label: 'Current',
        icon: '\u{1F4A1}',
        group: 'Electrical',
        field: 'current',
        unit: ' A',
        decimals: 1,
        colorMode: 'scale',
        colorStops: [[0,[0,0,255]], [0.25,[0,255,255]], [0.5,[0,255,0]], [0.75,[255,255,0]], [1,[255,0,0]]],
        legendGradient: 'linear-gradient(to right, rgb(0,0,255), rgb(0,255,255), rgb(0,255,0), rgb(255,255,0), rgb(255,0,0))',
        order: 1
    },
    temp: {
        id: 'temp',
        label: 'System Temp',
        icon: '\u{1F321}\uFE0F',
        group: 'Temperature',
        field: 'temp',
        unit: ' \u00B0C',
        decimals: 1,
        colorMode: 'scale',
        colorStops: [[0,[0,0,255]], [0.25,[0,200,200]], [0.5,[0,200,0]], [0.75,[255,165,0]], [1,[255,0,0]]],
        legendGradient: 'linear-gradient(to right, rgb(0,0,255), rgb(0,200,200), rgb(0,200,0), rgb(255,165,0), rgb(255,0,0))',
        order: 0
    },
    temp_motor: {
        id: 'temp_motor',
        label: 'Motor Temp',
        icon: '\u{1F321}\uFE0F',
        group: 'Temperature',
        field: 'temp_motor',
        unit: ' \u00B0C',
        decimals: 1,
        colorMode: 'scale',
        colorStops: [[0,[0,0,255]], [0.25,[0,200,200]], [0.5,[0,200,0]], [0.75,[255,165,0]], [1,[255,0,0]]],
        legendGradient: 'linear-gradient(to right, rgb(0,0,255), rgb(0,200,200), rgb(0,200,0), rgb(255,165,0), rgb(255,0,0))',
        order: 1
    },
    temp_batt: {
        id: 'temp_batt',
        label: 'Battery Temp',
        icon: '\u{1F321}\uFE0F',
        group: 'Temperature',
        field: 'temp_batt',
        unit: ' \u00B0C',
        decimals: 1,
        colorMode: 'scale',
        colorStops: [[0,[0,0,255]], [0.25,[0,200,200]], [0.5,[0,200,0]], [0.75,[255,165,0]], [1,[255,0,0]]],
        legendGradient: 'linear-gradient(to right, rgb(0,0,255), rgb(0,200,200), rgb(0,200,0), rgb(255,165,0), rgb(255,0,0))',
        order: 2
    },
    tilt: {
        id: 'tilt',
        label: 'Tilt',
        icon: '\u2197\uFE0F',
        group: 'Orientation',
        field: 'tilt',
        unit: '\u00B0',
        decimals: 1,
        colorMode: 'diverging',
        colorStops: [[0,[0,0,255]], [0.25,[0,200,200]], [0.5,[200,200,200]], [0.75,[255,165,0]], [1,[255,0,0]]],
        legendGradient: 'linear-gradient(to right, rgb(0,0,255), rgb(0,200,200), rgb(200,200,200), rgb(255,165,0), rgb(255,0,0))',
        order: 0
    },
    roll: {
        id: 'roll',
        label: 'Roll',
        icon: '\u21AA\uFE0F',
        group: 'Orientation',
        field: 'roll',
        unit: '\u00B0',
        decimals: 1,
        colorMode: 'diverging',
        colorStops: [[0,[155,89,182]], [0.25,[200,150,220]], [0.5,[200,200,200]], [0.75,[100,200,150]], [1,[0,150,80]]],
        legendGradient: 'linear-gradient(to right, rgb(155,89,182), rgb(200,150,220), rgb(200,200,200), rgb(100,200,150), rgb(0,150,80))',
        order: 1
    }
};

// Group ordering for the route overlay UI panel
window.EUCOverlayConfig.routeGroups = [
    'Speed & Altitude',
    'Battery & PWM',
    'Power & Energy',
    'Electrical',
    'Temperature',
    'Orientation'
];

// Install animations immediately when config loads
window.EUCOverlayConfig.utils.installAnimations();

// Silent initialization - overlay config loaded