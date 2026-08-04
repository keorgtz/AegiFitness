import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { Button, Input } from "../components/ui";
import { useFormErrors } from "../hooks/useAsync";
import { useToastCtx } from "../hooks/useToastContext";

export default function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const { errors, setError, clearAll } = useFormErrors();
  const toast = useToastCtx();
  const [formError, setFormError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    clearAll();
    setFormError("");

    const form = e.currentTarget;
    const usernameOrEmail = (form.elements.namedItem("usernameOrEmail") as HTMLInputElement).value.trim();
    const password = (form.elements.namedItem("password") as HTMLInputElement).value;

    let valid = true;
    if (!usernameOrEmail) {
      setError("usernameOrEmail", "Ingresa tu usuario o correo");
      valid = false;
    }
    if (!password) {
      setError("password", "Ingresa tu contraseña");
      valid = false;
    }
    if (!valid) return;

    setLoading(true);
    try {
      await login(usernameOrEmail, password);
      toast.add("Sesión iniciada", "success");
      navigate("/", { replace: true });
    } catch (err) {
      const message =
        typeof err === "object" && err !== null && "message" in err
          ? String(err.message)
          : "Error al iniciar sesión";
      setFormError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-layout">
      <div className="auth-layout__brand">
        <div>
          <div className="brand-mark" style={{ width: 56, height: 56, borderRadius: 16 }}>
            <span className="icon" style={{ fontSize: 32 }}>
              fitness_center
            </span>
          </div>
          <h1 style={{ fontSize: "2.4rem", fontWeight: 800, marginTop: 24, marginBottom: 12 }}>
            AegiFitness
          </h1>
          <p style={{ color: "var(--text-muted)", maxWidth: 360, lineHeight: 1.6 }}>
            Rutinas, nutrición y métricas en una sola plataforma. Diseñado para
            acompañar tu progreso día a día.
          </p>
        </div>
        <div style={{ color: "var(--text-dim)", fontSize: "0.8rem" }}>
          Pastel Pulse Edition
        </div>
      </div>

      <div className="auth-layout__form">
        <div className="auth-card">
          <div className="auth-card__logo">
            <div className="brand-mark">
              <span className="icon">fitness_center</span>
            </div>
            <div className="brand-text">
              <strong>AegiFitness</strong>
              <span>Inicia sesión</span>
            </div>
          </div>

          <h2 className="auth-card__title">Bienvenido de vuelta</h2>
          <p className="auth-card__subtitle">
            Ingresa tus credenciales para continuar.
          </p>

          {formError && <div className="form-error">{formError}</div>}

          <form onSubmit={handleSubmit} noValidate>
            <Input
              name="usernameOrEmail"
              type="text"
              label="Usuario o correo"
              placeholder="usuario@correo.com"
              autoComplete="username"
              error={errors.usernameOrEmail}
            />
            <Input
              name="password"
              type="password"
              label="Contraseña"
              placeholder="••••••••"
              autoComplete="current-password"
              error={errors.password}
            />
            <Button type="submit" variant="primary" block loading={loading} size="lg">
              Iniciar sesión
            </Button>
          </form>

          <div className="auth-link">
            ¿No tienes cuenta? <Link to="/register">Regístrate</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
