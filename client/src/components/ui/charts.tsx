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
  const barWidth = 26;
  const gap = 22;
  const sidePadding = 18;
  const topPadding = 24;
  const bottomPadding = 28;
  const totalWidth = Math.max(280, sidePadding * 2 + data.length * barWidth + Math.max(0, data.length - 1) * gap);

  return (
    <div className="chart-shell" role="img" aria-label="Gráfica de barras">
      <svg className="bar-chart" width={totalWidth} height={height} viewBox={`0 0 ${totalWidth} ${height}`}>
        {data.map((d, i) => {
          const availableHeight = height - topPadding - bottomPadding;
          const h = computedMax > 0 ? (d.value / computedMax) * availableHeight : 0;
          const x = sidePadding + i * (barWidth + gap);
          const y = height - bottomPadding - h;
          return (
            <g key={`${d.label}-${i}`}>
              <text x={x + barWidth / 2} y={Math.max(12, y - 7)} textAnchor="middle" className="chart__value">{formatChartValue(d.value)}</text>
              <rect x={x} y={y} width={barWidth} height={h} rx={6} fill={d.color ?? "var(--primary)"} className="bar-chart__bar" />
              <text x={x + barWidth / 2} y={height - 8} textAnchor="middle" className="chart__label">{d.label}</text>
            </g>
          );
        })}
      </svg>
    </div>
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
  const horizontalPadding = 32;
  const topPadding = 28;
  const bottomPadding = 30;
  const width = Math.max(280, horizontalPadding * 2 + Math.max(0, data.length - 1) * 52);
  const chartHeight = height - topPadding - bottomPadding;

  const points = data.map((d, i) => {
    const x = (i / Math.max(data.length - 1, 1)) * (width - horizontalPadding * 2) + horizontalPadding;
    const y = topPadding + chartHeight - ((d.value - min) / range) * chartHeight;
    return { x, y, ...d };
  });

  const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
  const areaPath = `${linePath} L ${points[points.length - 1]?.x ?? horizontalPadding} ${height - bottomPadding} L ${horizontalPadding} ${height - bottomPadding} Z`;

  return (
    <div className="chart-shell" role="img" aria-label="Gráfica de evolución">
      <svg className="line-chart" width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        <path d={areaPath} className="line-chart__area" />
        <path d={linePath} className="line-chart__line" />
        {points.map((p, i) => (
          <g key={i}>
            <text x={p.x} y={Math.max(12, p.y - 10)} textAnchor="middle" className="chart__value">{formatChartValue(p.value)}</text>
            <circle cx={p.x} cy={p.y} r={4} className="line-chart__dot" />
            <text x={p.x} y={height - 8} textAnchor="middle" className="chart__label">{p.label}</text>
          </g>
        ))}
      </svg>
    </div>
  );
}

function formatChartValue(value: number) {
  return new Intl.NumberFormat("es-MX", { maximumFractionDigits: 1, notation: Math.abs(value) >= 10_000 ? "compact" : "standard" }).format(value);
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
