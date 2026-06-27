"use client";

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

const COLORS = ["#4F8EF7", "#1A7F4B", "#B35C00", "#B01C1C", "#8896B3", "#7C3AED"];

export interface EngineerSeries {
  engineerId: string;
  engineerName: string;
  sprints: { sprintName: string; effectiveVelocity: number }[];
}

export function VelocityTrendChart({ engineers, baseVelocity }: { engineers: EngineerSeries[]; baseVelocity: number }) {
  if (engineers.length === 0) {
    return <div className="text-sm" style={{ color: "var(--color-text-secondary)" }}>No velocity data yet.</div>;
  }

  const sprintNames = engineers[0]?.sprints.map((s) => s.sprintName) ?? [];
  const data = sprintNames.map((name, i) => {
    const row: Record<string, number | string> = { sprintName: name, baseVelocity };
    for (const e of engineers) {
      row[e.engineerName] = e.sprints[i]?.effectiveVelocity ?? 0;
    }
    return row;
  });

  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
        <XAxis dataKey="sprintName" tick={{ fontSize: 11 }} />
        <YAxis tick={{ fontSize: 11 }} />
        <Tooltip />
        <Legend />
        <Line type="monotone" dataKey="baseVelocity" stroke="var(--color-text-disabled)" strokeDasharray="4 4" dot={false} name="Base velocity" />
        {engineers.map((e, i) => (
          <Line
            key={e.engineerId}
            type="monotone"
            dataKey={e.engineerName}
            stroke={COLORS[i % COLORS.length]}
            dot={{ r: 3 }}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
