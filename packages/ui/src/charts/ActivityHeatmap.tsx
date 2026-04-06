"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type HeatmapData = Record<string, number>;

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const LEVEL_COLORS = ["#161b22", "#0e4429", "#006d32", "#26a641", "#39d353"];
const BASE_CELL_SIZE = 11;
const CELL_GAP = 3;
const DAY_LABEL_WIDTH = 28;
const MAX_CELL_SIZE = 16;

interface CalendarCell {
  date: Date;
  key: string;
  count: number;
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

function endOfWeek(date: Date) {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  copy.setDate(copy.getDate() + (6 - copy.getDay()));
  return copy;
}

function buildCalendar(data: HeatmapData, year: number) {
  const today = new Date();
  const start = new Date(year, 0, 1);
  const end = year === today.getFullYear() ? today : new Date(year, 11, 31);
  start.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);

  const calendarStart = startOfWeek(start);
  const calendarEnd = endOfWeek(end);
  const totalWeeks = Math.max(
    1,
    Math.ceil((calendarEnd.getTime() - calendarStart.getTime() + 24 * 60 * 60 * 1000) / (7 * 24 * 60 * 60 * 1000))
  );

  const weeks: CalendarCell[][] = [];

  for (let weekIndex = 0; weekIndex < totalWeeks; weekIndex += 1) {
    const week: CalendarCell[] = [];

    for (let dayIndex = 0; dayIndex < 7; dayIndex += 1) {
      const date = new Date(calendarStart);
      date.setDate(calendarStart.getDate() + weekIndex * 7 + dayIndex);
      const key = toDateKey(date);

      week.push({
        date,
        key,
        count: data[key] ?? 0,
      });
    }

    weeks.push(week);
  }

  const monthLabels = weeks.map((week, index) => {
    const firstDayInYear = week.find((day) => day.date.getFullYear() === year && day.date.getDate() <= 7);
    if (!firstDayInYear) return "";

    if (index > 0) {
      const previous = weeks[index - 1]?.find((day) => day.date.getFullYear() === year && day.date.getDate() <= 7);
      if (previous?.date.getMonth() === firstDayInYear.date.getMonth()) {
        return "";
      }
    }

    return MONTH_LABELS[firstDayInYear.date.getMonth()] ?? "";
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
  const [containerWidth, setContainerWidth] = useState(0);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const yearlyData = useMemo(
    () => Object.fromEntries(Object.entries(data).filter(([date]) => date.startsWith(`${year}-`))),
    [data, year]
  );

  const totalContributions = useMemo(
    () => Object.values(yearlyData).reduce((sum, count) => sum + count, 0),
    [yearlyData]
  );

  const { weeks, monthLabels } = useMemo(() => buildCalendar(yearlyData, year), [yearlyData, year]);

  useEffect(() => {
    const element = containerRef.current;
    if (!element || typeof ResizeObserver === "undefined") return;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      setContainerWidth(entry.contentRect.width);
    });

    observer.observe(element);
    setContainerWidth(element.getBoundingClientRect().width);

    return () => observer.disconnect();
  }, []);

  const cellSize = useMemo(() => {
    if (weeks.length === 0 || containerWidth <= 0) return BASE_CELL_SIZE;

    const totalGapWidth = Math.max(0, weeks.length - 1) * CELL_GAP;
    const availableWidth = Math.max(0, containerWidth - DAY_LABEL_WIDTH - 10 - totalGapWidth);
    const responsiveSize = Math.floor(availableWidth / weeks.length);

    return Math.max(BASE_CELL_SIZE, Math.min(MAX_CELL_SIZE, responsiveSize || BASE_CELL_SIZE));
  }, [containerWidth, weeks.length]);

  const gridMinWidth = DAY_LABEL_WIDTH + weeks.length * cellSize + Math.max(0, weeks.length - 1) * CELL_GAP;

  return (
    <div
      ref={containerRef}
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
            {totalContributions} contributions in {year}
          </p>
        </div>
      </div>

      <div style={{ overflowX: "auto", paddingBottom: 4 }}>
        <div style={{ minWidth: gridMinWidth, width: "100%" }}>
          <div style={{ display: "grid", gridTemplateColumns: `${DAY_LABEL_WIDTH}px 1fr`, gap: 10 }}>
            <div />
            <div
              style={{
                display: "grid",
                gridTemplateColumns: `repeat(${weeks.length}, ${cellSize}px)`,
                gap: CELL_GAP,
                marginBottom: 6,
              }}
            >
              {monthLabels.map((label, index) => (
                <div
                  key={`${label}-${index}`}
                  style={{
                    width: cellSize,
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
                gridTemplateRows: `repeat(7, ${cellSize}px)`,
                gap: CELL_GAP,
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

            <div style={{ display: "flex", gap: CELL_GAP }}>
              {weeks.map((week, weekIndex) => (
                <div
                  key={`week-${weekIndex}`}
                  style={{
                    display: "grid",
                    gridTemplateRows: `repeat(7, ${cellSize}px)`,
                    gap: CELL_GAP,
                  }}
                >
                  {week.map((cell) => {
                    const level = getContributionLevel(cell.count);
                    const label = `${cell.count} contributions on ${cell.date.toLocaleDateString(undefined, {
                      weekday: "long",
                      month: "long",
                      day: "numeric",
                      year: "numeric",
                    })}`;

                    return (
                      <button
                        key={cell.key}
                        type="button"
                        onMouseEnter={(event) =>
                          setTooltip({
                            x: event.clientX,
                            y: event.clientY,
                            label,
                          })
                        }
                        onMouseLeave={() => setTooltip(null)}
                        onFocus={(event) =>
                          setTooltip({
                            x: event.currentTarget.getBoundingClientRect().left + 6,
                            y: event.currentTarget.getBoundingClientRect().top,
                            label,
                          })
                        }
                        onBlur={() => setTooltip(null)}
                        aria-label={`${cell.count} contributions on ${cell.key}`}
                        style={{
                          width: cellSize,
                          height: cellSize,
                          borderRadius: 2,
                          backgroundColor: LEVEL_COLORS[level],
                          border: "none",
                          padding: 0,
                          cursor: "pointer",
                          opacity: 1,
                          transition: "opacity 150ms ease",
                        }}
                      />
                    );
                  })}
                </div>
              ))}
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
                  width: cellSize,
                  height: cellSize,
                  borderRadius: 2,
                  backgroundColor: color,
                }}
              />
            ))}
            <span>More</span>
          </div>
        </div>
      </div>

      {tooltip && (
        <div
          style={{
            position: "fixed",
            left: tooltip.x + 12,
            top: tooltip.y - 12,
            zIndex: 50,
            maxWidth: 240,
            borderRadius: 8,
            background: "#111827",
            color: "#f9fafb",
            padding: "8px 10px",
            fontSize: 12,
            lineHeight: 1.4,
            boxShadow: "0 10px 25px rgba(0, 0, 0, 0.35)",
            pointerEvents: "none",
          }}
        >
          {tooltip.label}
        </div>
      )}
    </div>
  );
}
