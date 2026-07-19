interface StepperProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  label?: string;
  size?: "sm" | "md" | "lg";
}

export function Stepper({
  value,
  onChange,
  min = 0,
  max = Number.POSITIVE_INFINITY,
  step = 1,
  unit,
  label,
  size = "md",
}: StepperProps) {
  const canDecrease = value - step >= min;
  const canIncrease = value + step <= max;

  const decrease = () => {
    if (!canDecrease) return;
    const next = Math.round((value - step) / step) * step;
    onChange(Math.max(min, next));
  };

  const increase = () => {
    if (!canIncrease) return;
    const next = Math.round((value + step) / step) * step;
    onChange(Math.min(max, next));
  };

  return (
    <div className={`stepper stepper--${size}`}>
      {label && <div className="stepper__label">{label}</div>}
      <div className="stepper__controls">
        <button
          type="button"
          className="stepper__btn stepper__btn--minus"
          onClick={decrease}
          disabled={!canDecrease}
          aria-label="Disminuir"
        >
          <span className="icon">remove</span>
        </button>
        <div className="stepper__value tabular">
          {value}
          {unit && <span className="stepper__unit">{unit}</span>}
        </div>
        <button
          type="button"
          className="stepper__btn stepper__btn--plus"
          onClick={increase}
          disabled={!canIncrease}
          aria-label="Aumentar"
        >
          <span className="icon">add</span>
        </button>
      </div>
    </div>
  );
}
