# AegiFitness — Contrato de Arquitectura (v1)

Documento vinculante para backend (ASP.NET Core 10) y frontend (React 19 + TS + Vite PWA).
Todos los valores de enums viajan como **strings** en JSON (JsonStringEnumConverter).

## Stack

| Capa | Tecnología |
|---|---|
| API | ASP.NET Core 10 Web API, EF Core 10 + Npgsql, ASP.NET Identity, JWT Bearer |
| DB | PostgreSQL 17 (`aegifitness`) |
| Cache | Redis (StackExchange.Redis) con fallback a IMemoryCache si no hay connection string |
| Client | React 19 + TypeScript + Vite + vite-plugin-pwa, React Router 7 |
| Infra | Docker Compose: `db`, `redis`, `api` (8080), `web` (nginx: sirve PWA + proxy /api, único en la red externa `proxy` de NPM) |

## Enums canónicos (string en JSON)

```text
Goal:            Recomposition | Bulk | Cut
Modality:        Rest | Gym | Calisthenics | Both
GymMode:         Bodybuilding | Health | Combined
CalisthenicsMode: Classic | Military | CrossFit
MuscleGroup:     Chest | Back | Legs | Shoulders | Biceps | Triceps | Core
MealType:        Breakfast | Lunch | Dinner | Snack
CatalogObjective: Bulk | Cut | Both          (tag de catálogo; Recomposition usa Both+Bulk)
Sex:             Male | Female
LicenseStatus:   Pending | Active | Suspended | Expired | Revoked
Roles:           Admin | Member
AchievementCategory: Training | Nutrition | Consistency | Progress | Special
GoalType:        TargetWeight | WeeklyWorkouts | DailyProtein | Custom
GoalStatus:      Active | Completed | Abandoned
```

Mapeo desde catálogo legacy (seed): `Aumento→Bulk`, `Definición→Cut`, `Ambos→Both`,
`Gimnasio→Gym`, `Calistenia→Calisthenics`, `Desayuno→Breakfast`, `Almuerzo→Lunch`,
`Cena→Dinner`, `Bebida→Snack`. Músculos: `Pecho→Chest, Espalda→Back, Piernas→Legs,
Hombros→Shoulders, Bíceps→Biceps, Tríceps→Triceps, Abdomen→Core`.

## Modelo de dominio (EF Core)

- `ApplicationUser : IdentityUser<Guid>` → `DisplayName`, `CreatedAt`, nav: `License`, `Profile`, `TrainingConfig`
- `License`: Id, UserId(FK único), Status, LicensedByUserId?, LicensedAt?, ExpiresAt?, Notes, UpdatedAt
- `UserProfile`: UserId(PK/FK), Sex, BirthDate, HeightCm(decimal), WeightKg(decimal), TargetWeightKg?, BodyType, ActivityFactor(decimal, default 1.4), Goal, MealTypes (string flags "Breakfast,Lunch,Dinner,Snack"), OnboardingCompleted(bool), UpdatedAt
- `TrainingConfig`: UserId(PK/FK), GymMode, CalisthenicsMode, UpdatedAt + nav `Days` (7)
- `TrainingDayConfig`: Id, UserId, DayOfWeek(0=Domingo..6), Modality, MuscleGroups(string "Chest,Back")
- `Exercise`: Id(int), Name, MuscleGroup, Type(Modality Gym|Calisthenics), Objective(CatalogObjective), Difficulty(1-3), Equipment, Description, Instructions, Target, Effect
- `Food`: Id(int), Name, MealType, Objective(CatalogObjective), Calories, ProteinG, CarbsG, FatG, SugarsG, Portions, Ingredients(jsonb string[]), Steps(jsonb string[]), Description
- `WorkoutPlan`: Id, UserId, CreatedAt, IsActive + `Days` → `WorkoutPlanDay`: Id, PlanId, DayOfWeek, Modality, Focus(string músculos) + `Items` → `WorkoutPlanItem`: Id, DayId, ExerciseId, Order, Sets, RepsMin, RepsMax, RestSeconds, Notes(circuito/AMRAP si aplica)
- `WorkoutLog`: Id, UserId, Date(date), PlanDayId?, StartedAt?, FinishedAt?, Notes + `Entries` → `WorkoutLogEntry`: Id, LogId, ExerciseId, PlannedSets, PlannedReps, ActualSets?, ActualReps?, ActualWeightKg?, Completed(bool), IsExtra(bool)
- `MealPlan`: Id, UserId, Date, TargetCalories, TargetProteinG, TargetCarbsG, TargetFatG + `Items` → `MealPlanItem`: Id, PlanId, FoodId, MealType, Servings(decimal), Eaten(bool)
- `MealLog`: Id, UserId, Date + `Entries` → `MealLogEntry`: Id, LogId, FoodId?, CustomName?, MealType, Servings(decimal), Calories, ProteinG, CarbsG, FatG, IsExtra
- `XpEvent`: Id, UserId, Points, Reason, CreatedAt
- `Achievement`: Id, Code(único), Name, Description, Icon(Material Symbol name), Category, XpReward, Threshold, Metric(string clave)
- `UserAchievement`: UserId+AchievementId(PK compuesta), Progress(int), UnlockedAt?
- `UserGoal`: Id, UserId, Type, Title, TargetValue(decimal), CurrentValue, Unit, Deadline?, Status, CreatedAt
- `WeightEntry`: Id, UserId, Date, WeightKg, Notes?
- `RefreshToken`: Id, UserId, TokenHash, ExpiresAt, CreatedAt, RevokedAt?

