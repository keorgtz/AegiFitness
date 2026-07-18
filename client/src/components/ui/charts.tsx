interface RingProgressProps {
  value: number;
  max: number;
  size?: number;
  stroke?: number;
  children?: React.ReactNode;
}

export function RingProgress({
  value,
  max,
  size = 120,
  stroke = 10,
  children,
}: RingProgressProps) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const fraction = max > 0 ? Math.min(value / max, 1) : 0;
  const dashOffset = circumference * (1 - fraction);

  return (
    <div className="ring" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="ring__svg">
        <defs>
          <linearGradient id="ringGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="var(--primary)" />
            <stop offset="100%" stopColor="var(--success)" />
          </linearGradient>
        </defs>
        <circle
          className="ring__track"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={stroke}
        />
        <circle
          className="ring__fill"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={stroke}
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
        />
      </svg>
      {children && <div className="ring__label">{children}</div>}
    </div>
  );
}

interface BarChartProps {
  data: { label: string; value: number; color?: string }[];
  max?: number;
  height?: number;
}

export function BarChart({ data, max, height = 160 }: BarChartProps) {
  const computedMax = max ?? Math.max(...data.map((d) => d.value), 1);
  const barWidth = 24;
  const gap = 12;
  const totalWidth = data.length * barWidth + (data.length - 1) * gap;

  return (
    <svg
      className="bar-chart"
      width="100%"
      height={height}
      viewBox={`0 0 ${totalWidth} ${height}`}
      preserveAspectRatio="xMidYMax meet"
    >
      {data.map((d, i) => {
        const h = computedMax > 0 ? (d.value / computedMax) * (height - 24) : 0;
        const x = i * (barWidth + gap);
        const y = height - h - 20;
        return (
          <g key={`${d.label}-${i}`}>
            <rect
              x={x}
              y={y}
              width={barWidth}
              height={h}
              rx={6}
              fill={d.color ?? "url(#ringGradient)"}
              className="bar-chart__bar"
            />
            <text
              x={x + barWidth / 2}
              y={height - 6}
              textAnchor="middle"
              fill="var(--text-muted)"
              fontSize={10}
              fontWeight={600}
            >
              {d.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

interface LineChartProps {
  data: { label: string; value: number }[];
  height?: number;
}

export function LineChart({ data, height = 160 }: LineChartProps) {
  const values = data.map((d) => d.value);
  const max = Math.max(...values, 1);
  const min = Math.min(...values);
  const range = max - min || 1;
  const padding = 24;
  const width = data.length * 40;
  const chartHeight = height - padding * 2;

  const points = data.map((d, i) => {
    const x = (i / Math.max(data.length - 1, 1)) * (width - padding * 2) + padding;
    const y = padding + chartHeight - ((d.value - min) / range) * chartHeight;
    return { x, y, ...d };
  });

  const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
  const areaPath = `${linePath} L ${points[points.length - 1]?.x ?? padding} ${height - padding} L ${padding} ${height - padding} Z`;

  return (
    <svg
      className="line-chart"
      width="100%"
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="xMidYMid meet"
    >
      <path d={areaPath} className="line-chart__area" />
      <path d={linePath} className="line-chart__line" />
      {points.map((p, i) => (
        <g key={i}>
          <circle cx={p.x} cy={p.y} r={4} className="line-chart__dot" />
          <text
            x={p.x}
            y={height - 6}
            textAnchor="middle"
            fill="var(--text-muted)"
            fontSize={9}
          >
            {p.label}
          </text>
        </g>
      ))}
    </svg>
  );
}

interface MacroBarProps {
  label: string;
  current: number;
  target: number;
  unit?: string;
  color?: "primary" | "success" | "danger";
}

export function MacroBar({
  label,
  current,
  target,
  unit = "g",
  color = "primary",
}: MacroBarProps) {
  const pct = target > 0 ? Math.min((current / target) * 100, 100) : 0;

  return (
    <div className="macro-bar">
      <div className="macro-bar__row">
        <span className="macro-bar__label">{label}</span>
        <div className="macro-bar__track">
          <div
            className={`macro-bar__fill progress__bar--${color}`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className="macro-bar__value">
          {current.toFixed(0)}/{target.toFixed(0)}
          {unit}
        </span>
      </div>
    </div>
  );
}

interface StatCardProps {
  icon: string;
  label: string;
  value: React.ReactNode;
  variant?: "primary" | "success" | "danger" | "accent";
  hint?: string;
}

export function StatCard({ icon, label, value, variant = "primary", hint }: StatCardProps) {
  return (
    <div className={`stat-card stat-card--${variant}`}>
      <div className="stat-card__icon">
        <span className="icon">{icon}</span>
      </div>
      <div className="stat-card__label">{label}</div>
      <div className="stat-card__value">{value}</div>
      {hint && <div className="stat-card__hint">{hint}</div>}
    </div>
  );
}

export function Badge({
  children,
  variant = "info",
}: {
  children: React.ReactNode;
  variant?: "success" | "warning" | "danger" | "info";
}) {
  return <span className={`badge badge--${variant}`}>{children}</span>;
}
