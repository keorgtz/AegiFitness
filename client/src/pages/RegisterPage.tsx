import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { Button, Input } from "../components/ui";
import { useFormErrors } from "../hooks/useAsync";
import { useToastCtx } from "../hooks/useToastContext";

export default function RegisterPage() {
  const navigate = useNavigate();
  const { register } = useAuth();
  const { errors, setError, clearAll } = useFormErrors();
  const toast = useToastCtx();
  const [formError, setFormError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    clearAll();
    setFormError("");

    const form = e.currentTarget;
    const username = (form.elements.namedItem("username") as HTMLInputElement).value.trim();
    const email = (form.elements.namedItem("email") as HTMLInputElement).value.trim();
    const displayName = (form.elements.namedItem("displayName") as HTMLInputElement).value.trim();
    const password = (form.elements.namedItem("password") as HTMLInputElement).value;
    const confirmPassword = (form.elements.namedItem("confirmPassword") as HTMLInputElement).value;

    let valid = true;
    if (username.length < 3) {
      setError("username", "El usuario debe tener al menos 3 caracteres");
      valid = false;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("email", "Ingresa un correo válido");
      valid = false;
    }
    if (!displayName) {
      setError("displayName", "Ingresa tu nombre");
      valid = false;
    }
    if (password.length < 6) {
      setError("password", "La contraseña debe tener al menos 6 caracteres");
      valid = false;
    }
    if (password !== confirmPassword) {
      setError("confirmPassword", "Las contraseñas no coinciden");
      valid = false;
    }
    if (!valid) return;

    setLoading(true);
    try {
      await register({ username, email, password, displayName });
      toast.add("Cuenta creada. Inicia sesión.", "success");
      navigate("/login", { replace: true });
    } catch (err) {
      const message =
        typeof err === "object" && err !== null && "message" in err
          ? String(err.message)
          : "Error al registrar la cuenta";
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
            Crea tu cuenta y comienza a registrar tu progreso.
          </p>
        </div>
        <div style={{ color: "var(--text-dim)", fontSize: "0.8rem" }}>
          Midnight Pulse Edition
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
              <span>Crear cuenta</span>
            </div>
          </div>

          <h2 className="auth-card__title">Nueva cuenta</h2>
          <p className="auth-card__subtitle">
            Completa tus datos para registrarte.
          </p>

          {formError && <div className="form-error">{formError}</div>}

          <form onSubmit={handleSubmit} noValidate>
            <Input
              name="username"
              type="text"
              label="Usuario"
              placeholder="usuario123"
              autoComplete="username"
              error={errors.username}
            />
            <Input
              name="email"
              type="email"
              label="Correo"
              placeholder="usuario@correo.com"
              autoComplete="email"
              error={errors.email}
            />
            <Input
              name="displayName"
              type="text"
              label="Nombre visible"
              placeholder="Tu nombre"
              autoComplete="name"
              error={errors.displayName}
            />
            <Input
              name="password"
              type="password"
              label="Contraseña"
              placeholder="••••••••"
              autoComplete="new-password"
              error={errors.password}
            />
            <Input
              name="confirmPassword"
              type="password"
              label="Confirmar contraseña"
              placeholder="••••••••"
              autoComplete="new-password"
              error={errors.confirmPassword}
            />
            <Button type="submit" variant="primary" block loading={loading} size="lg">
              Crear cuenta
            </Button>
          </form>

          <div className="auth-link">
            ¿Ya tienes cuenta? <Link to="/login">Inicia sesión</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
