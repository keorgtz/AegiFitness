import { useCallback, useEffect, useState } from "react";
import { adminApi } from "../api/resources";
import { useAuth } from "../auth/AuthContext";
import { Button, EmptyState, ErrorState, Input, Loading, Modal, SegmentedControl } from "../components/ui";
import { Badge } from "../components/ui/charts";
import { useAsync } from "../hooks/useAsync";
import { useToastCtx } from "../hooks/useToastContext";
import type { AdminUserDto } from "../types/api";
import { licenseStatusName } from "../utils/format";

export default function AdminPage() {
  const { user } = useAuth();
  const toast = useToastCtx();
  const [filter, setFilter] = useState<"pending" | "active" | "all">("pending");
  const [actionUser, setActionUser] = useState<AdminUserDto | null>(null);
  const [actionType, setActionType] = useState<"approve" | "extend" | null>(null);
  const [days, setDays] = useState("30");
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

  const doAction = async (fn: () => Promise<unknown>) => {
    setLoading(true);
    try {
      await fn();
      toast.add("Acción completada", "success");
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

  const handleApprove = () => {
    if (!actionUser) return;
    void doAction(() => adminApi.approve(actionUser.id, Number(days) || undefined));
  };

  const handleExtend = () => {
    if (!actionUser) return;
    void doAction(() => adminApi.extend(actionUser.id, Number(days) || 30));
  };

  const handleSuspend = (u: AdminUserDto) => {
    void doAction(() => adminApi.suspend(u.id));
  };

  const handleRevoke = (u: AdminUserDto) => {
    void doAction(() => adminApi.revoke(u.id));
  };

  const handleRole = (u: AdminUserDto, grant: boolean) => {
    if (u.id === user?.id) {
      toast.add("No puedes modificar tu propio rol", "error");
      return;
    }
    void doAction(() => adminApi.setRole(u.id, "Admin", grant));
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

      <div className="table-wrap">
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
                </td>
                <td>{u.stats.workouts}</td>
                <td>
                  <div className="row gap-2">
                    {u.license.status !== "Active" && (
                      <Button
                        size="sm"
                        onClick={() => {
                          setActionUser(u);
                          setActionType("approve");
                          setDays("30");
                        }}
                      >
                        Aprobar
                      </Button>
                    )}
                    {u.license.status === "Active" && (
                      <Button size="sm" variant="ghost" onClick={() => handleSuspend(u)}>
                        Suspender
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" onClick={() => handleRevoke(u)}>
                      Revocar
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setActionUser(u);
                        setActionType("extend");
                        setDays("30");
                      }}
                    >
                      Extender
                    </Button>
                    {u.roles.includes("Admin") ? (
                      <Button size="sm" variant="danger" onClick={() => handleRole(u, false)}>
                        Quitar admin
                      </Button>
                    ) : (
                      <Button size="sm" variant="ghost" onClick={() => handleRole(u, true)}>
                        Admin
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {data.users.length === 0 && (
        <EmptyState icon="search_off" title="Sin usuarios" description="No hay usuarios en este filtro." />
      )}

      <Modal
        open={actionType === "approve"}
        onClose={() => setActionType(null)}
        title="Aprobar licencia"
        footer={
          <>
            <Button variant="ghost" onClick={() => setActionType(null)}>
              Cancelar
            </Button>
            <Button onClick={handleApprove} loading={loading}>
              Aprobar
            </Button>
          </>
        }
      >
        <Input
          type="number"
          label="Días válidos (opcional)"
          value={days}
          onChange={(e) => setDays(e.target.value)}
        />
        <p style={{ color: "var(--text-muted)", fontSize: "0.85rem", marginTop: 8 }}>
          Deja en blanco o 0 para usar la vigencia por defecto.
        </p>
      </Modal>

      <Modal
        open={actionType === "extend"}
        onClose={() => setActionType(null)}
        title="Extender licencia"
        footer={
          <>
            <Button variant="ghost" onClick={() => setActionType(null)}>
              Cancelar
            </Button>
            <Button onClick={handleExtend} loading={loading}>
              Extender
            </Button>
          </>
        }
      >
        <Input
          type="number"
          label="Días a añadir"
          value={days}
          onChange={(e) => setDays(e.target.value)}
        />
      </Modal>
    </div>
  );
}
