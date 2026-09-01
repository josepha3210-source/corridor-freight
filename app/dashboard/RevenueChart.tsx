"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatCurrency } from "@/lib/format";

export type MonthlyRevenue = {
  month_start: string;
  revenue: number;
  driver_pay: number;
};

/**
 * Client component purely because recharts renders to SVG with its own
 * interactivity (tooltips, legend) — the data itself is fetched server-
 * side (dashboard_revenue_by_month(), migration 0015) and passed down
 * as a plain prop, same "server fetches, client renders" split as every
 * other interactive piece in this app.
 */
export function RevenueChart({ data }: { data: MonthlyRevenue[] }) {
  const chartData = data.map((row) => ({
    month: new Date(row.month_start).toLocaleDateString(undefined, {
      month: "short",
    }),
    Revenue: row.revenue,
    "Driver pay": row.driver_pay,
  }));

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200 dark:stroke-slate-800" />
          <XAxis
            dataKey="month"
            tick={{ fontSize: 12 }}
            className="fill-slate-500 dark:fill-slate-400"
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 12 }}
            className="fill-slate-500 dark:fill-slate-400"
            axisLine={false}
            tickLine={false}
            tickFormatter={(value) => formatCurrency(value)}
            width={70}
          />
          <Tooltip
            formatter={(value) => formatCurrency(Number(value))}
            contentStyle={{ fontSize: 13, borderRadius: 8 }}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar dataKey="Revenue" fill="#2563eb" radius={[4, 4, 0, 0]} />
          <Bar dataKey="Driver pay" fill="#93c5fd" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
