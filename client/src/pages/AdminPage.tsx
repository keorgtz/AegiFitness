import { useCallback, useEffect, useState } from "react";
import { adminApi } from "../api/resources";
import { useAuth } from "../auth/AuthContext";
import { Button, EmptyState, ErrorState, Input, Loading, Modal, SegmentedControl, Select } from "../components/ui";
import { Badge } from "../components/ui/charts";
import { useAsync } from "../hooks/useAsync";
import { useToastCtx } from "../hooks/useToastContext";
import type { AdminUserDto, LicenseStatus } from "../types/api";
import { licenseStatusName } from "../utils/format";

export default function AdminPage() {
  const { user } = useAuth();
  const toast = useToastCtx();
  const [filter, setFilter] = useState<"pending" | "active" | "all">("pending");
  const [manageUser, setManageUser] = useState<AdminUserDto | null>(null);
  const [loading, setLoading] = useState(false);

  const { data, loading: listLoading, error, run } = useAsync<{
    users: AdminUserDto[];
  }>();

  const load = useCallback(() => {
    void run(adminApi.users(filter).then((users) => ({ users })));
  }, [filter, run]);

  useEffect(() => {
    load();
  }, [load]);

  const doAction = async (fn: () => Promise<unknown>, okMessage = "Acción completada") => {
    setLoading(true);
    try {
      await fn();
      toast.add(okMessage, "success");
      load();
    } catch (err) {
      const message =
        typeof err === "object" && err !== null && "message" in err
          ? String(err.message)
          : "Error al ejecutar acción";
      toast.add(message, "error");
    } finally {
      setLoading(false);
    }
  };

  const badgeVariant = (status: string) => {
    switch (status) {
      case "Active":
        return "success";
      case "Pending":
        return "warning";
      case "Suspended":
      case "Revoked":
      case "Expired":
        return "danger";
      default:
        return "info";
    }
  };

  if (listLoading && !data) return <Loading message="Cargando usuarios" />;
  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!data) return <EmptyState icon="admin_panel_settings" title="Sin datos" />;

  return (
    <div className="page">
      <div className="hero">
        <div className="hero__label">
          <span className="icon">admin_panel_settings</span>
          <span>Administración</span>
        </div>
        <h1 className="hero__title">Gestión de usuarios</h1>
      </div>

      <div className="admin-filters">
        <SegmentedControl
          options={[
            { value: "pending", label: "Pendientes" },
            { value: "active", label: "Activos" },
            { value: "all", label: "Todos" },
          ]}
          value={filter}
          onChange={setFilter}
        />
      </div>

      <div className="table-wrap desktop-only">
        <table className="table">
          <thead>
            <tr>
              <th>Usuario</th>
              <th>Correo</th>
              <th>Registro</th>
              <th>Licencia</th>
              <th>Entrenos</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {data.users.map((u) => (
              <tr key={u.id}>
                <td>
                  <strong>{u.displayName}</strong>
                  <div style={{ color: "var(--text-muted)", fontSize: "0.78rem" }}>
                    @{u.username} {u.roles.includes("Admin") && <span className="badge badge--info">Admin</span>}
                  </div>
                </td>
                <td>{u.email}</td>
                <td>{new Date(u.createdAt).toLocaleDateString("es-ES")}</td>
                <td>
                  <Badge variant={badgeVariant(u.license.status)}>
                    {licenseStatusName(u.license.status)}
                  </Badge>
                  <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: 4 }}>
                    {licenseExpiryLabel(u.license.status, u.license.expiresAt)}
                  </div>
                </td>
                <td>{u.stats.workouts}</td>
                <td>
                  <div className="row gap-2" style={{ flexWrap: "wrap" }}>
                    {u.license.status === "Pending" && (
                      <Button
                        size="sm"
                        disabled={loading}
                        onClick={() => void doAction(() => adminApi.approve(u.id), "Licencia activada de por vida")}
                      >
                        Aprobar
                      </Button>
                    )}
                    {u.license.status === "Active" && (
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={loading}
                        onClick={() => void doAction(() => adminApi.suspend(u.id), "Licencia suspendida")}
                      >
                        Suspender
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={loading}
                      onClick={() => void doAction(() => adminApi.revoke(u.id), "Licencia revocada")}
                    >
                      Revocar
                    </Button>
                    <Button size="sm" variant="primary" onClick={() => setManageUser(u)}>
                      Gestionar
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mobile-only">
        {data.users.map((u) => (
          <article key={u.id} className="admin-user-card">
            <div className="admin-user-card__top">
              <div>
                <div className="admin-user-card__name">{u.displayName}</div>
                <div className="admin-user-card__meta">@{u.username} · {u.email}</div>
              </div>
              <Badge variant={badgeVariant(u.license.status)}>{licenseStatusName(u.license.status)}</Badge>
            </div>
            <div className="admin-user-card__meta">
              {licenseExpiryLabel(u.license.status, u.license.expiresAt)} · {u.stats.workouts} entrenos
            </div>
            <div className="admin-user-card__actions">
              <Button size="sm" variant="primary" onClick={() => setManageUser(u)}>
                Gestionar
              </Button>
            </div>
          </article>
        ))}
      </div>

      {data.users.length === 0 && (
        <EmptyState icon="search_off" title="Sin usuarios" description="No hay usuarios en este filtro." />
      )}

      <UserManageModal
        user={manageUser}
        currentUserId={user?.id ?? ""}
        onClose={() => setManageUser(null)}
        onChanged={() => {
          load();
        }}
      />
    </div>
  );
}

function licenseExpiryLabel(status: LicenseStatus, expiresAt?: string) {
  if (expiresAt) return `Vence ${new Date(expiresAt).toLocaleDateString("es-ES")}`;
  return status === "Active" ? "De por vida" : "Sin licencia";
}

function UserManageModal({
  user,
  currentUserId,
  onClose,
  onChanged,
}: {
  user: AdminUserDto | null;
  currentUserId: string;
  onClose: () => void;
  onChanged: () => void;
}) {
  const toast = useToastCtx();
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [licenseStatus, setLicenseStatus] = useState<LicenseStatus>("Pending");
  const [expiresAt, setExpiresAt] = useState("");
  const [lifetime, setLifetime] = useState(false);
  const [licenseNotes, setLicenseNotes] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    setDisplayName(user.displayName);
    setUsername(user.username);
    setEmail(user.email);
    setNewPassword("");
    setConfirmPassword("");
    setLicenseStatus(user.license.status);
    setExpiresAt(user.license.expiresAt ? user.license.expiresAt.slice(0, 10) : "");
    setLifetime(!user.license.expiresAt);
    setLicenseNotes(user.license.notes ?? "");
    setIsAdmin(user.roles.includes("Admin"));
  }, [user]);

  if (!user) return null;

  const saveSection = async (fn: () => Promise<unknown>, okMessage: string) => {
    setSaving(true);
    try {
      await fn();
      toast.add(okMessage, "success");
      onChanged();
    } catch (err) {
      const message =
        typeof err === "object" && err !== null && "message" in err
          ? String(err.message)
          : "Error al guardar";
      toast.add(message, "error");
    } finally {
      setSaving(false);
    }
  };

  const saveData = () =>
    saveSection(
      () => adminApi.updateUser(user.id, { displayName, username, email }),
      "Datos actualizados",
    );

  const savePassword = () => {
    if (newPassword.length < 8) {
      toast.add("La contraseña debe tener al menos 8 caracteres", "error");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.add("Las contraseñas no coinciden", "error");
      return;
    }
    return saveSection(
      () => adminApi.resetPassword(user.id, { newPassword }),
      "Contraseña restablecida",
    );
  };

  const saveLicense = () =>
    saveSection(
      () =>
        adminApi.updateLicense(user.id, {
          status: licenseStatus,
          expiresAt: lifetime ? null : expiresAt || null,
          notes: licenseNotes || undefined,
        }),
      "Licencia actualizada",
    );

  const saveRole = () => {
    if (user.id === currentUserId) {
      toast.add("No puedes modificar tu propio rol", "error");
      return;
    }
    return saveSection(
      () => adminApi.setRole(user.id, "Admin", isAdmin),
      isAdmin ? "Rol Admin otorgado" : "Rol Admin revocado",
    );
  };

  const isSelf = user.id === currentUserId;

  return (
    <Modal open onClose={onClose} title={`Gestionar: ${user.displayName}`} wide>
      <div className="admin-section">
        <div className="admin-section__title">Datos</div>
        <Input label="Nombre visible" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
        <Input label="Usuario" value={username} onChange={(e) => setUsername(e.target.value)} />
        <Input label="Correo" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <Button size="sm" onClick={() => void saveData()} loading={saving}>
          Guardar datos
        </Button>
      </div>

      <div className="admin-section">
        <div className="admin-section__title">Contraseña</div>
        <p style={{ color: "var(--text-muted)", fontSize: "0.82rem", marginBottom: 12 }}>
          Restablecer la contraseña cierra las sesiones activas del usuario.
        </p>
        <Input
          label="Nueva contraseña"
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
        />
        <Input
          label="Confirmar contraseña"
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
        />
        <Button size="sm" variant="danger" onClick={() => void savePassword()} loading={saving}>
          Restablecer
        </Button>
      </div>

      <div className="admin-section">
        <div className="admin-section__title">Licencia</div>
        <Select
          label="Estado"
          value={licenseStatus}
          onChange={(e) => setLicenseStatus(e.target.value as LicenseStatus)}
          options={(["Pending", "Active", "Suspended", "Revoked"] as LicenseStatus[]).map((s) => ({
            value: s,
            label: licenseStatusName(s),
          }))}
        />
        {!lifetime && (
          <Input
            label="Vencimiento"
            type="date"
            value={expiresAt}
            onChange={(e) => setExpiresAt(e.target.value)}
          />
        )}
        <label className="checkbox-row mb-3">
          <input
            type="checkbox"
            checked={lifetime}
            onChange={(e) => setLifetime(e.target.checked)}
          />
          De por vida
        </label>
        <Input
          label="Notas"
          value={licenseNotes}
          onChange={(e) => setLicenseNotes(e.target.value)}
          placeholder="Notas internas"
        />
        <Button size="sm" onClick={() => void saveLicense()} loading={saving}>
          Guardar licencia
        </Button>
      </div>

      <div className="admin-section">
        <div className="admin-section__title">Rol</div>
        <label className="checkbox-row mb-3">
          <input
            type="checkbox"
            checked={isAdmin}
            disabled={isSelf}
            onChange={(e) => setIsAdmin(e.target.checked)}
          />
          Administrador
        </label>
        {isSelf && (
          <p style={{ color: "var(--text-muted)", fontSize: "0.82rem", marginBottom: 10 }}>
            No puedes modificar tu propio rol.
          </p>
        )}
        <Button size="sm" onClick={() => void saveRole()} loading={saving} disabled={isSelf}>
          Guardar rol
        </Button>
      </div>
    </Modal>
  );
}