## Autenticación y licenciamiento

- `POST /api/auth/register` {username, email, password, displayName} → crea user rol **Member** + `License(Pending)`. Devuelve 200 {message} (sin token usable para la app).
- `POST /api/auth/login` {usernameOrEmail, password} → 200 {accessToken, refreshToken, user: MeDto}. Siempre emite token; la app decide por `license.status` y `onboardingCompleted`.
- `POST /api/auth/refresh` {refreshToken} → rota y devuelve nuevos tokens. `POST /api/auth/logout` revoca.
- `GET /api/auth/me` → MeDto {id, username, displayName, email, roles[], license:{status, expiresAt}, onboardingCompleted, gamification:{xp, level, levelTitle, xpToNext, streakDays}}.
- JWT claims: sub, username, roles, `lic` (LicenseStatus). Expira 12h. Refresh 14d (rotativo, hash en DB).
- **Autorización**: policy `ActiveLicense` (requirement: claim `lic` == Active o rol Admin). Todos los controllers la usan excepto `AuthController` (login/register/refresh/me) y nada más. El admin seed tiene licencia Active.
- Seed admin: username `admin`, email `admin@aegifit.local`, password de env `SEED_ADMIN_PASSWORD` (default `Admin#2026!`), rol Admin, DisplayName "Administrador". El admin también debe poder tener perfil/plan propios (es usuario 1).
- Admin endpoints (rol Admin + ActiveLicense):
  - `GET /api/admin/users?filter=pending|active|all` → lista {id, username, displayName, email, createdAt, roles, license:{status, licensedAt, expiresAt, notes}, stats:{workouts, lastActiveAt}}
  - `POST /api/admin/users/{id}/license/approve` {validDays?} → Active (+XpEvent bienvenida)
  - `POST /api/admin/users/{id}/license/suspend` {notes?} → Suspended
  - `POST /api/admin/users/{id}/license/revoke` {notes?} → Revoked
  - `PUT /api/admin/users/{id}/license/extend` {days} → suma días a ExpiresAt
  - `POST /api/admin/users/{id}/roles` {role, grant:bool} → gestionar rol Admin (no puede quitarse a sí mismo)

## Perfil y configuración

- `GET /api/profile` → ProfileDto {sex, birthDate, heightCm, weightKg, targetWeightKg, bodyType, activityFactor, goal, mealTypes[], onboardingCompleted, bmi, tdee, targets:{calories, proteinG, carbsG, fatG}}
- `PUT /api/profile` (mismo shape, onboardingCompleted se setea al guardar) → recalcula TDEE/targets y **regenera MealPlan de hoy en adelante**.
- TDEE: Mifflin-St Jeor × activityFactor. Ajuste: Bulk +350, Cut −450, Recomposition −100.
  Proteína g/kg: Bulk 2.0, Cut 2.4, Recomp 2.2. Grasas: 25% kcal. Carbs: resto.
- `GET /api/training-config` → {gymMode, calisthenicsMode, days:[{dayOfWeek, modality, muscleGroups[]}]}
- `PUT /api/training-config` → guarda y **regenera WorkoutPlan activo**.

## Motor de rutinas (WorkoutPlanGenerator)

