import { useMemo } from "react";

/**
 * Animated SVG ring showing a single metric.
 *
 * Props:
 *   value       – current numeric value
 *   max         – scale maximum
 *   size        – diameter in px (default 120)
 *   stroke      – stroke width in px (default 10)
 *   color       – gradient stops ["#a", "#b"] or solid color
 *   label       – small caption inside the ring (after the value)
 *   trackColor  – ring background
 *   unit        – appended to the value (e.g. "kcal")
 *   showPercent – show "%" instead of value+unit inside
 */
const RingProgress = ({
	value = 0,
	max = 100,
	size = 120,
	stroke = 10,
	color = ["#22d3ee", "#bef264"],
	trackColor = "rgba(148, 163, 184, 0.15)",
	label,
	unit = "",
	showPercent = true,
	insideValue,
	insideUnit = "",
}) => {
	const radius = (size - stroke) / 2;
	const circ = useMemo(() => 2 * Math.PI * radius, [radius]);
	const pct = Math.max(0, Math.min(1, value / max));
	const offset = circ * (1 - pct);
	const isGradient = Array.isArray(color);
	const gradId = useMemo(
		() => `ring-grad-${Math.random().toString(36).slice(2, 8)}`,
		[],
	);

	return (
		<div className="ring" style={{ width: size, height: size }}>
			<svg width={size} height={size}>
				<defs>
					{isGradient && (
						<linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
							<stop offset="0%" stopColor={color[0]} />
							<stop offset="100%" stopColor={color[1]} />
						</linearGradient>
					)}
				</defs>
				<circle
					cx={size / 2}
					cy={size / 2}
					r={radius}
					fill="none"
					stroke={trackColor}
					strokeWidth={stroke}
				/>
				<circle
					cx={size / 2}
					cy={size / 2}
					r={radius}
					fill="none"
					stroke={isGradient ? `url(#${gradId})` : color}
					strokeWidth={stroke}
					strokeLinecap="round"
					strokeDasharray={circ}
					strokeDashoffset={offset}
					transform={`rotate(-90 ${size / 2} ${size / 2})`}
					style={{
						transition:
							"stroke-dashoffset 0.8s cubic-bezier(0.34, 1.56, 0.64, 1)",
					}}
				/>
			</svg>
			<div className="ring__label">
				<span className="ring__value">
					{insideValue !== undefined
						? insideValue
						: showPercent
							? Math.round(pct * 100)
							: Math.round(value)}
					{insideValue !== undefined ? (
						insideUnit && (
							<small
								style={{
									fontSize: "0.45em",
									opacity: 0.7,
									marginLeft: 4,
									fontWeight: 600,
								}}
							>
								{insideUnit}
							</small>
						)
					) : showPercent ? (
						<small
							style={{
								fontSize: "0.45em",
								opacity: 0.7,
								marginLeft: 4,
								fontWeight: 600,
							}}
						>
							%
						</small>
					) : (
						unit && (
							<small
								style={{
									fontSize: "0.45em",
									opacity: 0.7,
									marginLeft: 4,
									fontWeight: 600,
								}}
							>
								{unit}
							</small>
						)
					)}
				</span>
				{label && <span className="ring__hint">{label}</span>}
			</div>
		</div>
	);
};

export default RingProgress;
