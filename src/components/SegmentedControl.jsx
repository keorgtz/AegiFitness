import { useEffect, useRef, useState } from "react";

/**
 * Pill-style segmented control with animated active indicator.
 *
 * Props:
 *   value   – currently selected option
 *   onChange– (next) => void
 *   options – [{ value, label }]
 *   variant – 'primary' | 'coral'
 */
const SegmentedControl = ({
	value,
	onChange,
	options,
	variant = "primary",
}) => {
	const containerRef = useRef(null);
	const [indicator, setIndicator] = useState({ left: 0, width: 0 });

	const recalc = () => {
		const container = containerRef.current;
		if (!container) return;
		const btn = container.querySelector(`[data-value="${value}"]`);
		if (!btn) return;
		const rect = btn.getBoundingClientRect();
		const parentRect = container.getBoundingClientRect();
		setIndicator({
			left: rect.left - parentRect.left,
			width: rect.width,
		});
	};

	useEffect(() => {
		recalc();
		const handler = () => recalc();
		window.addEventListener("resize", handler);
		return () => window.removeEventListener("resize", handler);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [value, options]);

	return (
		<div ref={containerRef} className="seg" role="tablist">
			<span
				className="seg__indicator"
				style={{
					left: indicator.left,
					width: indicator.width,
					background:
						variant === "coral"
							? "linear-gradient(135deg, #fb7185 0%, #be123c 100%)"
							: undefined,
					boxShadow:
						variant === "coral"
							? "0 0 24px rgba(251, 113, 133, 0.4)"
							: undefined,
				}}
			/>
			{options.map((opt) => (
				<button
					type="button"
					key={opt.value}
					data-value={opt.value}
					className={`seg__btn ${value === opt.value ? "active" : ""}`}
					onClick={() => onChange(opt.value)}
					role="tab"
					aria-selected={value === opt.value}
				>
					{opt.label}
				</button>
			))}
		</div>
	);
};

export default SegmentedControl;
