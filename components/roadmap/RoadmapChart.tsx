"use client";

import { useState } from "react";
import Link from "next/link";
import type { RagVariant } from "@/components/ui/Badge";

export interface RoadmapBar {
  id: string;
  name: string;
  start: string;
  end: string;
  kind: "active" | "planned" | "sustaining";
  status?: RagVariant;
}

const RAG_COLOR: Record<RagVariant, string> = {
  on_track: "#1A7F4B",
  at_risk: "#B35C00",
  off_track: "#B01C1C",
  complete: "#1A7F4B",
};

const WINDOW_OPTIONS = [6, 12, 18] as const;

export function RoadmapChart({ bars }: { bars: RoadmapBar[] }) {
  const [months, setMonths] = useState<6 | 12 | 18>(12);

  const today = new Date();
  const windowStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const windowEnd = new Date(windowStart.getFullYear(), windowStart.getMonth() + months, 1);
  const totalMs = windowEnd.getTime() - windowStart.getTime();

  function pct(date: Date): number {
    return Math.min(100, Math.max(0, ((date.getTime() - windowStart.getTime()) / totalMs) * 100));
  }

  const monthTicks: Date[] = [];
  for (let i = 0; i <= months; i++) {
    monthTicks.push(new Date(windowStart.getFullYear(), windowStart.getMonth() + i, 1));
  }

  return (
    <div>
      <div className="mb-3 flex justify-end gap-2">
        {WINDOW_OPTIONS.map((m) => (
          <button
            key={m}
            onClick={() => setMonths(m)}
            className="rounded px-2 py-1 text-xs font-medium"
            style={m === months ? { background: "var(--color-primary)", color: "white" } : { color: "var(--color-text-secondary)" }}
          >
            {m}mo
          </button>
        ))}
      </div>

      <div className="relative" style={{ paddingTop: 24 }}>
        <div className="flex text-xs" style={{ color: "var(--color-text-secondary)" }}>
          {monthTicks.slice(0, -1).map((m, i) => (
            <div key={i} style={{ width: `${100 / months}%` }}>
              {m.toLocaleDateString(undefined, { month: "short", year: "2-digit" })}
            </div>
          ))}
        </div>

        <div className="relative mt-2" style={{ borderTop: "1px solid var(--color-border)" }}>
          <div
            className="absolute top-0 z-10 h-full"
            style={{ left: `${pct(today)}%`, width: 1, background: "var(--color-primary)" }}
          />

          {bars.map((bar) => {
            const start = new Date(bar.start);
            const end = new Date(bar.end);
            const left = pct(start);
            const width = Math.max(1, pct(end) - left);
            const color = bar.kind === "sustaining" ? "#F4B740" : bar.status ? RAG_COLOR[bar.status] : "var(--color-primary)";

            return (
              <div key={bar.id} className="relative my-2 h-7">
                <Link
                  href={bar.kind === "active" ? `/projects/${bar.id}` : "#"}
                  className="absolute flex h-7 items-center rounded px-2 text-xs font-medium text-white"
                  style={{
                    left: `${left}%`,
                    width: `${width}%`,
                    background: color,
                    border: bar.kind === "planned" ? "1px dashed " + color : undefined,
                    opacity: bar.kind === "planned" ? 0.7 : bar.kind === "sustaining" ? 0.6 : 1,
                  }}
                >
                  <span className="truncate">{bar.name}</span>
                </Link>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
