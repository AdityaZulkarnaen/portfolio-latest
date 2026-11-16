"use client";

import { useMemo, useState } from "react";
import type { GitHubActivityData, ContributionDay } from "@/lib/github";
import { META_TYPE_BASE } from "@/lib/site-config";
import { activityCopy } from "./activity-copy";

type ActivityGridProps = {
  data: GitHubActivityData;
};

const MONTH_NAMES = [
  "JAN", "FEB", "MAR", "APR", "MAY", "JUN",
  "JUL", "AUG", "SEP", "OCT", "NOV", "DEC",
];

const MONTH_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function formatCount(num: number): string {
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function parseUTCDate(dateStr: string) {
  const parts = dateStr.split("-").map(Number);
  const y = parts[0];
  const m = parts[1];
  const d = parts[2];
  const date = new Date(Date.UTC(y, m - 1, d));
  return {
    dayOfWeek: date.getUTCDay(),
    month: date.getUTCMonth(),
    year: date.getUTCFullYear(),
    day: date.getUTCDate(),
  };
}

function formatDate(dateStr: string) {
  const parts = dateStr.split("-").map(Number);
  if (parts.length === 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) {
    return `${MONTH_SHORT[parts[1] - 1]} ${parts[2]}, ${parts[0]}`;
  }
  return dateStr;
}

export default function ActivityGrid({ data }: ActivityGridProps) {
  const [hoveredDay, setHoveredDay] = useState<{
    day: ContributionDay;
    x: number;
    y: number;
  } | null>(null);

  // Group contributions into 7-day columns (weeks) using UTC determinism
  const { weeks, monthLabels } = useMemo(() => {
    const list = data.contributions;
    if (!list || list.length === 0) return { weeks: [], monthLabels: [] };

    const firstDay = parseUTCDate(list[0].date);
    const startDayOfWeek = firstDay.dayOfWeek; // 0 is Sunday

    const resultWeeks: (ContributionDay | null)[][] = [];
    let currentWeek: (ContributionDay | null)[] = [];

    // Pad beginning of first week
    for (let i = 0; i < startDayOfWeek; i++) {
      currentWeek.push(null);
    }

    const labels: { colIndex: number; label: string }[] = [];
    let lastMonth = -1;

    list.forEach((day) => {
      const parsed = parseUTCDate(day.date);
      const m = parsed.month;

      if (currentWeek.length === 0 && m !== lastMonth) {
        labels.push({ colIndex: resultWeeks.length, label: MONTH_NAMES[m] });
        lastMonth = m;
      }

      currentWeek.push(day);

      if (currentWeek.length === 7) {
        resultWeeks.push(currentWeek);
        currentWeek = [];
      }
    });

    if (currentWeek.length > 0) {
      while (currentWeek.length < 7) {
        currentWeek.push(null);
      }
      resultWeeks.push(currentWeek);
    }

    return { weeks: resultWeeks, monthLabels: labels };
  }, [data.contributions]);

  const getCellClass = (level: number) => {
    switch (level) {
      case 1:
        return "bg-[#143d22] border-[#225c34] hover:border-[#38a169]";
      case 2:
        return "bg-[#1f6b38] border-[#2fa854] hover:border-[#4ade80]";
      case 3:
        return "bg-[#2da34f] border-[#48c774] hover:border-[#86efac]";
      case 4:
        return "bg-acid border-[#f5ff66] shadow-[0_0_8px_rgba(225,255,0,0.5)]";
      case 0:
      default:
        return "bg-[#121217] border-white/[0.04] hover:border-white/20";
    }
  };

  return (
    <div className="w-full space-y-8" suppressHydrationWarning>
      {/* Telemetry Metric Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
        <div className="group relative overflow-hidden border border-line bg-void/60 p-4 transition-colors hover:border-acid/40">
          <div className="space-y-1">
            <span className={`${META_TYPE_BASE} text-[10px] text-muted`}>
              {activityCopy.stats.totalLabel}
            </span>
            <p className="font-display text-2xl font-black tracking-tight text-ink sm:text-3xl" suppressHydrationWarning>
              {formatCount(data.totalContributions)}
            </p>
          </div>
          <span className="absolute bottom-0 left-0 h-0.5 w-6 bg-acid transition-all duration-300 group-hover:w-full" />
        </div>

        <div className="group relative overflow-hidden border border-line bg-void/60 p-4 transition-colors hover:border-acid/40">
          <div className="space-y-1">
            <span className={`${META_TYPE_BASE} text-[10px] text-muted`}>
              {activityCopy.stats.streakLabel}
            </span>
            <p className="font-display text-2xl font-black tracking-tight text-ink sm:text-3xl">
              {data.longestStreak}{" "}
              <span className="text-sm font-normal text-muted">DAYS</span>
            </p>
          </div>
          <span className="absolute bottom-0 left-0 h-0.5 w-6 bg-acid transition-all duration-300 group-hover:w-full" />
        </div>

        <div className="group relative overflow-hidden border border-line bg-void/60 p-4 transition-colors hover:border-acid/40">
          <div className="space-y-1">
            <span className={`${META_TYPE_BASE} text-[10px] text-muted`}>
              {activityCopy.stats.currentLabel}
            </span>
            <p className="font-display text-2xl font-black tracking-tight text-acid sm:text-3xl">
              {data.currentStreak}{" "}
              <span className="text-sm font-normal text-muted">DAYS</span>
            </p>
          </div>
          <span className="absolute bottom-0 left-0 h-0.5 w-6 bg-acid transition-all duration-300 group-hover:w-full" />
        </div>

        <div className="group relative overflow-hidden border border-line bg-void/60 p-4 transition-colors hover:border-acid/40">
          <div className="space-y-1">
            <span className={`${META_TYPE_BASE} text-[10px] text-muted`}>
              {activityCopy.stats.reposLabel}
            </span>
            <p className="font-display text-2xl font-black tracking-tight text-ink sm:text-3xl">
              {data.publicRepos}
            </p>
          </div>
          <span className="absolute bottom-0 left-0 h-0.5 w-6 bg-acid transition-all duration-300 group-hover:w-full" />
        </div>
      </div>

      {/* Main Terminal Activity Grid Board */}
      <div className="relative border border-line bg-void/80 p-4 sm:p-6 md:p-8">
        {/* Terminal Header */}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-line pb-4">
          <div className="flex items-center gap-2.5">
            <span className="size-2 rounded-full bg-acid animate-pulse" />
            <span className={`font-mono text-xs text-ink uppercase tracking-wider`}>
              GITHUB // @{data.username}
            </span>
          </div>

          <div className="flex items-center gap-4 text-xs font-mono text-muted">
            <span className="hidden sm:inline">
              LAST 12 MONTHS
            </span>
            <a
              href={activityCopy.githubUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-center gap-1.5 text-ink transition-colors hover:text-acid"
            >
              <span>{activityCopy.viewProfile}</span>
              <span className="transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5">
                ↗
              </span>
            </a>
          </div>
        </div>

        {/* Scrollable / Full-Width Matrix Area */}
        <div className="relative w-full overflow-x-auto pb-2 pt-1 scrollbar-thin scrollbar-thumb-line scrollbar-track-transparent">
          <div className="w-full min-w-[700px]">
            {/* Months Header Row */}
            <div className="relative mb-3 flex h-4 text-[10px] sm:text-[11px] font-mono text-muted pl-8 sm:pl-9">
              <div className="relative w-full">
                {monthLabels.map((m, i) => (
                  <span
                    key={`${m.label}-${i}`}
                    className="absolute"
                    style={{ left: `${(m.colIndex / (weeks.length || 53)) * 100}%` }}
                  >
                    {m.label}
                  </span>
                ))}
              </div>
            </div>

            {/* Grid Body with Weekday Labels */}
            <div className="flex w-full items-stretch gap-2.5 sm:gap-3">
              {/* Weekday column */}
              <div className="flex w-6 sm:w-7 shrink-0 flex-col justify-between py-0.5 text-[9px] sm:text-[10px] font-mono text-muted select-none">
                <span>MON</span>
                <span>WED</span>
                <span>FRI</span>
              </div>

              {/* Weeks columns: stretched to 100% full container width */}
              <div className="grid flex-1 grid-flow-col auto-cols-fr gap-[3px] sm:gap-[4px] md:gap-[5px]">
                {weeks.map((week, wIdx) => (
                  <div key={wIdx} className="flex flex-col gap-[3px] sm:gap-[4px] md:gap-[5px]">
                    {week.map((day, dIdx) => {
                      if (!day) {
                        return (
                          <div
                            key={`empty-${wIdx}-${dIdx}`}
                            className="w-full aspect-square rounded-[2px] opacity-0"
                          />
                        );
                      }

                      return (
                        <div
                          key={day.date}
                          onMouseEnter={(e) => {
                            const rect = e.currentTarget.getBoundingClientRect();
                            setHoveredDay({
                              day,
                              x: rect.left + rect.width / 2,
                              y: rect.top,
                            });
                          }}
                          onMouseLeave={() => setHoveredDay(null)}
                          className={`w-full aspect-square rounded-[2px] border transition-all duration-150 cursor-pointer hover:scale-125 hover:z-10 ${getCellClass(
                            day.level
                          )}`}
                        />
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Legend and Status Footer */}
        <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-t border-line/60 pt-4 text-[11px] font-mono text-muted">
          <div className="flex items-center gap-2">
            <span className="text-acid">■</span>
            <span>{activityCopy.status}</span>
          </div>

          <div className="flex items-center gap-2">
            <span>{activityCopy.legend.less}</span>
            <span className="size-2.5 rounded-[1.5px] border border-white/[0.04] bg-[#121217]" />
            <span className="size-2.5 rounded-[1.5px] border border-[#225c34] bg-[#143d22]" />
            <span className="size-2.5 rounded-[1.5px] border border-[#2fa854] bg-[#1f6b38]" />
            <span className="size-2.5 rounded-[1.5px] border border-[#4ade80] bg-[#2da34f]" />
            <span className="size-2.5 rounded-[1.5px] border border-[#f5ff66] bg-acid" />
            <span>{activityCopy.legend.more}</span>
          </div>
        </div>
      </div>

      {/* Floating Interactive Tooltip */}
      {hoveredDay && (
        <div
          role="tooltip"
          className="pointer-events-none fixed z-50 -translate-x-1/2 -translate-y-full pb-2 animate-in fade-in zoom-in-95 duration-100"
          style={{ left: hoveredDay.x, top: hoveredDay.y }}
        >
          <div className="rounded border border-line bg-void px-2.5 py-1.5 font-mono text-[11px] text-ink shadow-2xl backdrop-blur-md whitespace-nowrap">
            <span className="font-semibold text-acid">
              {hoveredDay.day.count} {hoveredDay.day.count === 1 ? "contribution" : "contributions"}
            </span>{" "}
            <span className="text-muted">on</span> {formatDate(hoveredDay.day.date)}
          </div>
        </div>
      )}
    </div>
  );
}