Entrada: TrainingConfig + Goal + catálogo Exercise. Reglas:

- Días `Rest` no generan PlanDay. Días Gym usan ejercicios Type=Gym; Calisthenics Type=Calisthenics; Both mezcla ~50/50 (mínimo 2 de cada tipo si hay ≥5 ejercicios).
- Esquemas por modo:
  - Bodybuilding: compuestos 4×8-10 (rest 120s), accesorios 3×10-12 (75s), aislados 3×12-15 (60s). 6-7 ejercicios/día.
  - Health: 3×12-15 (60s), 5 ejercicios, preferir máquinas/mancuernas.
  - Combined: 4 compuestos gym (4×8-10) + 2-3 finishers calistenia (3×AMRAP, reps 8-15).
  - Classic (calistenia): progresiones 4×6-12 (90s), 6 ejercicios.
  - Military: circuitos altas repeticiones 4×15-25 (45s), incluir burpees/fondos/dominadas, 7 ejercicios, Notes="Circuito ×4".
  - CrossFit: 6 ejercicios, Notes con formato ("AMRAP 15'", "EMOM 12'", "For Time"), reps 10-20, rest 60s.
- Selección: filtrar por músculos del día (si el día tiene muscleGroups, ≥70% de ejercicios deben coincidir); ordenar por dificultad según objetivo (Bulk: prioriza difficulty 2-3 compuestos; Cut: más volumen/densidad); evitar repetir el mismo ejercicio en la semana salvo falta de catálogo; siempre incluir ≥1 ejercicio Core si el día incluye Core.
- Split por defecto si el usuario no marca músculos: usar plantilla según nº de días de gym (3: FullBody / 4: Torso-Pierna / 5-6: PPL+híbrido).
- Persistir WorkoutPlan con sus Days/Items; desactivar planes anteriores.

Endpoints: `GET /api/workout-plans/current` → plan completo con ejercicios embebidos; `POST /api/workout-plans/regenerate`.

## Motor de comidas (MealPlanGenerator)

- Distribución de kcal por MealType: Breakfast 25%, Lunch 35%, Dinner 30%, Snack 10% (normalizado a los mealTypes activos del perfil; si solo Breakfast+Lunch → 40/60).
- Para cada comida del día: elegir 1 Food del catálogo cuyo MealType coincida y Objective sea el del usuario o Both; calorías objetivo = kcalComida; Servings = round(kcalComida / food.Calories, 1) clamp [0.5, 2.5]. Rotación determinista por (fecha + mealType) para variedad sin repetir el mismo Food dos días seguidos.
- `GET /api/meal-plans/today` (o `?date=yyyy-MM-dd`) genera on-demand si no existe y devuelve plan + items con Food embebido + totales planeados.
- `POST /api/meal-plans/regenerate?date=` fuerza nueva selección.
- Al cambiar objetivo/perfil se invalidan planes futuros.

## Tracking (al milímetro)

- `POST /api/workout-logs` {date, planDayId?, entries:[{exerciseId, plannedSets, plannedReps, actualSets?, actualReps?, actualWeightKg?, completed, isExtra}], notes?} → upsert por (user,date). Dispara XP: +15/ejercicio completado, +50 bonus si ≥80% del plan completado, +5 por extra. Actualiza metas y logros.
- `GET /api/workout-logs?from&to` → historial con entries.
- `POST /api/meal-logs` {date, entries:[{foodId?, customName?, mealType, servings, calories, proteinG, carbsG, fatG, isExtra}]} → upsert. XP: +40 si kcal del día dentro de ±10% del objetivo y todos los mealTypes registrados. Actualiza metas/logros.
- `GET /api/meal-logs?from&to`.
- `POST /api/metrics/weight` {date, weightKg, notes?} (upsert por fecha, XP +10); `GET /api/metrics/weight?from&to`.
- `GET /api/metrics/summary` → {adherence7d, adherence30d, workoutsThisWeek, workoutsTotal, currentStreak, weightDelta30d, xpByDay[14], caloriesAvg7d, proteinAvg7d, volumeByMuscle[7d]}. Servido con caché Redis 5 min (invalidar en logs nuevos).

## Gamificación (GamificationService)

