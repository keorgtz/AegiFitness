using System.ComponentModel.DataAnnotations;
using AegiFitness.Api.Domain;

namespace AegiFitness.Api.Dtos;

public record RegisterDto(
    [Required, MinLength(3), MaxLength(32)] string Username,
    [Required, EmailAddress] string Email,
    [Required, MinLength(8)] string Password,
    [Required, MaxLength(64)] string DisplayName);

public record LoginDto(
    [Required] string UsernameOrEmail,
    [Required] string Password);

public record RefreshDto([Required] string RefreshToken);

public record AuthResponseDto(string AccessToken, string RefreshToken, MeDto User);

public record MeDto(
    Guid Id,
    string Username,
    string DisplayName,
    string Email,
    string[] Roles,
    LicenseDto License,
    bool OnboardingCompleted,
    GamificationMiniDto Gamification);

public record LicenseDto(LicenseStatus Status, DateTime? ExpiresAt);

public record GamificationMiniDto(int Xp, int Level, string LevelTitle, int XpToNext, int StreakDays);

public record ProfileDto(
    Sex? Sex,
    DateOnly? BirthDate,
    decimal HeightCm,
    decimal WeightKg,
    decimal? TargetWeightKg,
    string? BodyType,
    decimal ActivityFactor,
    Goal Goal,
    MealType[] MealTypes,
    bool OnboardingCompleted,
    decimal Bmi,
    decimal Tdee,
    MacroTargetsDto Targets);

public record ProfileUpdateDto(
    Sex? Sex,
    DateOnly? BirthDate,
    [Range(50, 250)] decimal HeightCm,
    [Range(20, 300)] decimal WeightKg,
    [Range(20, 300)] decimal? TargetWeightKg,
    string? BodyType,
    [Range(1, 2.5)] decimal ActivityFactor,
    Goal Goal,
    MealType[] MealTypes,
    bool OnboardingCompleted);

public record MacroTargetsDto(int Calories, int ProteinG, int CarbsG, int FatG);

public record TrainingConfigDto(GymMode GymMode, CalisthenicsMode CalisthenicsMode, TrainingDayConfigDto[] Days);

public record TrainingDayConfigDto(int DayOfWeek, Modality Modality, MuscleGroup[] MuscleGroups);

public record TrainingConfigUpdateDto(
    GymMode GymMode,
    CalisthenicsMode CalisthenicsMode,
    [Required, MinLength(7), MaxLength(7)] TrainingDayConfigDto[] Days);

public record ExerciseDto(
    int Id,
    string Name,
    MuscleGroup MuscleGroup,
    Modality Type,
    CatalogObjective Objective,
    int Difficulty,
    string Equipment,
    string Description,
    string Instructions,
    string Target,
    string Effect,
    string? ImageSlug,
    string? ImageVariants);

public record ExerciseListDto(ExerciseDto[] Items, int TotalCount, int Page, int PageSize);

public record FoodDto(
    int Id,
    string Name,
    MealType MealType,
    CatalogObjective Objective,
    int Calories,
    int ProteinG,
    int CarbsG,
    int FatG,
    int SugarsG,
    string Portions,
    string[] Ingredients,
    string[] Steps,
    string Description);

public record FoodListDto(FoodDto[] Items, int TotalCount, int Page, int PageSize);

public record WorkoutPlanDayDto(
    Guid Id,
    int DayOfWeek,
    Modality Modality,
    string Focus,
    WorkoutPlanItemDto[] Items);

public record WorkoutPlanItemDto(
    Guid Id,
    int ExerciseId,
    int Order,
    int Sets,
    int RepsMin,
    int RepsMax,
    int RestSeconds,
    string? Notes,
    ExerciseDto Exercise);

public record WorkoutPlanDto(Guid Id, DateTime CreatedAt, bool IsActive, WorkoutPlanDayDto[] Days);

public record WorkoutLogEntryDto(
    Guid? Id,
    int ExerciseId,
    int PlannedSets,
    int PlannedReps,
    int? ActualSets,
    int? ActualReps,
    decimal? ActualWeightKg,
    bool Completed,
    bool IsExtra,
    WorkoutSetDto[]? Sets = null);

public record WorkoutSetDto(Guid? Id, int SetNumber, int PlannedReps, decimal? PlannedWeightKg,
    int? ActualReps, decimal? ActualWeightKg, int? Rir, bool Completed, DateTime? CompletedAt);

// Entrada de log tal como la consume el frontend (incluye el ejercicio).
public record WorkoutLogEntryResponseDto(
    Guid? Id,
    int ExerciseId,
    int PlannedSets,
    int PlannedReps,
    int? ActualSets,
    int? ActualReps,
    decimal? ActualWeightKg,
    bool Completed,
    bool IsExtra,
    ExerciseDto Exercise,
    WorkoutSetDto[] Sets);

