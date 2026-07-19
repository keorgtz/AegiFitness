// ==========================================================
// AEGIFITNESS — TIPOS DE API (contrato vinculante)
// Todos los enums viajan como string en JSON.
// ==========================================================

export type Goal = "Recomposition" | "Bulk" | "Cut";
export type Modality = "Rest" | "Gym" | "Calisthenics" | "Both";
export type GymMode = "Bodybuilding" | "Health" | "Combined";
export type CalisthenicsMode = "Classic" | "Military" | "CrossFit";
export type MuscleGroup =
  | "Chest"
  | "Back"
  | "Legs"
  | "Shoulders"
  | "Biceps"
  | "Triceps"
  | "Core";
export type MealType = "Breakfast" | "Lunch" | "Dinner" | "Snack";
export type CatalogObjective = "Bulk" | "Cut" | "Both";
export type Sex = "Male" | "Female";
export type LicenseStatus = "Pending" | "Active" | "Suspended" | "Expired" | "Revoked";
export type Role = "Admin" | "Member";
export type AchievementCategory =
  | "Training"
  | "Nutrition"
  | "Consistency"
  | "Progress"
  | "Special";
export type GoalType = "TargetWeight" | "WeeklyWorkouts" | "DailyProtein" | "Custom";
export type GoalStatus = "Active" | "Completed" | "Abandoned";

export interface GamificationDto {
  xp: number;
  level: number;
  levelTitle: string;
  xpToNext: number;
  streakDays: number;
}

export interface LicenseDto {
  status: LicenseStatus;
  expiresAt?: string;
  licensedAt?: string;
  notes?: string;
}

export interface MeDto {
  id: string;
  username: string;
  displayName: string;
  email: string;
  roles: Role[];
  license: LicenseDto;
  onboardingCompleted: boolean;
  gamification: GamificationDto;
}

export interface LoginRequest {
  usernameOrEmail: string;
  password: string;
}

export interface RegisterRequest {
  username: string;
  email: string;
  password: string;
  displayName: string;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: MeDto;
}

export interface RegisterResponse {
  message: string;
}

