import { api } from "./client";
import type {
  AdminLicenseDto,
  AdminUserDto,
  ChangePasswordRequest,
  ChangePasswordResponse,
  CreateGoalRequest,
  DashboardSummaryDto,
  ExerciseDto,
  ExtendLicenseRequest,
  FoodDto,
  GamificationSummaryDto,
  LicenseActionRequest,
  MealLogDto,
  MealLogRequest,
  MealPlanDto,
  MeDto,
  MetricsSummaryDto,
  PagedResult,
  ProfileDto,
  ResetPasswordRequest,
  RoleRequest,
  TrainingConfigDto,
  UpdateAccountRequest,
  UpdateAdminUserRequest,
  UpdateGoalRequest,
  UpdateLicenseRequest,
  WeightEntryDto,
  WeightEntryRequest,
  WorkoutLogDto,
  WorkoutLogRequest,
  WorkoutPlanDto,
} from "../types/api";

export const profileApi = {
  get: () => api.get<ProfileDto>("/profile"),
  update: (dto: ProfileDto) => api.put<ProfileDto>("/profile", dto),
};

export const trainingConfigApi = {
  get: () => api.get<TrainingConfigDto>("/training-config"),
  update: (dto: TrainingConfigDto) => api.put<TrainingConfigDto>("/training-config", dto),
};

export const workoutPlanApi = {
  current: () => api.get<WorkoutPlanDto>("/workout-plans/current"),
  regenerate: () => api.post<WorkoutPlanDto>("/workout-plans/regenerate"),
};

export const workoutLogApi = {
  get: (from: string, to: string) =>
    api.get<WorkoutLogDto[]>(`/workout-logs?from=${from}&to=${to}`),
  log: (req: WorkoutLogRequest) => api.post<WorkoutLogDto>("/workout-logs", req),
};

export const mealPlanApi = {
  today: () => api.get<MealPlanDto>("/meal-plans/today"),
  forDate: (date: string) => api.get<MealPlanDto>(`/meal-plans/today?date=${date}`),
  regenerate: (date?: string) =>
    api.post<MealPlanDto>(`/meal-plans/regenerate${date ? `?date=${date}` : ""}`),
};

export const mealLogApi = {
  get: (from: string, to: string) =>
    api.get<MealLogDto[]>(`/meal-logs?from=${from}&to=${to}`),
  log: (req: MealLogRequest) => api.post<MealLogDto>("/meal-logs", req),
};

export const metricsApi = {
  summary: (date?: string) =>
    api.get<MetricsSummaryDto>(`/metrics/summary${date ? `?date=${date}` : ""}`),
  weight: (from: string, to: string) =>
    api.get<WeightEntryDto[]>(`/metrics/weight?from=${from}&to=${to}`),
  saveWeight: (req: WeightEntryRequest) => api.post<WeightEntryDto>("/metrics/weight", req),
};

export const gamificationApi = {
  summary: () => api.get<GamificationSummaryDto>("/gamification/summary"),
};

export const goalsApi = {
  list: () => api.get("/goals"),
  create: (req: CreateGoalRequest) => api.post("/goals", req),
  update: (id: number, req: UpdateGoalRequest) => api.put(`/goals/${id}`, req),
};

export const exerciseCatalogApi = {
  search: (params: {
    type?: string;
    muscleGroup?: string;
    objective?: string;
    search?: string;
    page?: number;
    pageSize?: number;
  }) => {
    const qs = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== "") {
        qs.set(key, String(value));
      }
    }
    return api.get<PagedResult<ExerciseDto>>(`/exercises?${qs.toString()}`);
  },
  get: (id: number) => api.get<ExerciseDto>(`/exercises/${id}`),
};

export const foodCatalogApi = {
  search: (params: {
    mealType?: string;
    objective?: string;
    search?: string;
    page?: number;
    pageSize?: number;
  }) => {
    const qs = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== "") {
        qs.set(key, String(value));
      }
    }
    return api.get<PagedResult<FoodDto>>(`/foods?${qs.toString()}`);
  },
  get: (id: number) => api.get<FoodDto>(`/foods/${id}`),
};

export const adminApi = {
  users: (filter: "pending" | "active" | "all") =>
    api.get<AdminUserDto[]>(`/admin/users?filter=${filter}`),
  updateUser: (id: string, req: UpdateAdminUserRequest) =>
    api.put<AdminUserDto>(`/admin/users/${id}`, req),
  resetPassword: (id: string, req: ResetPasswordRequest) =>
    api.post<ChangePasswordResponse>(`/admin/users/${id}/password`, req),
  updateLicense: (id: string, req: UpdateLicenseRequest) =>
    api.put<AdminLicenseDto>(`/admin/users/${id}/license`, req),
  approve: (id: string, validDays?: number) =>
    api.post(`/admin/users/${id}/license/approve`, { validDays } satisfies LicenseActionRequest),
  suspend: (id: string, notes?: string) =>
    api.post(`/admin/users/${id}/license/suspend`, { notes } satisfies LicenseActionRequest),
  revoke: (id: string, notes?: string) =>
    api.post(`/admin/users/${id}/license/revoke`, { notes } satisfies LicenseActionRequest),
  extend: (id: string, days: number) =>
    api.put(`/admin/users/${id}/license/extend`, { days } satisfies ExtendLicenseRequest),
  setRole: (id: string, role: "Admin" | "Member", grant: boolean) =>
    api.post(`/admin/users/${id}/roles`, { role, grant } satisfies RoleRequest),
};

export const accountApi = {
  update: (req: UpdateAccountRequest) => api.put<MeDto>("/auth/account", req),
  changePassword: (req: ChangePasswordRequest) =>
    api.post<ChangePasswordResponse>("/auth/change-password", req),
};

export const dashboardApi = {
  summary: (date: string) =>
    api.get<DashboardSummaryDto>(`/dashboard/summary?date=${date}`),
};