public record WorkoutLogCreateDto(
    [Required] DateOnly Date,
    Guid? PlanDayId,
    WorkoutLogEntryDto[] Entries,
    string? Notes,
    DateTime? StartedAt = null,
    DateTime? FinishedAt = null);

public record WorkoutLogDto(
    Guid Id,
    DateOnly Date,
    Guid? PlanDayId,
    string? Notes,
    int TotalXp,
    DateTime? StartedAt,
    DateTime? FinishedAt,
    WorkoutLogEntryResponseDto[] Entries);

public record MealPlanItemDto(
    Guid Id,
    int FoodId,
    FoodDto Food,
    MealType MealType,
    decimal Servings,
    bool Eaten,
    int Calories,
    int ProteinG,
    int CarbsG,
    int FatG);

public record MealPlanDto(
    Guid Id,
    DateOnly Date,
    int TargetCalories,
    int TargetProteinG,
    int TargetCarbsG,
    int TargetFatG,
    MealPlanItemDto[] Items,
    int TotalCalories,
    int TotalProteinG,
    int TotalCarbsG,
    int TotalFatG);

// Sustituir un platillo del plan por otro del catálogo
public record MealPlanSwapDto([Required] int FoodId);

public record MealLogEntryDto(
    Guid? Id,
    int? FoodId,
    string? CustomName,
    MealType MealType,
    decimal Servings,
    int Calories,
    int ProteinG,
    int CarbsG,
    int FatG,
    bool IsExtra);

public record MealLogCreateDto(
    [Required] DateOnly Date,
    MealLogEntryDto[] Entries);

// Entrada de log de comida con la comida resuelta (null para comidas custom).
public record MealLogEntryResponseDto(
    Guid? Id,
    int? FoodId,
    string? CustomName,
    MealType MealType,
    decimal Servings,
    int Calories,
    int ProteinG,
    int CarbsG,
    int FatG,
    bool IsExtra,
    FoodDto? Food);

public record MealLogDto(
    Guid Id,
    DateOnly Date,
    int TotalCalories,
    int TotalProteinG,
    int TotalCarbsG,
    int TotalFatG,
    MealLogEntryResponseDto[] Entries);

public record WeightEntryDto(Guid Id, DateOnly Date, decimal WeightKg, string? Notes);

public record WeightEntryCreateDto([Required] DateOnly Date, [Range(20, 300)] decimal WeightKg, string? Notes);

public record ProgressPhotoDto(Guid Id, Guid WeightEntryId, string FileName, string ContentType, string? Caption, DateTime CreatedAt);
public record BodyMeasurementDto(Guid Id, DateOnly Date, decimal WeightKg, decimal? BodyFatPercent, decimal? MuscleMassKg,
    decimal? WaistCm, decimal? HipCm, decimal? ChestCm, decimal? NeckCm, decimal? LeftArmCm, decimal? RightArmCm,
    decimal? LeftThighCm, decimal? RightThighCm, string? Notes, DateTime CreatedAt, ProgressPhotoDto[] Photos);
public record BodyMeasurementCreateDto([Required] DateOnly Date, [Range(20, 300)] decimal WeightKg,
    [Range(1, 75)] decimal? BodyFatPercent, [Range(1, 300)] decimal? MuscleMassKg,
    [Range(20, 300)] decimal? WaistCm, [Range(20, 300)] decimal? HipCm, [Range(20, 300)] decimal? ChestCm,
    [Range(10, 100)] decimal? NeckCm, [Range(10, 100)] decimal? LeftArmCm, [Range(10, 100)] decimal? RightArmCm,
    [Range(15, 150)] decimal? LeftThighCm, [Range(15, 150)] decimal? RightThighCm, string? Notes);

public record GamificationSummaryDto(
    int Xp,
    int Level,
    string LevelTitle,
    int XpInLevel,
    int XpForLevel,
    int StreakDays,
    AchievementDto[] Achievements,
    UserGoalDto[] Goals);

public record AchievementDto(
    string Code,
    string Name,
    string Description,
    string Icon,
    AchievementCategory Category,
    int XpReward,
    int Progress,
    int Threshold,
    DateTime? UnlockedAt);

public record UserGoalDto(
    Guid Id,
    GoalType Type,
    string Title,
    decimal TargetValue,
    decimal CurrentValue,
    string Unit,
    DateTime? Deadline,
    GoalStatus Status,
    DateTime CreatedAt);

public record UserGoalCreateDto(
    [Required] GoalType Type,
    [Required, MaxLength(100)] string Title,
    [Required] decimal TargetValue,
    [Required, MaxLength(20)] string Unit,
    DateTime? Deadline);

