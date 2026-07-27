import type { Mood } from "./types";

/**
 * Map a local hour to the machine's default mood. Boundaries are deliberately
 * loose interpretations of the day, not astronomy:
 *
 *   05:00–08:59  sunrise
 *   09:00–15:59  high noon
 *   16:00–18:59  golden hour
 *   19:00–21:59  dusk
 *   22:00–04:59  midnight
 */
export function moodForHour(hour: number): Mood {
  if (hour < 0 || hour > 23 || !Number.isInteger(hour)) {
    throw new Error(`hour must be an integer 0–23, got ${hour}`);
  }
  if (hour >= 5 && hour < 9) return "sunrise";
  if (hour >= 9 && hour < 16) return "high-noon";
  if (hour >= 16 && hour < 19) return "golden-hour";
  if (hour >= 19 && hour < 22) return "dusk";
  return "midnight";
}

/** The mood matching the visitor's clock right now. */
export function currentMood(now: Date = new Date()): Mood {
  return moodForHour(now.getHours());
}
