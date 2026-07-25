"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: "Active",
  IN_REPAIR: "In Repair",
  SPARE: "Spare",
  RETIRED: "Retired",
};

// CSS custom properties resolve at paint time, so these colors follow light/dark mode automatically.
const STATUS_COLORS: Record<string, string> = {
  ACTIVE: "hsl(var(--success))",
  IN_REPAIR: "hsl(var(--warning))",
  SPARE: "hsl(var(--muted-foreground))",
  RETIRED: "hsl(var(--destructive))",
};

interface SystemsStatusChartProps {
  data: { status: string; count: number }[];
}

export function SystemsStatusChart({ data }: SystemsStatusChartProps) {
  const total = data.reduce((sum, d) => sum + d.count, 0);
  const chartData = data.map((d) => ({
    name: STATUS_LABELS[d.status] ?? d.status,
    value: d.count,
    color: STATUS_COLORS[d.status] ?? "hsl(var(--muted-foreground))",
  }));

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>Systems by Status</CardTitle>
      </CardHeader>
      <CardContent>
        {total === 0 ? (
          <div className="flex h-52 items-center justify-center text-sm text-muted-foreground">
            No systems registered yet.
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4 sm:flex-row">
            <div className="relative h-52 w-52 shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartData}
                    dataKey="value"
                    nameKey="name"
                    innerRadius="65%"
                    outerRadius="100%"
                    paddingAngle={2}
                    stroke="none"
                  >
                    {chartData.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      borderRadius: 10,
                      border: "1px solid hsl(var(--border))",
                      background: "hsl(var(--popover))",
                      color: "hsl(var(--popover-foreground))",
                      fontSize: 12,
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl font-semibold text-foreground">{total}</span>
                <span className="text-xs text-muted-foreground">Systems</span>
              </div>
            </div>
            <ul className="w-full space-y-2.5">
              {chartData.map((entry) => (
                <li key={entry.name} className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2 text-muted-foreground">
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: entry.color }}
                    />
                    {entry.name}
                  </span>
                  <span className="font-medium text-foreground">{entry.value}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
