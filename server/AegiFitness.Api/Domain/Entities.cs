using Microsoft.AspNetCore.Identity;

namespace AegiFitness.Api.Domain;

public class ApplicationUser : IdentityUser<Guid>
{
    public string DisplayName { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public License? License { get; set; }
    public UserProfile? Profile { get; set; }
    public TrainingConfig? TrainingConfig { get; set; }

    public ICollection<WorkoutPlan> WorkoutPlans { get; set; } = new List<WorkoutPlan>();
    public ICollection<WorkoutLog> WorkoutLogs { get; set; } = new List<WorkoutLog>();
    public ICollection<MealPlan> MealPlans { get; set; } = new List<MealPlan>();
    public ICollection<MealLog> MealLogs { get; set; } = new List<MealLog>();
    public ICollection<XpEvent> XpEvents { get; set; } = new List<XpEvent>();
    public ICollection<UserAchievement> UserAchievements { get; set; } = new List<UserAchievement>();
    public ICollection<UserGoal> Goals { get; set; } = new List<UserGoal>();
    public ICollection<WeightEntry> WeightEntries { get; set; } = new List<WeightEntry>();
    public ICollection<ProgressPhoto> ProgressPhotos { get; set; } = new List<ProgressPhoto>();
    public ICollection<RefreshToken> RefreshTokens { get; set; } = new List<RefreshToken>();
}

public class License
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public ApplicationUser User { get; set; } = null!;
    public LicenseStatus Status { get; set; } = LicenseStatus.Pending;
    public Guid? LicensedByUserId { get; set; }
    public DateTime? LicensedAt { get; set; }
    public DateTime? ExpiresAt { get; set; }
    public string? Notes { get; set; }
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}

public class UserProfile
{
    public Guid UserId { get; set; }
    public ApplicationUser User { get; set; } = null!;
    public Sex? Sex { get; set; }
    public DateOnly? BirthDate { get; set; }
    public decimal HeightCm { get; set; }
    public decimal WeightKg { get; set; }
    public decimal? TargetWeightKg { get; set; }
    public string? BodyType { get; set; }
    public decimal ActivityFactor { get; set; } = 1.4m;
    public Goal Goal { get; set; } = Goal.Recomposition;
    public string MealTypes { get; set; } = "Breakfast,Lunch,Dinner,Snack";
    public bool OnboardingCompleted { get; set; }
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}

public class TrainingConfig
{
    public Guid UserId { get; set; }
    public ApplicationUser User { get; set; } = null!;
    public GymMode GymMode { get; set; } = GymMode.Bodybuilding;
    public CalisthenicsMode CalisthenicsMode { get; set; } = CalisthenicsMode.Classic;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    public ICollection<TrainingDayConfig> Days { get; set; } = new List<TrainingDayConfig>();
}

public class TrainingDayConfig
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public Guid TrainingConfigId { get; set; }
    public TrainingConfig TrainingConfig { get; set; } = null!;
    public int DayOfWeek { get; set; }
    public Modality Modality { get; set; } = Modality.Rest;
    public string MuscleGroups { get; set; } = string.Empty;
}

public class Exercise
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public MuscleGroup MuscleGroup { get; set; }
    public Modality Type { get; set; }
    public CatalogObjective Objective { get; set; }
    public int Difficulty { get; set; }
    public string Equipment { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string Instructions { get; set; } = string.Empty;
    public string Target { get; set; } = string.Empty;
    public string Effect { get; set; } = string.Empty;
    // Slug base de imagen (RepDB) y variantes disponibles separadas por coma
    // ("start,peak" o "main"). El cliente construye /exercises/flat/{slug}-{variant}.webp
    public string? ImageSlug { get; set; }
    public string? ImageVariants { get; set; }
}

public class Food
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public MealType MealType { get; set; }
    public CatalogObjective Objective { get; set; }
    public int Calories { get; set; }
    public int ProteinG { get; set; }
    public int CarbsG { get; set; }
    public int FatG { get; set; }
    public int SugarsG { get; set; }
    public string Portions { get; set; } = string.Empty;
    public string[] Ingredients { get; set; } = Array.Empty<string>();
    public string[] Steps { get; set; } = Array.Empty<string>();
    public string Description { get; set; } = string.Empty;
}

public class WorkoutPlan
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public ApplicationUser User { get; set; } = null!;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public bool IsActive { get; set; } = true;

    public ICollection<WorkoutPlanDay> Days { get; set; } = new List<WorkoutPlanDay>();
}

public class WorkoutPlanDay
{
    public Guid Id { get; set; }
    public Guid PlanId { get; set; }
    public WorkoutPlan Plan { get; set; } = null!;
    public int DayOfWeek { get; set; }
    public Modality Modality { get; set; }
    public string Focus { get; set; } = string.Empty;

    public ICollection<WorkoutPlanItem> Items { get; set; } = new List<WorkoutPlanItem>();
}

public class WorkoutPlanItem
{
    public Guid Id { get; set; }
    public Guid DayId { get; set; }
    public WorkoutPlanDay Day { get; set; } = null!;
    public int ExerciseId { get; set; }
    public Exercise Exercise { get; set; } = null!;
    public int Order { get; set; }
    public int Sets { get; set; }
    public int RepsMin { get; set; }
    public int RepsMax { get; set; }
    public int RestSeconds { get; set; }
    public string? Notes { get; set; }
}

