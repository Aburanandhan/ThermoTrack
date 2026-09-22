import { useMemo } from 'react'
import type { HistoryRange, TemperatureReading } from '../../types/monitoring'
import { EmptyState } from './EmptyState'
import { cn } from '../../lib/cn'

interface TemperatureChartProps {
  readings: TemperatureReading[]
  range: HistoryRange
  onRangeChange: (range: HistoryRange) => void
}

const RANGES: { id: HistoryRange; label: string }[] = [
  { id: '15m', label: '15 min' },
  { id: '30m', label: '30 min' },
  { id: '1h', label: '1 hour' },
  { id: '3h', label: '3 hours' },
  { id: 'session', label: 'All Readings' },
]

export function TemperatureChart({ readings, range, onRangeChange }: TemperatureChartProps) {
  const points = useMemo(() => {
    const withValues = readings
      .filter((reading) => reading.temperature !== null && reading.timestamp)
      .sort((a, b) => Date.parse(a.timestamp as string) - Date.parse(b.timestamp as string))
    const windowed = filterReadings(withValues, range)
    return windowed.map((reading) => ({
      timestamp: reading.timestamp as string,
      temperature: reading.temperature as number,
    }))
  }, [range, readings])

  const stats = useMemo(() => {
    if (points.length === 0) return null
    const temps = points.map((p) => p.temperature)
    const min = Math.min(...temps)
    const max = Math.max(...temps)
    const avg = temps.reduce((a, b) => a + b, 0) / temps.length
    return {
      min: min.toFixed(1),
      max: max.toFixed(1),
      avg: avg.toFixed(1),
      count: points.length,
    }
  }, [points])

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-3">
        <div>
          <h3 className="text-sm font-semibold text-navy">Sensor Temperature Progression</h3>
          {stats ? (
            <p className="mt-0.5 text-xs text-slate-500">
              Min: <span className="font-semibold text-navy">{stats.min}°C</span> · Avg:{' '}
              <span className="font-semibold text-navy">{stats.avg}°C</span> · Max:{' '}
              <span className="font-semibold text-navy">{stats.max}°C</span> ({stats.count} samples)
            </p>
          ) : (
            <p className="mt-0.5 text-xs text-slate-500">Continuous telemetry plot</p>
          )}
        </div>
        <div className="flex flex-wrap gap-1" role="tablist" aria-label="History range">
          {RANGES.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={range === item.id}
              onClick={() => onRangeChange(item.id)}
              className={cn(
                'rounded-md px-2.5 py-1 text-xs font-medium transition',
                range === item.id
                  ? 'bg-navy text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 min-h-[220px]">
        {points.length === 0 ? (
          <EmptyState
            className="h-[220px]"
            title="No temperature data in this window."
            description="The chart plots real ear-sensor readings received from your ESP32 hardware gateway."
          />
        ) : (
          <LineChart points={points} />
        )}
      </div>
    </section>
  )
}

function filterReadings(readings: TemperatureReading[], range: HistoryRange) {
  if (range === 'session') return readings
  const windows: Record<Exclude<HistoryRange, 'session'>, number> = {
    '15m': 15 * 60 * 1000,
    '30m': 30 * 60 * 1000,
    '1h': 60 * 60 * 1000,
    '3h': 3 * 60 * 60 * 1000,
  }
  const cutoff = Date.now() - windows[range]
  const filtered = readings.filter((reading) => Date.parse(reading.timestamp as string) >= cutoff)
  // If window has too few points, show all to avoid empty chart
  return filtered.length > 0 ? filtered : readings
}

function LineChart({ points }: { points: { timestamp: string; temperature: number }[] }) {
  const width = 640
  const height = 220
  const padTop = 20
  const padBottom = 30
  const padLeft = 45
  const padRight = 20

  const temps = points.map((p) => p.temperature)
  const dataMin = Math.min(...temps)
  const dataMax = Math.max(...temps)
  // Give padding to bounds
  const min = Math.max(35.0, Math.floor((dataMin - 0.2) * 10) / 10)
  const max = Math.min(42.0, Math.ceil((dataMax + 0.2) * 10) / 10)
  const span = Math.max(max - min, 0.6)

  const plotW = width - padLeft - padRight
  const plotH = height - padTop - padBottom

  const coords = points.map((point, index) => {
    const x = padLeft + (index / Math.max(points.length - 1, 1)) * plotW
    const y = padTop + plotH - ((point.temperature - min) / span) * plotH
    return { x, y, temp: point.temperature }
  })

  const linePath = coords
    .map((c, i) => `${i === 0 ? 'M' : 'L'} ${c.x.toFixed(1)},${c.y.toFixed(1)}`)
    .join(' ')

  const areaPath = `${linePath} L ${coords[coords.length - 1].x.toFixed(1)},${(padTop + plotH).toFixed(1)} L ${coords[0].x.toFixed(1)},${(padTop + plotH).toFixed(1)} Z`

  const latestPoint = coords[coords.length - 1]

  // Y-axis grid markers
  const midTemp = ((min + max) / 2).toFixed(1)

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="h-[220px] w-full overflow-visible"
      role="img"
      aria-label="Temperature progression curve"
    >
      <defs>
        <linearGradient id="chartFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#0d9488" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#0d9488" stopOpacity="0.0" />
        </linearGradient>
      </defs>

      {/* Grid lines */}
      <line
        x1={padLeft}
        y1={padTop}
        x2={width - padRight}
        y2={padTop}
        stroke="#f1f5f9"
        strokeWidth="1"
      />
      <text
        x={padLeft - 8}
        y={padTop + 4}
        textAnchor="end"
        fontSize="10"
        fill="#94a3b8"
        fontFamily="sans-serif"
      >
        {max.toFixed(1)}°
      </text>

      <line
        x1={padLeft}
        y1={padTop + plotH / 2}
        x2={width - padRight}
        y2={padTop + plotH / 2}
        stroke="#f1f5f9"
        strokeWidth="1"
        strokeDasharray="4 4"
      />
      <text
        x={padLeft - 8}
        y={padTop + plotH / 2 + 4}
        textAnchor="end"
        fontSize="10"
        fill="#94a3b8"
        fontFamily="sans-serif"
      >
        {midTemp}°
      </text>

      <line
        x1={padLeft}
        y1={padTop + plotH}
        x2={width - padRight}
        y2={padTop + plotH}
        stroke="#e2e8f0"
        strokeWidth="1"
      />
      <text
        x={padLeft - 8}
        y={padTop + plotH + 4}
        textAnchor="end"
        fontSize="10"
        fill="#94a3b8"
        fontFamily="sans-serif"
      >
        {min.toFixed(1)}°
      </text>

      {/* Area & Line */}
      <path d={areaPath} fill="url(#chartFill)" />
      <path
        d={linePath}
        fill="none"
        stroke="#0d9488"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Dot on latest reading */}
      {latestPoint ? (
        <g>
          <circle
            cx={latestPoint.x}
            cy={latestPoint.y}
            r="5"
            fill="#0f766e"
            stroke="#ffffff"
            strokeWidth="2"
          />
          <text
            x={latestPoint.x}
            y={latestPoint.y - 9}
            textAnchor="middle"
            fontSize="11"
            fontWeight="bold"
            fill="#0f1c2e"
          >
            {latestPoint.temp.toFixed(1)}°C
          </text>
        </g>
      ) : null}
    </svg>
  )
}
