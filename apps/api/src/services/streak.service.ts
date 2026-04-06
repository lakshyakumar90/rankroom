type Heatmap = Record<string, number>;

export interface StreakSummary {
  currentStreak: number;
  longestStreak: number;
  lastActiveDate: Date | null;
}

function normalizeDateOnly(value: string) {
  return value.slice(0, 10);
}

function addDays(input: Date, days: number) {
  const next = new Date(input);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

export function computeStreakFromHeatmap(heatmap: Heatmap): StreakSummary {
  const activeDates = Object.entries(heatmap)
    .filter(([, count]) => Number(count) > 0)
    .map(([date]) => normalizeDateOnly(date))
    .sort();

  if (activeDates.length === 0) {
    return { currentStreak: 0, longestStreak: 0, lastActiveDate: null };
  }

  let longestStreak = 0;
  let runningStreak = 0;
  let previousDate: Date | null = null;

  for (const dateKey of activeDates) {
    const currentDate = new Date(`${dateKey}T00:00:00.000Z`);
    if (previousDate) {
      const expectedNext = normalizeDateOnly(addDays(previousDate, 1).toISOString());
      runningStreak = expectedNext === dateKey ? runningStreak + 1 : 1;
    } else {
      runningStreak = 1;
    }

    longestStreak = Math.max(longestStreak, runningStreak);
    previousDate = currentDate;
  }

  const lastActiveDate = new Date(`${activeDates[activeDates.length - 1]}T00:00:00.000Z`);
  let currentStreak = 0;
  let cursor = new Date(lastActiveDate);
  const activeSet = new Set(activeDates);

  while (activeSet.has(normalizeDateOnly(cursor.toISOString()))) {
    currentStreak += 1;
    cursor = addDays(cursor, -1);
  }

  return { currentStreak, longestStreak, lastActiveDate };
}
