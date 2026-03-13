/**
 * Convert OSC gain value (0.0–1.0) to dB (0–65).
 */
export function oscToGainDb(osc: number): number {
  return Math.round(osc * 65);
}

/**
 * Convert gain dB (0–65) to OSC value (0.0–1.0).
 */
export function gainDbToOsc(db: number): number {
  return Math.max(0, Math.min(1, db / 65));
}

/**
 * Convert OSC volume value (0.0–1.0) to approximate dB.
 * TotalMix volume curve: 0.0 = -inf, ~0.82 = 0 dB, 1.0 = +6 dB.
 * This is an approximation for display purposes.
 */
export function oscToVolDb(osc: number): number {
  if (osc <= 0) return -Infinity;
  if (osc >= 1) return 6;
  if (osc >= 0.82) {
    // 0.82–1.0 maps to 0 dB to +6 dB
    return ((osc - 0.82) / 0.18) * 6;
  }
  // 0.0–0.82 maps to -inf to 0 dB (log-ish curve)
  // Approximate: use a power curve
  const normalized = osc / 0.82;
  return 20 * Math.log10(normalized);
}

/**
 * Format a volume OSC value as a human-readable dB string.
 */
export function formatVolume(osc: number): string {
  if (osc <= 0) return "-inf";
  const db = oscToVolDb(osc);
  if (db <= -60) return "-inf";
  const sign = db >= 0 ? "+" : "";
  return `${sign}${db.toFixed(1)} dB`;
}

/**
 * Format a gain OSC value as a human-readable dB string.
 */
export function formatGain(osc: number): string {
  return `${oscToGainDb(osc)} dB`;
}