- XP total = SUM(XpEvent). Nivel = floor(sqrt(xp/100)) + 1. Títulos: 1 Novato, 3 Aprendiz, 5 Atleta, 8 Guerrero, 12 Élite, 16 Leyenda.
- Rachas: días consecutivos con ≥1 workout o meal log completo.
- Logros sembrados (métrica, umbral, XP): first-workout(1,50), workouts-10/25/50/100(…,100/200/350/500), streak-7/14/30(150/300/600), meals-perfect-7(7 días on-target,250), meal-logs-30(150), weight-goal(1,400), protein-streak-7(200), first-extra(25), onboarding-done(50). Evaluar tras cada evento; al desbloquear crear XpEvent con XpReward.
- `GET /api/gamification/summary` → {xp, level, levelTitle, xpInLevel, xpForLevel, streakDays, achievements:[{code,name,description,icon,category,xpReward,progress,threshold,unlockedAt}], goals:[UserGoalDto]}
- Metas: `GET/POST /api/goals`, `PUT /api/goals/{id}` {status?}, auto-update de CurrentValue en logs (TargetWeight usa último WeightEntry; WeeklyWorkouts cuenta semana actual; DailyProtein promedio 7d).

## Dashboard

`GET /api/dashboard/summary` (ActiveLicense) →
{user:{displayName, level, levelTitle, xp, xpToNext, streakDays}, today:{date, workout:{planDayId, focus, modality, exerciseCount, completed, logId?}, meals:{targetCalories, loggedCalories, targetProteinG, loggedProteinG, itemsLogged, itemsTotal}}, week:{workoutsPlanned, workoutsDone}, latestWeight, weightDelta7d, recentAchievements[3]}

## Catálogos

- `GET /api/exercises?type=&muscleGroup=&objective=&search=&page=&pageSize=` (paginado, cacheado 10 min) + `GET /api/exercises/{id}`.
- `GET /api/foods?mealType=&objective=&search=&page=&pageSize=` + `GET /api/foods/{id}`.
- Sin endpoints de escritura (catálogo global administrado por seed; admin podría ampliarse a futuro).

## Seed data (generado)

`Data/Seed/SeedCatalog.cs` (generado por script, UTF-8):

```csharp
public sealed record ExerciseSeed(string Name, string MuscleGroup, string Type, string Objective,
    int Difficulty, string Equipment, string Description, string Instructions, string Target, string Effect);
public sealed record FoodSeed(string Name, string MealType, string Objective, int Calories,
    int ProteinG, int CarbsG, int FatG, int SugarsG, string Portions, string[] Ingredients, string[] Steps, string Description);
public static class SeedCatalog { public static readonly ExerciseSeed[] Exercises = [...]; public static readonly FoodSeed[] Foods = [...]; }
```

`DbSeeder.RunAsync()`: migraciones → roles → admin → achievements → catálogos (idempotente por nombre).
El backend **ampliará** los arrays generados con ≥40 ejercicios extra (military/crossfit/bodybuilding variants, difficulty y equipment correctos) y ≥30 comidas extra con macros coherentes.

## Reglas de UI (frontend)

- Fusión MeridianUI × Midnight Pulse: tokens MeridianUI (Inter, Material Symbols Rounded, semántica em/am/in/vi/or, spacing base 4, radios 6/10/14/20, sombras Dp1-3, transiciones ≤200ms) sobre superficies dark ya definidas en el prototipo (`--bg #070b18`, `--surface-1..3`). Sin emoji. Labels UPPERCASE con letter-spacing. Números tabular-nums.
- Shell: bottom-nav en portrait/móvil, sidebar 220px en landscape/≥1024px. Vistas únicas: secciones/widgets se ocultan por rol (Admin ve además panel Admin), jamás vistas duplicadas.
- Rutas: `/login` `/register` (públicas) · `/pending` (licencia no activa) · `/onboarding` (wizard 3 pasos: datos → objetivo → config semanal) · `/` dashboard · `/today` · `/training` · `/nutrition` · `/progress` · `/achievements` · `/settings` · `/admin` (solo Admin).
- Guard: sin token → login; licencia ≠ Active → /pending; onboarding incompleto → /onboarding.
- API client con refresh automático (401 → refresh → retry), baseURL `/api` (proxy vite en dev, nginx en prod).
- PWA: manifest (AegiFitness, theme #070b18, iconos de public/AegiFit-Icon.png), service worker, installable.
- Estados en todo: loading (skeleton), empty, error con retry, disabled en acciones async.
- Copy en español neutro, tono funcional, sin exclamaciones.
