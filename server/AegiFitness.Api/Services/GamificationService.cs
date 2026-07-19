using AegiFitness.Api.Data;
using AegiFitness.Api.Domain;
using Microsoft.EntityFrameworkCore;

namespace AegiFitness.Api.Services;

public class GamificationService
{
    private readonly AppDbContext _context;

    public GamificationService(AppDbContext context)
    {
        _context = context;
    }

    public int LevelForXp(int xp) => (int)Math.Floor(Math.Sqrt(xp / 100.0)) + 1;

    public string TitleForLevel(int level) => level switch
    {
        < 3 => "Novato",
        < 5 => "Aprendiz",
        < 8 => "Atleta",
        < 12 => "Guerrero",
        < 16 => "Élite",
        _ => "Leyenda"
    };

    public int XpForLevel(int level) => level * level * 100;
    public int XpInLevel(int xp) => xp - XpForLevel(LevelForXp(xp) - 1);

    public async Task<int> GetTotalXpAsync(Guid userId, CancellationToken ct = default)
    {
        return await _context.XpEvents
            .Where(x => x.UserId == userId)
            .SumAsync(x => (int?)x.Points, ct) ?? 0;
    }

    public async Task AddXpAsync(Guid userId, int points, string reason, CancellationToken ct = default)
    {
        _context.XpEvents.Add(new XpEvent
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            Points = points,
            Reason = reason,
            CreatedAt = DateTime.UtcNow
        });
        await _context.SaveChangesAsync(ct);
    }

    public async Task<int> GetStreakDaysAsync(Guid userId, CancellationToken ct = default)
    {
        var workoutDates = await _context.WorkoutLogs
            .Where(x => x.UserId == userId)
            .Select(x => x.Date)
            .Distinct()
            .ToListAsync(ct);

        var mealDates = await _context.MealLogs
            .Where(x => x.UserId == userId)
            .Select(x => x.Date)
            .Distinct()
            .ToListAsync(ct);

        var activeDates = workoutDates.Union(mealDates).OrderByDescending(d => d).ToList();
        if (!activeDates.Any()) return 0;

        // Anclar en la fecha de la última actividad del usuario (su "hoy" local),
        // no en el UTC del servidor: evita rachas rotas por diferencias de zona horaria.
        int streak = 0;
        var current = activeDates.First();

        while (activeDates.Contains(current))
        {
            streak++;
            current = current.AddDays(-1);
        }

        return streak;
    }

    public async Task EvaluateWorkoutLoggedAsync(Guid userId, DateOnly activityDate, CancellationToken ct = default)
    {
        var workouts = await _context.WorkoutLogs.CountAsync(x => x.UserId == userId, ct);
        await UnlockAsync(userId, "first-workout", 1, ct);
        await UnlockAsync(userId, "workouts-10", workouts, ct);
        await UnlockAsync(userId, "workouts-25", workouts, ct);
        await UnlockAsync(userId, "workouts-50", workouts, ct);
        await UnlockAsync(userId, "workouts-100", workouts, ct);
        await CheckStreakAchievementsAsync(userId, ct);
        await UpdateGoalsAsync(userId, activityDate, ct);
    }

    public async Task EvaluateMealLoggedAsync(Guid userId, DateOnly activityDate, CancellationToken ct = default)
    {
        var meals = await _context.MealLogs.CountAsync(x => x.UserId == userId, ct);
        await UnlockAsync(userId, "meal-logs-30", meals, ct);
        await CheckMealPerfectStreakAsync(userId, ct);
        await CheckProteinStreakAsync(userId, ct);
        await CheckStreakAchievementsAsync(userId, ct);
        await UpdateGoalsAsync(userId, activityDate, ct);
    }

    public async Task EvaluateWeightLoggedAsync(Guid userId, DateOnly activityDate, CancellationToken ct = default)
    {
        await UnlockAsync(userId, "weight-goal", 1, ct);
        await UpdateGoalsAsync(userId, activityDate, ct);
    }

    public async Task EvaluateOnboardingAsync(Guid userId, CancellationToken ct = default)
    {
        await UnlockAsync(userId, "onboarding-done", 1, ct);
    }

    public async Task EvaluateExtraAsync(Guid userId, CancellationToken ct = default)
    {
        await UnlockAsync(userId, "first-extra", 1, ct);
    }

    private async Task UnlockAsync(Guid userId, string code, int progressValue, CancellationToken ct)
    {
        var achievement = await _context.Achievements.FirstOrDefaultAsync(a => a.Code == code, ct);
        if (achievement is null) return;

        var userAchievement = await _context.UserAchievements
            .FirstOrDefaultAsync(x => x.UserId == userId && x.AchievementId == achievement.Id, ct);

        if (userAchievement is null)
        {
            userAchievement = new UserAchievement
            {
                UserId = userId,
                AchievementId = achievement.Id,
                Progress = progressValue
            };
            _context.UserAchievements.Add(userAchievement);
        }
        else
        {
            if (userAchievement.UnlockedAt.HasValue) return;
            userAchievement.Progress = Math.Max(userAchievement.Progress, progressValue);
        }

        if (userAchievement.Progress >= achievement.Threshold)
        {
            userAchievement.UnlockedAt = DateTime.UtcNow;
            await AddXpAsync(userId, achievement.XpReward, $"Logro desbloqueado: {achievement.Name}", ct);
        }
        else
        {
            await _context.SaveChangesAsync(ct);
        }
    }

    private async Task CheckStreakAchievementsAsync(Guid userId, CancellationToken ct)
    {
        var streak = await GetStreakDaysAsync(userId, ct);
        await UnlockAsync(userId, "streak-7", streak, ct);
        await UnlockAsync(userId, "streak-14", streak, ct);
        await UnlockAsync(userId, "streak-30", streak, ct);
    }

    private async Task CheckMealPerfectStreakAsync(Guid userId, CancellationToken ct)
    {
        var logs = await _context.MealLogs
            .AsNoTracking()
            .Where(x => x.UserId == userId)
            .Include(x => x.Entries)
            .OrderByDescending(x => x.Date)
            .Take(30)
            .ToListAsync(ct);

        int consecutive = 0;
        var current = logs.FirstOrDefault()?.Date ?? DateOnly.FromDateTime(DateTime.UtcNow);
        foreach (var date in Enumerable.Range(0, 30).Select(i => current.AddDays(-i)))
        {
            var log = logs.FirstOrDefault(x => x.Date == date);
            if (log is null || !log.Entries.Any()) break;
            var plan = await _context.MealPlans.AsNoTracking().FirstOrDefaultAsync(x => x.UserId == userId && x.Date == date, ct);
            if (plan is null) break;
            var calories = log.Entries.Sum(e => e.Calories);
            if (calories < plan.TargetCalories * 0.9m || calories > plan.TargetCalories * 1.1m) break;
            consecutive++;
        }

        await UnlockAsync(userId, "meals-perfect-7", consecutive, ct);
    }

    private async Task CheckProteinStreakAsync(Guid userId, CancellationToken ct)
    {
        var logs = await _context.MealLogs
            .AsNoTracking()
            .Where(x => x.UserId == userId)
            .Include(x => x.Entries)
            .OrderByDescending(x => x.Date)
            .Take(30)
            .ToListAsync(ct);

        int consecutive = 0;
        var current = logs.FirstOrDefault()?.Date ?? DateOnly.FromDateTime(DateTime.UtcNow);
        foreach (var date in Enumerable.Range(0, 30).Select(i => current.AddDays(-i)))
        {
            var log = logs.FirstOrDefault(x => x.Date == date);
            if (log is null || !log.Entries.Any()) break;
            var plan = await _context.MealPlans.AsNoTracking().FirstOrDefaultAsync(x => x.UserId == userId && x.Date == date, ct);
            if (plan is null) break;
            var protein = log.Entries.Sum(e => e.ProteinG);
            if (protein < plan.TargetProteinG * 0.9m) break;
            consecutive++;
        }

        await UnlockAsync(userId, "protein-streak-7", consecutive, ct);
    }

    public async Task UpdateGoalsAsync(Guid userId, DateOnly? referenceDate = null, CancellationToken ct = default)
    {
        var goals = await _context.UserGoals.Where(x => x.UserId == userId && x.Status == GoalStatus.Active).ToListAsync(ct);
        var latestWeight = await _context.WeightEntries
            .AsNoTracking()
            .Where(x => x.UserId == userId)
            .OrderByDescending(x => x.Date)
            .FirstOrDefaultAsync(ct);

        // La referencia es la fecha de actividad del usuario (su día local),
        // no el UTC del servidor: evita desfaces de semana por zona horaria.
        var today = referenceDate ?? DateOnly.FromDateTime(DateTime.UtcNow);
        var startOfWeek = today.AddDays(-(int)today.DayOfWeek);
        var workoutsThisWeek = await _context.WorkoutLogs
            .CountAsync(x => x.UserId == userId && x.Date >= startOfWeek, ct);

        var last7Logs = await _context.MealLogs
            .AsNoTracking()
            .Where(x => x.UserId == userId && x.Date >= today.AddDays(-6))
            .Include(x => x.Entries)
            .ToListAsync(ct);
        var avgProtein = last7Logs.Any() ? (decimal)last7Logs.Average(l => l.Entries.Sum(e => e.ProteinG)) : 0m;

        foreach (var goal in goals)
        {
            goal.CurrentValue = goal.Type switch
            {
                GoalType.TargetWeight => latestWeight?.WeightKg ?? goal.CurrentValue,
                GoalType.WeeklyWorkouts => workoutsThisWeek,
                GoalType.DailyProtein => avgProtein,
                _ => goal.CurrentValue
            };

            if (goal.CurrentValue >= goal.TargetValue)
                goal.Status = GoalStatus.Completed;
        }

        await _context.SaveChangesAsync(ct);
    }
}
