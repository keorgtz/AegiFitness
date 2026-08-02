# AegiFitness

App fitness gamificada — rutinas, nutrición y progreso en una sola plataforma. PWA instalable (móvil vertical y escritorio horizontal), multiusuario con roles y licenciamiento manual.

## Stack

| Capa | Tecnología |
|---|---|
| Frontend | React 19 · TypeScript · Vite · PWA (instalable) |
| Backend | ASP.NET Core 10 Web API · EF Core · ASP.NET Identity · JWT |
| Base de datos | PostgreSQL 17 |
| Caché | Redis 7 (con fallback a memoria si no está disponible) |
| Infra | Docker Compose: `db` + `redis` + `api` + `web` (Nginx) + `cloudflared` |

## Módulos

- **Auth + roles** (Admin / Member) con JWT + refresh tokens rotativos.
- **Licenciamiento**: el registro es libre, pero la app queda bloqueada hasta que el admin (usuario 1) apruebe la licencia manualmente desde el panel Admin.
- **Perfil**: datos biométricos, objetivo conmutable en cualquier momento (Recomposición / Volumen / Definición), comidas del día configurables.
- **Entrenamiento**: configuración semanal por día (Descanso / Gym / Calistenia / Ambos), modos Gym (Culturismo / Salud / Combinado) y Calistenia (Clásica / Militar / CrossFit), grupos musculares por día. Motor que genera la rutina semanal real según esa configuración.
- **Nutrición**: TDEE (Mifflin-St Jeor) y macros según objetivo; plan de comidas diario con recetas e info nutricional completa.
- **Tracking al milímetro**: registra lo realmente hecho/comido (más o menos que lo planeado, ejercicios y comidas extra) y lo parametriza en métricas.
- **Gamificación**: XP, niveles, rachas, logros y metas personales con progreso automático.
- **Vistas únicas**: una sola UI; las secciones se limitan por rol (nada de dashboards duplicados).

## Despliegue (servidor con Docker + NPM + Cloudflare Tunnel)

Pensado para la infraestructura: Ubuntu + Docker + **Nginx Proxy Manager** (red externa `proxy`) + **Cloudflare Tunnel**. El `docker-compose.yml` ya trae claves inline de uso personal — si algún día abres la app, edítalas ahí mismo y redespliega.

1. Copia el proyecto al servidor, p. ej. `/home/keor/AegiFitness/` (necesitas `client/`, `server/` y `docker-compose.yml`).

2. Levanta el stack (la primera vez construye las imágenes y siembra la base de datos):

   ```bash
   cd /home/keor/AegiFitness
   docker compose up -d --build
   ```

3. En **Nginx Proxy Manager** crea un Proxy Host: dominio → Forward Hostname `aegifit-web`, puerto `80`, con SSL forzado.

4. En **cloudflared** apunta el hostname a NPM (`service: http://npm:80`) y crea el CNAME en Cloudflare.

5. Entra con el usuario admin semilla: usuario **`admin`**, contraseña = `SEED_ADMIN_PASSWORD` del compose (cámbiala tras el primer acceso). Los demás usuarios se registran solos, pero solo podrán usar la app cuando los apruebes en **Admin → Usuarios**.

Guía visual completa: **`deploy-guide.html`** (ábrela en el navegador).

## Desarrollo local

Requisitos: .NET SDK 10, Node 22+, PostgreSQL 17 en `localhost:5432` (o ajusta `ConnectionStrings:Default` en `server/AegiFitness.Api/appsettings.json`).

```bash
# API en http://localhost:5212 (migra y siembra la BD al arrancar)
dotnet run --project server/AegiFitness.Api

# Frontend en http://localhost:5173 (proxy /api → 5212)
cd client
npm install
npm run dev
```

Builds de verificación:

```bash
dotnet build            # backend
cd client && npm run build   # frontend (tsc + vite + PWA)
```

## Estructura

```
├── client/                  # PWA React + TS
│   ├── src/pages/           # Login, Register, Pending, Onboarding, Dashboard, Today,
│   │                        # Training, Nutrition, Progress, Achievements, Settings, Admin
│   ├── src/components/ui/   # Design system (MeridianUI × Midnight Pulse)
│   ├── scripts/gen-seed.mjs # regenera el seed C# desde los catálogos JSON
│   └── scripts/e2e-smoke.mjs# E2E con Playwright
├── server/AegiFitness.Api/  # API ASP.NET Core 10
│   ├── Domain/              # entidades + enums
│   ├── Data/                # DbContext + seed (185 ejercicios, 140 comidas)
│   ├── Services/            # generadores de planes, gamificación, métricas, caché
│   └── Controllers/         # REST /api/*
├── docker-compose.yml
├── .env.example
└── ARCHITECTURE.md          # contrato API/modelo/reglas
```

## Verificación

- Smoke de API (36 pruebas: auth, licencias, catálogos, TDEE, generación de planes, tracking, gamificación, métricas): `client/scripts` + PowerShell sobre la API en ejecución.
- E2E de UI (13 pruebas Playwright: login, vistas desktop/móvil, flujo de licencia pendiente): `node client/scripts/e2e-smoke.mjs` (requiere API y Vite levantados por el propio script).

## Créditos

Exercise data by [RepDB](https://repdb.co/free-exercise-dataset) (datos e imágenes de ejercicios, free tier con licencia de atribución).
