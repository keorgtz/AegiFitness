/**
 * Lightweight weekly bar chart.
 * Receives an array of { label, values: [in, out] } and renders side-by-side bars per day.
 * Pure CSS, no deps.
 */
const BarChart = ({ data = [], max }) => {
	const peak = max ?? Math.max(1, ...data.flatMap((d) => d.values || []));

	return (
		<>
			<div className="chart__legend">
				<span className="chart__legend-item">
					<span
						className="chart__legend-dot"
						style={{ background: "#22d3ee" }}
					/>
					Ingeridas
				</span>
				<span className="chart__legend-item">
					<span
						className="chart__legend-dot"
						style={{ background: "#fb7185" }}
					/>
					Quemadas
				</span>
			</div>
			<div className="chart">
				{data.map((d, i) => {
					const [cIn = 0, cOut = 0] = d.values || [];
					const hIn = Math.max(2, (cIn / peak) * 100);
					const hOut = Math.max(2, (cOut / peak) * 100);
					return (
						<div className="chart__col" key={i}>
							<div className="chart__bars">
								<div
									className="chart__bar chart__bar--in"
									style={{ height: `${hIn}%` }}
									title={`Ingeridas: ${cIn}`}
								/>
								<div
									className="chart__bar chart__bar--out"
									style={{ height: `${hOut}%` }}
									title={`Quemadas: ${cOut}`}
								/>
							</div>
							<span className="chart__label">{d.label}</span>
						</div>
					);
				})}
			</div>
		</>
	);
};

export default BarChart;
