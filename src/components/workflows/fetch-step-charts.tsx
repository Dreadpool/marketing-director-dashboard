"use client";

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  Cell,
} from "recharts";

// ─── Shared chart config ─────────────────────────────────────────────────────

const GOLD = "oklch(0.78 0.12 85)";
const EMERALD = "oklch(0.65 0.15 160)";
const MUTED = "oklch(0.4 0 0)";

const FOREGROUND = "oklch(0.95 0 0)";
const MUTED_FG = "oklch(0.65 0 0)";

const chartTooltipStyle = {
  contentStyle: {
    background: "oklch(0.18 0.004 285)",
    border: "1px solid oklch(1 0 0 / 8%)",
    borderRadius: "6px",
    fontSize: "12px",
    color: FOREGROUND,
  },
  itemStyle: { color: FOREGROUND },
  labelStyle: { color: MUTED_FG },
};

const usdChart = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

// ─── NewVsReturningBar ──────────────────────────────────────────────────────

export function NewVsReturningBar({
  newRevenue,
  returningRevenue,
}: {
  newRevenue: number;
  returningRevenue: number;
}) {
  const data = [{ name: "Revenue", new: newRevenue, returning: returningRevenue }];
  return (
    <div className="h-[40px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 0, right: 0, bottom: 0, left: 0 }}
          barSize={24}
        >
          <XAxis type="number" hide />
          <YAxis type="category" dataKey="name" hide />
          <RechartsTooltip
            {...chartTooltipStyle}
            formatter={(value) => usdChart.format(Number(value))}
          />
          <Bar dataKey="new" stackId="a" fill={EMERALD} radius={[4, 0, 0, 4]} name="New" />
          <Bar dataKey="returning" stackId="a" fill={MUTED} radius={[0, 4, 4, 0]} name="Returning" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export { EMERALD, MUTED };

// ─── HorizontalBarChart ─────────────────────────────────────────────────────

export function HorizontalBarChart({
  data,
  height = 150,
  labelWidth = 75,
  marginLeft = 80,
}: {
  data: { name: string; value: number }[];
  height?: number;
  labelWidth?: number;
  marginLeft?: number;
}) {
  if (data.length === 0) return null;
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 0, right: 0, bottom: 0, left: marginLeft }}
          barSize={16}
        >
          <XAxis
            type="number"
            tickFormatter={(v: number) => usdChart.format(v)}
            tick={{ fontSize: 10, fill: MUTED_FG }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            type="category"
            dataKey="name"
            tick={{ fontSize: 11, fill: MUTED_FG }}
            axisLine={false}
            tickLine={false}
            width={labelWidth}
          />
          <RechartsTooltip
            {...chartTooltipStyle}
            formatter={(value) => usdChart.format(Number(value))}
          />
          <Bar dataKey="value" radius={[0, 4, 4, 0]} name="Amount">
            {data.map((_, i) => (
              <Cell key={i} fill={GOLD} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
