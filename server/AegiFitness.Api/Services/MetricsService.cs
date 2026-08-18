using AegiFitness.Api.Data;
using AegiFitness.Api.Domain;
using Microsoft.EntityFrameworkCore;

namespace AegiFitness.Api.Services;

public class MetricsService
{
    private readonly AppDbContext _context;
    private readonly GamificationService _gamification;
    private readonly ICacheService _cache;

    public MetricsService(AppDbContext context, GamificationService gamification, ICacheService cache)
    {
        _context = context;
        _gamification = gamification;
        _cache = cache;
    }

    public async Task<MetricsSummary> GetSummaryAsync(Guid userId, DateOnly? referenceDate = null, CancellationToken ct = default)
    {
        var cacheVersion = await _cache.GetAsync<string>($"metrics-version:{userId}", ct) ?? "0";
        var cacheKey = $"metrics:{userId}:{referenceDate?.ToString("yyyy-MM-dd") ?? "utc"}:{cacheVersion}";
        var cached = await _cache.GetAsync<MetricsSummary>(cacheKey, ct);
        if (cached is not null) return cached;

        // El cliente envía su fecha local; sin ella cae al UTC del servidor
        var today = referenceDate ?? DateOnly.FromDateTime(DateTime.UtcNow);
        var start7 = today.AddDays(-6);
        var start30 = today.AddDays(-29);
        var start14 = today.AddDays(-13);

        var workoutLogs7 = await _context.WorkoutLogs
            .AsNoTracking()
            .Where(x => x.UserId == userId && x.Date >= start7)
            .Include(x => x.Entries)
            .ThenInclude(e => e.Exercise)
            .Include(x => x.Entries)
            .ThenInclude(e => e.Sets)
            .ToListAsync(ct);

        var workoutLogs30 = await _context.WorkoutLogs
            .AsNoTracking()
            .Where(x => x.UserId == userId && x.Date >= start30)
            .ToListAsync(ct);

        var mealLogs7 = await _context.MealLogs
            .AsNoTracking()
            .Where(x => x.UserId == userId && x.Date >= start7)
            .Include(x => x.Entries)
            .ToListAsync(ct);

        var weightEntries = await _context.WeightEntries
            .AsNoTracking()
            .Where(x => x.UserId == userId)
            .OrderByDescending(x => x.Date)
            .ToListAsync(ct);

        var startOfWeek = today.AddDays(-(int)today.DayOfWeek);
        var workoutsThisWeek = await _context.WorkoutLogs
            .CountAsync(x => x.UserId == userId && x.Date >= startOfWeek, ct);

        var workoutsTotal = await _context.WorkoutLogs.CountAsync(x => x.UserId == userId, ct);
        var streak = await _gamification.GetStreakDaysAsync(userId, ct);

        var adherence7d = CalculateAdherence(workoutLogs7, mealLogs7, today, 7);
        var adherence30d = CalculateAdherence(
            await _context.WorkoutLogs.AsNoTracking().Where(x => x.UserId == userId && x.Date >= start30).Include(x => x.Entries).ToListAsync(ct),
            await _context.MealLogs.AsNoTracking().Where(x => x.UserId == userId && x.Date >= start30).Include(x => x.Entries).ToListAsync(ct),
            today, 30);

        var weightDelta30d = weightEntries.Count >= 2 && weightEntries.Last().Date <= today.AddDays(-30)
            ? weightEntries.First().WeightKg - weightEntries.Last(w => w.Date <= today.AddDays(-30)).WeightKg
            : 0;

        var xpByDay = new List<int>();
        var xpEvents = await _context.XpEvents
            .AsNoTracking()
            .Where(x => x.UserId == userId && x.CreatedAt >= start14.ToDateTime(TimeOnly.MinValue).ToUniversalTime())
            .ToListAsync(ct);

        foreach (var day in Enumerable.Range(0, 14).Select(i => today.AddDays(-13 + i)))
        {
            var start = day.ToDateTime(TimeOnly.MinValue).ToUniversalTime();
            var end = day.ToDateTime(TimeOnly.MaxValue).ToUniversalTime();
            xpByDay.Add(xpEvents.Where(e => e.CreatedAt >= start && e.CreatedAt <= end).Sum(e => e.Points));
        }

        var caloriesAvg7d = mealLogs7.Any() ? (int)Math.Round(mealLogs7.Average(l => l.Entries.Sum(e => e.Calories))) : 0;
        var proteinAvg7d = mealLogs7.Any() ? (int)Math.Round(mealLogs7.Average(l => l.Entries.Sum(e => e.ProteinG))) : 0;

        var volumeByMuscle = new Dictionary<string, decimal>();
        foreach (var log in workoutLogs7)
        {
            foreach (var entry in log.Entries)
            {
                var muscle = entry.Exercise.MuscleGroup.ToString();
                var detailedVolume = entry.Sets.Where(s => s.Completed).Sum(s => (s.ActualReps ?? 0) * (s.ActualWeightKg ?? 0));
                var volume = entry.Sets.Count > 0
                    ? detailedVolume
                    : entry.Completed && entry.ActualWeightKg.HasValue
                        ? (entry.ActualSets ?? entry.PlannedSets) * (entry.ActualReps ?? entry.PlannedReps) * entry.ActualWeightKg.Value
                        : 0;
                if (volume <= 0) continue;
                if (!volumeByMuscle.ContainsKey(muscle)) volumeByMuscle[muscle] = 0;
                volumeByMuscle[muscle] += volume;
            }
        }

        var summary = new MetricsSummary(
            adherence7d,
            adherence30d,
            workoutsThisWeek,
            workoutsTotal,
            streak,
            weightDelta30d,
            xpByDay,
            caloriesAvg7d,
            proteinAvg7d,
            volumeByMuscle.ToDictionary(x => x.Key, x => x.Value));

        await _cache.SetAsync(cacheKey, summary, TimeSpan.FromMinutes(5), ct);
        return summary;
    }

    private static decimal CalculateAdherence(List<WorkoutLog> workouts, List<MealLog> meals, DateOnly today, int days)
    {
        int daysWithActivity = 0;
        for (int i = 0; i < days; i++)
        {
            var d = today.AddDays(-i);
            if (workouts.Any(w => w.Date == d) || meals.Any(m => m.Date == d && m.Entries.Any()))
                daysWithActivity++;
        }
        // 0-100 entero; el frontend solo le añade el símbolo %
        return Math.Round((decimal)daysWithActivity / days * 100m);
    }

    public async Task InvalidateAsync(Guid userId, CancellationToken ct = default)
    {
        await _cache.SetAsync($"metrics-version:{userId}", Guid.NewGuid().ToString("N"), ct: ct);
    }
}

public record MetricsSummary(
    decimal Adherence7d,
    decimal Adherence30d,
    int WorkoutsThisWeek,
    int WorkoutsTotal,
    int CurrentStreak,
    decimal WeightDelta30d,
    List<int> XpByDay,
    int CaloriesAvg7d,
    int ProteinAvg7d,
    Dictionary<string, decimal> VolumeByMuscle);
