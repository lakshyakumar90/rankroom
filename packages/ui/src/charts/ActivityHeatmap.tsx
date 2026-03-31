"use client";

import { useMemo, useState } from "react";

type HeatmapData = Record<string, number>;

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const LEVEL_COLORS = ["#161b22", "#0e4429", "#006d32", "#26a641", "#39d353"];

interface CalendarCell {
  date: Date;
  key: string;
  count: number;
  currentMonth: number;
}

function toDateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function getContributionLevel(count: number) {
  if (count <= 0) return 0;
  if (count <= 3) return 1;
  if (count <= 6) return 2;
  if (count <= 9) return 3;
  return 4;
}

function startOfWeek(date: Date) {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  copy.setDate(copy.getDate() - copy.getDay());
  return copy;
}

function buildCalendar(data: HeatmapData, year: number) {
  const today = new Date();
  const end = year === today.getFullYear() ? today : new Date(year, 11, 31);
  end.setHours(0, 0, 0, 0);

  const rangeStart = new Date(end);
  rangeStart.setDate(rangeStart.getDate() - 364);

  const calendarStart = startOfWeek(rangeStart);
  const weeks: CalendarCell[][] = [];

  for (let weekIndex = 0; weekIndex < 53; weekIndex += 1) {
    const week: CalendarCell[] = [];

    for (let dayIndex = 0; dayIndex < 7; dayIndex += 1) {
      const date = new Date(calendarStart);
      date.setDate(calendarStart.getDate() + weekIndex * 7 + dayIndex);
      const key = toDateKey(date);

      week.push({
        date,
        key,
        count: data[key] ?? 0,
        currentMonth: date.getMonth(),
      });
    }

    weeks.push(week);
  }

  const monthLabels = weeks.map((week, index) => {
    const anchor = week.find((day) => day.date.getDate() <= 7);
    if (!anchor) return "";
    if (index > 0) {
      const previousAnchor = weeks[index - 1]?.find((day) => day.date.getDate() <= 7);
      if (previousAnchor?.currentMonth === anchor.currentMonth) {
        return "";
      }
    }
    return MONTH_LABELS[anchor.currentMonth] ?? "";
  });

  return { weeks, monthLabels };
}

export function ActivityHeatmap({
  data,
  year,
  className,
}: {
  data: HeatmapData;
  year: number;
  className?: string;
}) {
  const [tooltip, setTooltip] = useState<{
    x: number;
    y: number;
    label: string;
  } | null>(null);

  const yearlyData = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(data).filter(([date]) => date.startsWith(`${year}-`))
      ),
    [data, year]
  );

  const totalContributions = useMemo(
    () => Object.values(yearlyData).reduce((sum, count) => sum + count, 0),
    [yearlyData]
  );

  const { weeks, monthLabels } = useMemo(
    () => buildCalendar(yearlyData, year),
    [yearlyData, year]
  );

  return (
    <div
      className={className}
      style={{
        background: "#0d1117",
        border: "1px solid #30363d",
        borderRadius: 24,
        padding: 20,
        color: "#e6edf3",
        position: "relative",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 16,
          marginBottom: 18,
        }}
      >
        <div>
          <p style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>Contributions</p>
          <p style={{ margin: "8px 0 0", color: "#9ba6b2", fontSize: 14 }}>
            {"🔥 "}
            {totalContributions} contributions in the last year
          </p>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "28px 1fr", gap: 10 }}>
        <div />
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(53, 11px)",
            gap: 3,
            marginBottom: 6,
          }}
        >
          {monthLabels.map((label, index) => (
            <div
              key={`${label}-${index}`}
              style={{
                width: 11,
                fontSize: 11,
                color: "#7d8590",
                transform: "translateY(-2px)",
              }}
            >
              {label}
            </div>
          ))}
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateRows: "repeat(7, 11px)",
            gap: 3,
            paddingTop: 2,
          }}
        >
          {DAY_LABELS.map((label, index) => (
            <div
              key={label}
              style={{
                fontSize: 10,
                lineHeight: "11px",
                color: index % 2 === 0 ? "#7d8590" : "transparent",
              }}
            >
              {label}
            </div>
          ))}
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(53, 11px)",
            gap: 3,
          }}
        >
          {weeks.flatMap((week) =>
            week.map((cell) => {
              const level = getContributionLevel(cell.count);
              return (
                <button
                  key={cell.key}
                  type="button"
                  onMouseEnter={(event) =>
                    setTooltip({
                      x: event.clientX,
                      y: event.clientY,
                      label: `${cell.count} contributions on ${cell.date.toLocaleDateString(undefined, {
                        weekday: "long",
                        month: "long",
                        day: "numeric",
                        year: "numeric",
                      })}`,
                    })
                  }
                  onMouseLeave={() => setTooltip(null)}
                  style={{
                    width: 11,
                    height: 11,
                    borderRadius: 2,
                    backgroundColor: LEVEL_COLORS[level],
                    border: "none",
                    padding: 0,
                    cursor: "pointer",
                    opacity: 1,
                    transition: "opacity 150ms ease",
                  }}
                  onFocus={(event) =>
                    setTooltip({
                      x: event.currentTarget.getBoundingClientRect().left + 6,
                      y: event.currentTarget.getBoundingClientRect().top,
                      label: `${cell.count} contributions on ${cell.date.toLocaleDateString(undefined, {
                        weekday: "long",
                        month: "long",
                        day: "numeric",
                        year: "numeric",
                      })}`,
                    })
                  }
                  onBlur={() => setTooltip(null)}
                  aria-label={`${cell.count} contributions on ${cell.key}`}
                />
              );
            })
          )}
        </div>
      </div>

      <div
        style={{
          marginTop: 16,
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-end",
          gap: 8,
          color: "#7d8590",
          fontSize: 11,
        }}
      >
        <span>Less</span>
        {LEVEL_COLORS.map((color) => (
          <span
            key={color}
            style={{
              display: "inline-block",
              width: 11,
              height: 11,
              borderRadius: 2,
              backgroundColor: color,
            }}
          />
        ))}
        <span>More</span>
      </div>

      {tooltip && (
        <div
          style={{
            position: "fixed",
            left: tooltip.x + 12,
            top: tooltip.y - 10,
            background: "#161b22",
            color: "#e6edf3",
            border: "1px solid #30363d",
            borderRadius: 8,
            padding: "8px 10px",
            fontSize: 12,
            pointerEvents: "none",
            zIndex: 60,
            boxShadow: "0 10px 30px rgba(0, 0, 0, 0.35)",
          }}
        >
          {tooltip.label}
        </div>
      )}
    </div>
  );
}
