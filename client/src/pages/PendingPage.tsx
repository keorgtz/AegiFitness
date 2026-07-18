import { useAuth } from "../auth/AuthContext";
import { Button, Card } from "../components/ui";
import { licenseStatusName } from "../utils/format";

export default function PendingPage() {
  const { user, refetchMe, logout } = useAuth();

  return (
    <div className="auth-layout">
      <div className="auth-layout__form">
        <div className="auth-card" style={{ textAlign: "center" }}>
          <div className="brand-mark" style={{ margin: "0 auto 20px", width: 64, height: 64, borderRadius: 18 }}>
            <span className="icon" style={{ fontSize: 32 }}>
              hourglass_empty
            </span>
          </div>
          <h2 className="auth-card__title">Cuenta pendiente de licencia</h2>
          <p className="auth-card__subtitle">
            Tu registro se ha completado. Un administrador debe activar tu licencia
            para que puedas usar la aplicación.
          </p>

          <Card title="Estado actual" icon="info">
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
              <span style={{ color: "var(--text-muted)" }}>Usuario</span>
              <strong>{user?.username}</strong>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "var(--text-muted)" }}>Licencia</span>
              <strong>{licenseStatusName(user?.license.status ?? "Pending")}</strong>
            </div>
          </Card>

          <div style={{ display: "flex", gap: 12, marginTop: 20, justifyContent: "center" }}>
            <Button variant="ghost" onClick={() => void refetchMe()}>
              Verificar de nuevo
            </Button>
            <Button variant="danger" onClick={() => void logout()}>
              Cerrar sesión
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
