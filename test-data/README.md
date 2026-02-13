# Test CSV Files for PWM Mode Testing

## PWM Mode Detection Logic

The first 10 valid PWM values are averaged:
- **avg < 50 → Mode 1**: 0% = safe, 100% = danger (skull at 100%)
- **avg >= 50 → Mode 2**: 100% = safe, 0% = danger (skull at 0%)
- **Flip** applies `100 - value` transformation to every PWM value

## Test Files & Expected Results

### `test-eucworld-mode1.csv` — EUC World, Mode 1
| | PWM values (safety_margin column) | Detected Mode |
|-|-|-|
| Raw data | 10, 12, 15, 18, 20, 22, 25, 28, 30, 32... | **Mode 1** (avg=21.2) |
| No flip | Chart shows 10–45% range | Low = safe |
| With flip | Chart shows 55–90% range (each value becomes 100-x) | High = safe |

### `test-eucworld-mode2.csv` — EUC World, Mode 2
| | PWM values (safety_margin column) | Detected Mode |
|-|-|-|
| Raw data | 90, 88, 85, 82, 78, 75, 72, 68, 65, 62... | **Mode 2** (avg=78.5) |
| No flip | Chart shows 55–90% range | High = safe |
| With flip | Chart shows 10–45% range (each value becomes 100-x) | Low = safe |

### `test-wheellog-mode1.csv` — WheelLog, Mode 1
| | PWM values (pwm column) | Detected Mode |
|-|-|-|
| Raw data | 5, 8, 12, 15, 18, 22, 25, 30, 35, 38... | **Mode 1** (avg=20.8) |
| No flip | Chart shows 5–40% range | Low = safe |
| With flip | Chart shows 60–95% range (each value becomes 100-x) | High = safe |

### `test-darknessbot-mode2.csv` — DarknessBot, Mode 2
| | PWM values (PWM column) | Detected Mode |
|-|-|-|
| Raw data | 95, 92, 88, 85, 82, 78, 75, 70, 68, 65... | **Mode 2** (avg=79.8) |
| No flip | Chart shows 58–95% range | High = safe |
| With flip | Chart shows 5–42% range (each value becomes 100-x) | Low = safe |

## All Files Share

- **20 data points** — easy to count and verify
- **GPS route**: Sydney area (-33.856 to -33.853, 151.215 to 151.221)
- **Speed profile**: 0 → ramp up to 45 km/h → ramp down to 0 (bell curve)
- **Battery**: 95% → 78% (gentle drain)
- **Voltage**: ~130V → ~127V → ~130V
- **Temperature**: 25°C → 36°C (gradual rise)

## Verification Checklist

For each file:
1. Load file → check console for `PWM Mode Auto-Detection` log
2. Confirm detected mode matches table above
3. Check Battery & PWM chart — PWM values should match "No flip" row
4. Toggle PWM flip ON → PWM values should match "With flip" row
5. Toggle PWM flip OFF → values return to original
6. GPS map shows short route in Sydney
7. Speed chart shows bell-curve shape (0 → 45 → 0)
8. No console errors
