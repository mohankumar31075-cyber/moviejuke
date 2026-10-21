// Group scoring (PRD §6): plain points, points + speed bonus, speed-only in live.

export const SPEED_BONUS_CAP = 600; // bonus can never exceed this

export function scoreAnswer({ correct, timeMs, questionMs = 49000, scoring = 'plain', basePoints = 1000 }) {
  if (!correct) return 0;
  if (scoring === 'plain') return basePoints;
  // points + speed bonus (also used for 'speed' = bonus-heavy live default)
  const frac = Math.max(0, 1 - Math.min(timeMs, questionMs) / questionMs);
  const bonus = Math.min(SPEED_BONUS_CAP, Math.round(basePoints * 0.6 * frac));
  return basePoints + bonus;
}

export function passMarkFor(passMarks, subjectId, override) {
  if (override) return override;
  return passMarks?.bySubject?.[subjectId] ?? passMarks?.default ?? 80;
}