public class WorkoutLog
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public ApplicationUser User { get; set; } = null!;
    public DateOnly Date { get; set; }
    public Guid? PlanDayId { get; set; }
    public WorkoutPlanDay? PlanDay { get; set; }
    public DateTime? StartedAt { get; set; }
    public DateTime? FinishedAt { get; set; }
    public string? Notes { get; set; }

    public ICollection<WorkoutLogEntry> Entries { get; set; } = new List<WorkoutLogEntry>();
}

public class WorkoutLogEntry
{
    public Guid Id { get; set; }
    public Guid LogId { get; set; }
    public WorkoutLog Log { get; set; } = null!;
    public int ExerciseId { get; set; }
    public Exercise Exercise { get; set; } = null!;
    public int PlannedSets { get; set; }
    public int PlannedReps { get; set; }
    public int? ActualSets { get; set; }
    public int? ActualReps { get; set; }
    public decimal? ActualWeightKg { get; set; }
    public bool Completed { get; set; }
    public bool IsExtra { get; set; }
    public ICollection<WorkoutSetEntry> Sets { get; set; } = new List<WorkoutSetEntry>();
}

public class WorkoutSetEntry
{
    public Guid Id { get; set; }
    public Guid WorkoutLogEntryId { get; set; }
    public WorkoutLogEntry WorkoutLogEntry { get; set; } = null!;
    public int SetNumber { get; set; }
    public int PlannedReps { get; set; }
    public decimal? PlannedWeightKg { get; set; }
    public int? ActualReps { get; set; }
    public decimal? ActualWeightKg { get; set; }
    public int? Rir { get; set; }
    public bool Completed { get; set; }
    public DateTime? CompletedAt { get; set; }
}

public class MealPlan
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public ApplicationUser User { get; set; } = null!;
    public DateOnly Date { get; set; }
    public int TargetCalories { get; set; }
    public int TargetProteinG { get; set; }
    public int TargetCarbsG { get; set; }
    public int TargetFatG { get; set; }

    public ICollection<MealPlanItem> Items { get; set; } = new List<MealPlanItem>();
}

public class MealPlanItem
{
    public Guid Id { get; set; }
    public Guid PlanId { get; set; }
    public MealPlan Plan { get; set; } = null!;
    public int FoodId { get; set; }
    public Food Food { get; set; } = null!;
    public MealType MealType { get; set; }
    public decimal Servings { get; set; }
    public bool Eaten { get; set; }
}

public class MealLog
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public ApplicationUser User { get; set; } = null!;
    public DateOnly Date { get; set; }

    public ICollection<MealLogEntry> Entries { get; set; } = new List<MealLogEntry>();
}

public class MealLogEntry
{
    public Guid Id { get; set; }
    public Guid LogId { get; set; }
    public MealLog Log { get; set; } = null!;
    public int? FoodId { get; set; }
    public Food? Food { get; set; }
    public string? CustomName { get; set; }
    public MealType MealType { get; set; }
    public decimal Servings { get; set; }
    public int Calories { get; set; }
    public int ProteinG { get; set; }
    public int CarbsG { get; set; }
    public int FatG { get; set; }
    public bool IsExtra { get; set; }
}

public class XpEvent
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public ApplicationUser User { get; set; } = null!;
    public int Points { get; set; }
    public string Reason { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

public class Achievement
{
    public Guid Id { get; set; }
    public string Code { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string Icon { get; set; } = string.Empty;
    public AchievementCategory Category { get; set; }
    public int XpReward { get; set; }
    public int Threshold { get; set; }
    public string Metric { get; set; } = string.Empty;

    public ICollection<UserAchievement> UserAchievements { get; set; } = new List<UserAchievement>();
}

public class UserAchievement
{
    public Guid UserId { get; set; }
    public ApplicationUser User { get; set; } = null!;
    public Guid AchievementId { get; set; }
    public Achievement Achievement { get; set; } = null!;
    public int Progress { get; set; }
    public DateTime? UnlockedAt { get; set; }
}

public class UserGoal
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public ApplicationUser User { get; set; } = null!;
    public GoalType Type { get; set; }
    public string Title { get; set; } = string.Empty;
    public decimal TargetValue { get; set; }
    public decimal CurrentValue { get; set; }
    public string Unit { get; set; } = string.Empty;
    public DateTime? Deadline { get; set; }
    public GoalStatus Status { get; set; } = GoalStatus.Active;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

public class WeightEntry
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public ApplicationUser User { get; set; } = null!;
    public DateOnly Date { get; set; }
    public decimal WeightKg { get; set; }
    public decimal? BodyFatPercent { get; set; }
    public decimal? MuscleMassKg { get; set; }
    public decimal? WaistCm { get; set; }
    public decimal? HipCm { get; set; }
    public decimal? ChestCm { get; set; }
    public decimal? NeckCm { get; set; }
    public decimal? LeftArmCm { get; set; }
    public decimal? RightArmCm { get; set; }
    public decimal? LeftThighCm { get; set; }
    public decimal? RightThighCm { get; set; }
    public string? Notes { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public ICollection<ProgressPhoto> Photos { get; set; } = new List<ProgressPhoto>();
}

public class ProgressPhoto
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public ApplicationUser User { get; set; } = null!;
    public Guid WeightEntryId { get; set; }
    public WeightEntry WeightEntry { get; set; } = null!;
    public string FileName { get; set; } = string.Empty;
    public string ContentType { get; set; } = string.Empty;
    public byte[] Data { get; set; } = Array.Empty<byte>();
    public string? Caption { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

public class RefreshToken
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public ApplicationUser User { get; set; } = null!;
    public string TokenHash { get; set; } = string.Empty;
    public DateTime ExpiresAt { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? RevokedAt { get; set; }
}
