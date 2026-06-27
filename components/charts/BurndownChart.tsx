"use client";

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

export interface BurndownPoint {
  sprintName: string;
  remaining: number;
  ideal: number;
  isCurrent: boolean;
}

export function BurndownChart({ data }: { data: BurndownPoint[] }) {
  if (data.length === 0) {
    return <div className="text-sm" style={{ color: "var(--color-text-secondary)" }}>No sprint data yet.</div>;
  }

  return (
    <ResponsiveContainer width="100%" height={240}>
      <LineChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
        <XAxis dataKey="sprintName" tick={{ fontSize: 11 }} />
        <YAxis tick={{ fontSize: 11 }} />
        <Tooltip />
        <Line type="monotone" dataKey="ideal" stroke="var(--color-text-disabled)" strokeDasharray="4 4" dot={false} name="Ideal" />
        <Line
          type="monotone"
          dataKey="remaining"
          stroke="var(--color-primary)"
          strokeWidth={2}
          dot={{ r: 3 }}
          name="Remaining"
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