public record UserGoalUpdateDto(GoalStatus? Status);

public record DashboardSummaryDto(
    DashboardUserDto User,
    DashboardTodayDto Today,
    DashboardWeekDto Week,
    decimal? LatestWeight,
    decimal? WeightDelta7d,
    AchievementDto[] RecentAchievements);

public record DashboardUserDto(
    string DisplayName,
    int Level,
    string LevelTitle,
    int Xp,
    int XpToNext,
    int StreakDays);

public record DashboardTodayDto(
    DateOnly Date,
    DashboardWorkoutDto Workout,
    DashboardMealsDto Meals);

public record DashboardWorkoutDto(
    Guid? PlanDayId,
    string Focus,
    Modality Modality,
    int ExerciseCount,
    bool Completed,
    Guid? LogId);

public record DashboardMealsDto(
    int TargetCalories,
    int LoggedCalories,
    int TargetProteinG,
    int LoggedProteinG,
    int ItemsLogged,
    int ItemsTotal);

public record DashboardWeekDto(int WorkoutsPlanned, int WorkoutsDone);

public record AdminUserDto(
    Guid Id,
    string Username,
    string DisplayName,
    string Email,
    DateTime CreatedAt,
    string[] Roles,
    AdminLicenseDto License,
    AdminStatsDto Stats);

public record AdminLicenseDto(
    LicenseStatus Status,
    DateTime? LicensedAt,
    DateTime? ExpiresAt,
    string? Notes);

public record AdminStatsDto(int Workouts, DateTime? LastActiveAt);

public record LicenseActionDto(int? ValidDays, string? Notes);

public record LicenseExtendDto([Required, Range(1, 3650)] int Days);

public record RoleActionDto([Required] string Role, [Required] bool Grant);

// ── Gestión de cuenta propia ──
public record ChangePasswordDto([Required] string CurrentPassword, [Required, MinLength(8)] string NewPassword);
public record AccountUpdateDto([Required, MinLength(2)] string DisplayName, [Required, EmailAddress] string Email);

// ── Gestión admin de usuarios ──
public record AdminUserUpdateDto(
    [Required, MinLength(2)] string DisplayName,
    [Required, MinLength(3)] string Username,
    [Required, EmailAddress] string Email);
public record AdminPasswordResetDto([Required, MinLength(8)] string NewPassword);
public record AdminLicenseUpdateDto(LicenseStatus? Status, DateTime? ExpiresAt, string? Notes);

public record MessageDto(string Message);

public record PagedQuery(int Page = 1, int PageSize = 20);
public record CatalogFilterQuery(string? Search, string? Type, string? MuscleGroup, string? Objective, int Page = 1, int PageSize = 20);
public record FoodFilterQuery(string? Search, string? MealType, string? Objective, int Page = 1, int PageSize = 20);
public record DateRangeQuery(DateOnly? From, DateOnly? To);
public record DateQuery([Required] DateOnly Date);

public record ExerciseHistoryPointDto(DateOnly Date, decimal VolumeKg, decimal MaxWeightKg, int TotalReps, decimal EstimatedOneRepMax, int CompletedSets);
public record ExerciseHistoryDto(ExerciseDto Exercise, int Sessions, DateOnly LastPerformed, decimal TotalVolumeKg,
    decimal BestWeightKg, int BestReps, decimal BestEstimatedOneRepMax, decimal TrendPercent, ExerciseHistoryPointDto[] Recent);
public record PersonalRecordDto(ExerciseDto Exercise, decimal BestWeightKg, int RepsAtBestWeight, DateOnly? BestWeightDate,
    int BestReps, DateOnly? BestRepsDate, decimal BestEstimatedOneRepMax, DateOnly? BestEstimatedOneRepMaxDate,
    decimal BestSessionVolumeKg, DateOnly? BestSessionVolumeDate, int TotalSessions, bool ImprovedRecently);
public record FitnessCalendarDayDto(DateOnly Date, bool IsTracked, bool HasWorkout, bool HasNutrition, bool HasMeasurement, bool IsRestDay,
    int? TrainingAdherence, int? NutritionAdherence, int OverallAdherence, int CompletedSets, int PlannedSets,
    int Calories, int TargetCalories, decimal WorkoutVolumeKg, int PersonalRecords);
public record AdherenceWeekDto(DateOnly StartDate, int Training, int Nutrition, int Overall);
public record AdherenceSummaryDto(int Training7d, int Training30d, int Nutrition7d, int Nutrition30d,
    int Overall7d, int Overall30d, int TrainingStreak, int NutritionStreak, int OverallStreak,
    int PerfectDays30d, int PlannedWorkouts30d, int CompletedWorkouts30d, AdherenceWeekDto[] WeeklyTrend);
