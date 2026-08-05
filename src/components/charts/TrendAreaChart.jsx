import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { ChartTooltip } from './ChartTooltip'

const BRAND = '#7C5CFF'

export function TrendAreaChart({ data }) {
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 10, right: 8, left: -16, bottom: 0 }}>
          <defs>
            <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={BRAND} stopOpacity={0.32} />
              <stop offset="100%" stopColor={BRAND} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="var(--chart-grid)" strokeDasharray="3 6" />
          <XAxis
            dataKey="month"
            axisLine={{ stroke: 'var(--chart-axis)' }}
            tickLine={false}
            tick={{ fill: 'var(--chart-muted)', fontSize: 12 }}
            dy={8}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            width={0}
            tick={false}
          />
          <Tooltip content={<ChartTooltip />} cursor={{ stroke: 'var(--chart-axis)', strokeWidth: 1 }} />
          <Area
            type="monotone"
            dataKey="total"
            stroke={BRAND}
            strokeWidth={2}
            fill="url(#trendFill)"
            dot={{ r: 3, fill: BRAND, strokeWidth: 0 }}
            activeDot={{ r: 5, fill: BRAND, strokeWidth: 2, stroke: 'rgb(var(--color-surface))' }}
            isAnimationActive
            animationDuration={700}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
