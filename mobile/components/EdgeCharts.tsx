import { View, Text, StyleSheet } from 'react-native'
import Svg, { Circle, Polyline, Polygon, Line } from 'react-native-svg'
import { Colors, FontSize, FontWeight } from '../constants/theme'

interface RiskDonutProps {
  score?: number
  value?: number
  strokeColor?: string
  color?: string
  trackColor?: string
  size?: number
}

export function RiskDonut({ score, value, strokeColor, color, trackColor, size = 94 }: RiskDonutProps) {
  const source = typeof value === 'number' ? value : (typeof score === 'number' ? score : 0)
  const normalized = Math.max(0, Math.min(1, source))
  const activeColor = color ?? strokeColor ?? Colors.riskHigh
  const baseTrack = trackColor ?? Colors.border
  const strokeWidth = 10
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const strokeDashoffset = circumference * (1 - normalized)

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={baseTrack}
          strokeWidth={strokeWidth}
          fill="none"
          opacity={0.4}
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={activeColor}
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          rotation="-90"
          origin={`${size / 2}, ${size / 2}`}
        />
      </Svg>
      <View style={styles.donutCenter}>
        <Text style={styles.donutValue}>{Math.round(normalized * 100)}%</Text>
      </View>
    </View>
  )
}

interface SparklineProps {
  points?: number[]
  values?: number[]
  color?: string
  width?: number
  height?: number
}

export function Sparkline({ points, values, color = Colors.teal, width = 180, height = 56 }: SparklineProps) {
  const inputPoints = Array.isArray(values) ? values : (Array.isArray(points) ? points : [])
  const numericPoints = inputPoints.map((n) => Number(n)).filter((n) => Number.isFinite(n))
  const safePoints = numericPoints.length > 1 ? numericPoints : [0, 0]
  const min = Math.min(...safePoints)
  const max = Math.max(...safePoints)
  const range = max - min || 1

  const coords = safePoints
    .map((p, i) => {
      const x = (i / (safePoints.length - 1)) * (width - 4) + 2
      const y = height - (((p - min) / range) * (height - 10) + 5)
      return `${x},${y}`
    })
    .join(' ')

  return (
    <Svg width={width} height={height}>
      <Polyline points={coords} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" />
    </Svg>
  )
}

interface RadarMiniProps {
  exhaustion: number
  cynicism: number
  efficacy: number
  size?: number
}

export function RadarMini({ exhaustion, cynicism, efficacy, size = 116 }: RadarMiniProps) {
  const c = size / 2
  const r = size * 0.36

  function pointAt(angle: number, value: number) {
    const v = Math.max(0, Math.min(1, value))
    const radius = r * v
    const x = c + Math.cos(angle) * radius
    const y = c + Math.sin(angle) * radius
    return `${x},${y}`
  }

  const a1 = -Math.PI / 2
  const a2 = a1 + (2 * Math.PI) / 3
  const a3 = a2 + (2 * Math.PI) / 3

  const outer = `${c + Math.cos(a1) * r},${c + Math.sin(a1) * r} ${c + Math.cos(a2) * r},${c + Math.sin(a2) * r} ${c + Math.cos(a3) * r},${c + Math.sin(a3) * r}`
  const mid = `${c + Math.cos(a1) * r * 0.66},${c + Math.sin(a1) * r * 0.66} ${c + Math.cos(a2) * r * 0.66},${c + Math.sin(a2) * r * 0.66} ${c + Math.cos(a3) * r * 0.66},${c + Math.sin(a3) * r * 0.66}`
  const inner = `${c + Math.cos(a1) * r * 0.33},${c + Math.sin(a1) * r * 0.33} ${c + Math.cos(a2) * r * 0.33},${c + Math.sin(a2) * r * 0.33} ${c + Math.cos(a3) * r * 0.33},${c + Math.sin(a3) * r * 0.33}`

  const data = `${pointAt(a1, exhaustion)} ${pointAt(a2, cynicism)} ${pointAt(a3, efficacy)}`

  return (
    <Svg width={size} height={size}>
      <Polygon points={outer} fill="none" stroke={Colors.border} strokeWidth="1" opacity={0.9} />
      <Polygon points={mid} fill="none" stroke={Colors.border} strokeWidth="1" opacity={0.65} />
      <Polygon points={inner} fill="none" stroke={Colors.border} strokeWidth="1" opacity={0.45} />
      <Line x1={c} y1={c} x2={c + Math.cos(a1) * r} y2={c + Math.sin(a1) * r} stroke={Colors.border} strokeWidth="1" opacity={0.6} />
      <Line x1={c} y1={c} x2={c + Math.cos(a2) * r} y2={c + Math.sin(a2) * r} stroke={Colors.border} strokeWidth="1" opacity={0.6} />
      <Line x1={c} y1={c} x2={c + Math.cos(a3) * r} y2={c + Math.sin(a3) * r} stroke={Colors.border} strokeWidth="1" opacity={0.6} />
      <Polygon points={data} fill={`${Colors.teal}55`} stroke={Colors.teal} strokeWidth="2" />
    </Svg>
  )
}

const styles = StyleSheet.create({
  donutCenter: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  donutValue: {
    color: Colors.textPrimary,
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
  },
})