export interface UpdateAccountRequest {
  displayName: string;
  email: string;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

export interface ChangePasswordResponse {
  message: string;
}

export interface UpdateAdminUserRequest {
  displayName: string;
  username: string;
  email: string;
}

export interface ResetPasswordRequest {
  newPassword: string;
}

export interface UpdateLicenseRequest {
  status?: LicenseStatus;
  expiresAt: string | null;
  notes?: string;
}

export interface AdminLicenseDto {
  status: LicenseStatus;
  expiresAt?: string;
  licensedAt?: string;
  notes?: string;
}

export interface RefreshRequest {
  refreshToken: string;
}

export interface TargetsDto {
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
}

export interface ProfileDto {
  sex: Sex;
  birthDate: string;
  heightCm: number;
  weightKg: number;
  targetWeightKg?: number;
  bodyType: string;
  activityFactor: number;
  goal: Goal;
  mealTypes: MealType[];
  onboardingCompleted: boolean;
  bmi: number;
  tdee: number;
  targets: TargetsDto;
}

export interface TrainingDayConfigDto {
  dayOfWeek: number;
  modality: Modality;
  muscleGroups: MuscleGroup[];
}

export interface TrainingConfigDto {
  gymMode: GymMode;
  calisthenicsMode: CalisthenicsMode;
  days: TrainingDayConfigDto[];
}

export interface ExerciseDto {
  id: number;
  name: string;
  muscleGroup: MuscleGroup;
  type: Modality;
  objective: CatalogObjective;
  difficulty: number;
  equipment: string;
  description: string;
  instructions: string;
  target: string;
  effect: string;
}

export interface FoodDto {
  id: number;
  name: string;
  mealType: MealType;
  objective: CatalogObjective;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  sugarsG: number;
  portions: string;
  ingredients: string[];
  steps: string[];
  description: string;
}

export interface PagedResult<T> {
  items: T[];
  totalCount: number;
  page: number;
  pageSize: number;
}

export interface WorkoutPlanItemDto {
  id: number;
  exerciseId: number;
  order: number;
  sets: number;
  repsMin: number;
  repsMax: number;
  restSeconds: number;
  notes?: string;
  exercise: ExerciseDto;
}

export interface WorkoutPlanDayDto {
  id: number;
  dayOfWeek: number;
  modality: Modality;
  focus: string;
  items: WorkoutPlanItemDto[];
}

export interface WorkoutPlanDto {
  id: number;
  createdAt: string;
  isActive: boolean;
  days: WorkoutPlanDayDto[];
}

export interface WorkoutLogEntryDto {
  id: number;
  exerciseId: number;
  plannedSets: number;
  plannedReps: number;
  actualSets?: number;
  actualReps?: number;
  actualWeightKg?: number;
  completed: boolean;
  isExtra: boolean;
  exercise: ExerciseDto;
}

export interface WorkoutLogDto {
  id: number;
  date: string;
  planDayId?: number;
  startedAt?: string;
  finishedAt?: string;
  notes?: string;
  totalXp?: number;
  entries: WorkoutLogEntryDto[];
}

export interface WorkoutLogEntryRequest {
  exerciseId: number;
  plannedSets: number;
  plannedReps: number;
  actualSets?: number;
  actualReps?: number;
  actualWeightKg?: number;
  completed: boolean;
  isExtra: boolean;
}

export interface WorkoutLogRequest {
  date: string;
  planDayId?: number;
  entries: WorkoutLogEntryRequest[];
  notes?: string;
}

export interface MealPlanItemDto {
  id: number;
  foodId: number;
  mealType: MealType;
  servings: number;
  eaten: boolean;
  food: FoodDto;
}

export interface MealPlanDto {
  id: number;
  date: string;
  targetCalories: number;
  targetProteinG: number;
  targetCarbsG: number;
  targetFatG: number;
  items: MealPlanItemDto[];
}

export interface MealLogEntryDto {
  id: number;
  foodId?: number;
  customName?: string;
  mealType: MealType;
  servings: number;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  isExtra: boolean;
  food?: FoodDto;
}

export interface MealLogDto {
  id: number;
  date: string;
  entries: MealLogEntryDto[];
}

export interface MealLogEntryRequest {
  foodId?: number;
  customName?: string;
  mealType: MealType;
  servings: number;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  isExtra: boolean;
}

export interface MealLogRequest {
  date: string;
  entries: MealLogEntryRequest[];
}

export interface WeightEntryDto {
  id: number;
  date: string;
  weightKg: number;
  notes?: string;
}

export interface WeightEntryRequest {
  date: string;
  weightKg: number;
  notes?: string;
}

export interface MetricsSummaryDto {
  adherence7d: number;
  adherence30d: number;
  workoutsThisWeek: number;
  workoutsTotal: number;
  currentStreak: number;
  weightDelta30d: number;
  xpByDay: number[];
  caloriesAvg7d: number;
  proteinAvg7d: number;
  volumeByMuscle: Record<string, number>;
}

export interface AchievementDto {
  code: string;
  name: string;
  description: string;
  icon: string;
  category: AchievementCategory;
  xpReward: number;
  threshold: number;
  progress: number;
  unlockedAt?: string;
}

export interface UserGoalDto {
  id: number;
  type: GoalType;
  title: string;
  targetValue: number;
  currentValue: number;
  unit: string;
  deadline?: string;
  status: GoalStatus;
  createdAt: string;
}

export interface CreateGoalRequest {
  type: GoalType;
  title: string;
  targetValue: number;
  unit: string;
  deadline?: string;
}

export interface UpdateGoalRequest {
  status?: GoalStatus;
}

export interface GamificationSummaryDto {
  xp: number;
  level: number;
  levelTitle: string;
  xpInLevel: number;
  xpForLevel: number;
  streakDays: number;
  achievements: AchievementDto[];
  goals: UserGoalDto[];
}

export interface DashboardUserDto {
  displayName: string;
  level: number;
  levelTitle: string;
  xp: number;
  xpToNext: number;
  streakDays: number;
}

export interface DashboardWorkoutDto {
  planDayId?: number;
  focus: string;
  modality: Modality;
  exerciseCount: number;
  completed: boolean;
  logId?: number;
}

export interface DashboardMealsDto {
  targetCalories: number;
  loggedCalories: number;
  targetProteinG: number;
  loggedProteinG: number;
  itemsLogged: number;
  itemsTotal: number;
}

export interface DashboardWeekDto {
  workoutsPlanned: number;
  workoutsDone: number;
}

export interface DashboardSummaryDto {
  user: DashboardUserDto;
  today: {
    date: string;
    workout: DashboardWorkoutDto;
    meals: DashboardMealsDto;
  };
  week: DashboardWeekDto;
  latestWeight?: number;
  weightDelta7d: number;
  recentAchievements: AchievementDto[];
}

export interface AdminUserStatsDto {
  workouts: number;
  lastActiveAt?: string;
}

export interface AdminUserDto {
  id: string;
  username: string;
  displayName: string;
  email: string;
  createdAt: string;
  roles: Role[];
  license: LicenseDto;
  stats: AdminUserStatsDto;
}

export interface LicenseActionRequest {
  validDays?: number;
  notes?: string;
}

export interface ExtendLicenseRequest {
  days: number;
}

export interface RoleRequest {
  role: Role;
  grant: boolean;
}

export interface ApiError {
  message: string;
  errors?: Record<string, string[]>;
}
