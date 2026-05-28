// ui/src/components/activation/ScoreTimeline.tsx
// ACT-R forgetting curve — ClickHouse dark + yellow design system.

import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts'

function forgettingCurve(decayConstant: number, accessAgoHours: number): number {
  const t = accessAgoHours * 3600
  if (t < 0.001) return 10.0
  return Math.log(Math.pow(t, -decayConstant))
}

const HOURS = Array.from({ length: 100 }, (_, i) => (i + 1) * 2.4)

const data = HOURS.map(h => ({
  hours: Math.round(h),
  score: parseFloat(forgettingCurve(0.5, h).toFixed(3)),
}))

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{
      background: '#242424',
      border: '1px solid #3a3a3a',
      borderRadius: 8,
      padding: '8px 12px',
      fontSize: 12,
    }}>
      <div style={{ color: '#888888', marginBottom: 2 }}>{label}h ago</div>
      <div style={{ color: '#faff69', fontFamily: '"JetBrains Mono", monospace', fontWeight: 600 }}>
        B_i = {payload[0].value}
      </div>
    </div>
  )
}

export default function ScoreTimeline() {
  return (
    <div
      id="score-timeline"
      style={{
        background: '#1a1a1a',
        border: '1px solid #2a2a2a',
        borderRadius: 12,
        padding: '16px',
      }}
    >
      <h3 style={{ fontSize: 13, fontWeight: 600, color: '#ffffff', marginBottom: 2 }}>
        ACT-R Forgetting Curve
      </h3>
      <p style={{ fontSize: 11, color: '#888888', marginBottom: 14, lineHeight: 1.4 }}>
        B<sub>i</sub> = ln(t<sup>−0.5</sup>) — single access, decay d = 0.5
      </p>

      <ResponsiveContainer width="100%" height={170}>
        <AreaChart data={data} margin={{ top: 4, right: 24, left: -20, bottom: 4 }}>
          <defs>
            <linearGradient id="yellowGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor="#faff69" stopOpacity={0.25} />
              <stop offset="95%" stopColor="#faff69" stopOpacity={0} />
            </linearGradient>
          </defs>

          <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" vertical={false} />

          <XAxis
            dataKey="hours"
            tick={{ fontSize: 10, fill: '#888888', fontFamily: 'Inter, sans-serif' }}
            tickLine={false}
            axisLine={{ stroke: '#2a2a2a' }}
            tickFormatter={v => `${v}h`}
          />
          <YAxis
            tick={{ fontSize: 10, fill: '#888888', fontFamily: 'Inter, sans-serif' }}
            tickLine={false}
            axisLine={false}
          />

          <Tooltip content={<CustomTooltip />} />

          {/* HOT threshold */}
          <ReferenceLine
            y={1.0}
            stroke="#faff69"
            strokeDasharray="4 3"
            strokeOpacity={0.6}
            label={{ value: 'HOT', position: 'right', fontSize: 10, fill: '#faff69' }}
          />
          {/* DORMANT threshold */}
          <ReferenceLine
            y={-3.5}
            stroke="#ef4444"
            strokeDasharray="4 3"
            strokeOpacity={0.6}
            label={{ value: 'DORMANT', position: 'right', fontSize: 10, fill: '#ef4444' }}
          />

          <Area
            type="monotone"
            dataKey="score"
            stroke="#faff69"
            strokeWidth={2}
            fill="url(#yellowGrad)"
            dot={false}
            activeDot={{ r: 3, fill: '#faff69', stroke: '#0a0a0a', strokeWidth: 2 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
