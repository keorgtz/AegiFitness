import type { ReactNode, ButtonHTMLAttributes } from "react";

export { Stepper } from "./Stepper";
export { ExerciseGuideModal, RecipeModal } from "./GuideModals";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
  block?: boolean;
}

export function Button({
  children,
  variant = "primary",
  size = "md",
  loading = false,
  block = false,
  disabled,
  className = "",
  ...rest
}: ButtonProps) {
  const classes = [
    "btn",
    `btn--${variant}`,
    size === "sm" ? "btn--sm" : size === "lg" ? "btn--lg" : "",
    block ? "btn--block" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button className={classes} disabled={disabled || loading} {...rest}>
      {loading && <span className="spinner spinner--sm" />}
      {children}
    </button>
  );
}

export function ButtonIcon({
  icon,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { icon: string }) {
  return (
    <button type="button" className="btn-icon" {...rest}>
      <span className="icon">{icon}</span>
    </button>
  );
}

interface CardProps {
  children: ReactNode;
  title?: ReactNode;
  icon?: string;
  elevated?: boolean;
  interactive?: boolean;
  className?: string;
  onClick?: () => void;
  style?: React.CSSProperties;
}

export function Card({
  children,
  title,
  icon,
  elevated,
  interactive,
  className = "",
  onClick,
  style,
}: CardProps) {
  const Comp = onClick ? "button" : "div";
  return (
    <Comp
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={[
        "card",
        elevated ? "card--elevated" : "",
        interactive ? "card--interactive" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      style={onClick ? { width: "100%", textAlign: "left", ...style } : style}
    >
      {title && (
        <div className="card__title">
          {icon && <span className="icon">{icon}</span>}
          {title}
        </div>
      )}
      {children}
    </Comp>
  );
}

interface ChipProps {
  children: ReactNode;
  active?: boolean;
  secondary?: boolean;
  small?: boolean;
  onClick?: () => void;
  className?: string;
}

export function Chip({
  children,
  active,
  secondary,
  small,
  onClick,
  className = "",
}: ChipProps) {
  const classes = [
    "chip",
    active ? "chip--active" : "",
    secondary ? "chip--active-secondary" : "",
    small ? "chip--small" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button type="button" className={classes} onClick={onClick}>
      {children}
    </button>
  );
}

interface SegmentedControlProps<T extends string> {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: SegmentedControlProps<T>) {
  const activeIndex = options.findIndex((o) => o.value === value);

  return (
    <div className="seg" role="radiogroup">
      <div
        className="seg__indicator"
        style={{
          left: `calc(4px + (100% - 8px) * ${activeIndex} / ${options.length})`,
          width: `calc((100% - 8px) / ${options.length})`,
        }}
      />
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          className={`seg__btn ${value === o.value ? "active" : ""}`}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}

export function Modal({ open, onClose, title, children, footer, wide }: ModalProps) {
  if (!open) return null;

  return (
    <div className="dialog-backdrop" onClick={onClose}>
      <div
        className={`dialog ${wide ? "dialog--wide" : ""}`}
        onClick={(e) => e.stopPropagation()}
      >
        <button type="button" className="dialog__close" onClick={onClose}>
          <span className="icon">close</span>
        </button>
        <div className="dialog__title">{title}</div>
        {children}
        {footer && <div className="dialog__footer">{footer}</div>}
      </div>
    </div>
  );
}

export function Spinner({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  return <div className={`spinner spinner--${size}`} />;
}

export function Loading({ message = "Cargando..." }: { message?: string }) {
  return (
    <div className="loading">
      <Spinner size="lg" />
      <span>{message}</span>
    </div>
  );
}

interface EmptyStateProps {
  icon: string;
  title: string;
  description?: string;
  action?: ReactNode;
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="empty">
      <div className="empty__icon">
        <span className="icon">{icon}</span>
      </div>
      <div className="empty__title">{title}</div>
      {description && <p className="empty__desc">{description}</p>}
      {action}
    </div>
  );
}

interface ErrorStateProps {
  message: string;
  onRetry?: () => void;
}

export function ErrorState({ message, onRetry }: ErrorStateProps) {
  return (
    <div className="error-box">
      <div className="error-box__title">No se pudo cargar</div>
      <p className="error-box__msg">{message}</p>
      {onRetry && (
        <Button variant="ghost" size="sm" onClick={onRetry}>
          Reintentar
        </Button>
      )}
    </div>
  );
}

export function ToastStack({ toasts }: { toasts: { id: string; type: string; message: string }[] }) {
  const iconMap: Record<string, string> = {
    success: "check_circle",
    error: "error",
    info: "info",
  };

  return (
    <div className="toast-stack">
      {toasts.map((t) => (
        <div key={t.id} className={`toast toast--${t.type}`}>
          <span className="icon toast__icon">{iconMap[t.type] ?? "info"}</span>
          <span className="truncate">{t.message}</span>
        </div>
      ))}
    </div>
  );
}

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export function Input({ label, error, className = "", ...rest }: InputProps) {
  return (
    <div className="input-group">
      {label && <label className="input-group__label">{label}</label>}
      <input className={`input ${error ? "input--error" : ""} ${className}`} {...rest} />
      {error && <div className="field-error">{error}</div>}
    </div>
  );
}

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  options: { value: string; label: string }[];
}

export function Select({ label, error, options, className = "", ...rest }: SelectProps) {
  return (
    <div className="input-group">
      {label && <label className="input-group__label">{label}</label>}
      <select className={`select ${error ? "select--error" : ""} ${className}`} {...rest}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {error && <div className="field-error">{error}</div>}
    </div>
  );
}
