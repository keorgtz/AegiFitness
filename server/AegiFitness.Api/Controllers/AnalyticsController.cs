using AegiFitness.Api.Data;
using AegiFitness.Api.Domain;
using AegiFitness.Api.Dtos;
using AegiFitness.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace AegiFitness.Api.Controllers;

[ApiController]
[Route("api/analytics")]
[Authorize(Policy = "ActiveLicense")]
public class AnalyticsController : ControllerBase
{
    private readonly AppDbContext _context;
    private readonly PlanCalculator _calculator;

    public AnalyticsController(AppDbContext context, PlanCalculator calculator)
    {
        _context = context;
        _calculator = calculator;
    }

    [HttpGet("exercises")]
    public async Task<ActionResult<ExerciseHistoryDto[]>> ExerciseHistory([FromQuery] DateOnly? from, [FromQuery] DateOnly? to)
    {
        var end = to ?? DateOnly.FromDateTime(DateTime.UtcNow);
        var start = from ?? end.AddYears(-1);
        if (start > end || end.DayNumber - start.DayNumber > 1095) return BadRequest(new { message = "El período máximo es de tres años." });

        var logs = await WorkoutQuery(CurrentUserId()).Where(x => x.Date >= start && x.Date <= end).OrderBy(x => x.Date).ToListAsync();
        var histories = logs.SelectMany(log => log.Entries.Select(entry => new { log.Date, Entry = entry, Stats = GetStats(entry) }))
            .GroupBy(x => x.Entry.ExerciseId)
            .Select(group =>
            {
                var points = group.GroupBy(x => x.Date).Select(day => new ExerciseHistoryPointDto(day.Key,
                    day.Sum(x => x.Stats.Volume), day.Max(x => x.Stats.MaxWeight), day.Sum(x => x.Stats.TotalReps),
                    day.Max(x => x.Stats.EstimatedOneRepMax), day.Sum(x => x.Stats.CompletedSets))).OrderBy(x => x.Date).ToArray();
                var latest = points[^1];
                var previous = points.Length > 1 ? points[^2] : null;
                var trend = previous is not null && previous.VolumeKg > 0 ? Math.Round((latest.VolumeKg - previous.VolumeKg) / previous.VolumeKg * 100m, 1) : 0;
                var exercise = group.Last().Entry.Exercise;
                return new ExerciseHistoryDto(MapExercise(exercise), points.Length, latest.Date, points.Sum(x => x.VolumeKg),
                    points.Max(x => x.MaxWeightKg), group.Max(x => x.Stats.MaxReps), points.Max(x => x.EstimatedOneRepMax), trend,
                    points.TakeLast(16).ToArray());
            }).OrderByDescending(x => x.LastPerformed).ToArray();
        return Ok(histories);
    }

    [HttpGet("personal-records")]
    public async Task<ActionResult<PersonalRecordDto[]>> PersonalRecords()
    {
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var logs = await WorkoutQuery(CurrentUserId()).OrderBy(x => x.Date).ToListAsync();
        var records = logs.SelectMany(log => log.Entries.Select(entry => new { log.Date, Entry = entry, Stats = GetStats(entry) }))
            .GroupBy(x => x.Entry.ExerciseId)
            .Select(group =>
            {
                var bestWeight = group.OrderByDescending(x => x.Stats.MaxWeight).ThenByDescending(x => x.Stats.RepsAtMaxWeight).First();
                var bestReps = group.OrderByDescending(x => x.Stats.MaxReps).First();
                var bestOneRm = group.OrderByDescending(x => x.Stats.EstimatedOneRepMax).First();
                var sessions = group.GroupBy(x => x.Date).Select(day => new { Date = day.Key, Volume = day.Sum(x => x.Stats.Volume) }).ToArray();
                var bestVolume = sessions.OrderByDescending(x => x.Volume).First();
                var latestRecord = new[] { bestWeight.Date, bestReps.Date, bestOneRm.Date, bestVolume.Date }.Max();
                return new PersonalRecordDto(MapExercise(group.Last().Entry.Exercise), bestWeight.Stats.MaxWeight,
                    bestWeight.Stats.RepsAtMaxWeight, bestWeight.Stats.MaxWeight > 0 ? bestWeight.Date : null,
                    bestReps.Stats.MaxReps, bestReps.Stats.MaxReps > 0 ? bestReps.Date : null,
                    bestOneRm.Stats.EstimatedOneRepMax, bestOneRm.Stats.EstimatedOneRepMax > 0 ? bestOneRm.Date : null,
                    bestVolume.Volume, bestVolume.Volume > 0 ? bestVolume.Date : null, sessions.Length,
                    latestRecord >= today.AddDays(-30));
            }).OrderByDescending(x => x.ImprovedRecently).ThenByDescending(x => x.BestEstimatedOneRepMax).ToArray();
        return Ok(records);
    }

    [HttpGet("calendar")]
    public async Task<ActionResult<FitnessCalendarDayDto[]>> Calendar([FromQuery] DateOnly from, [FromQuery] DateOnly to)
    {
        if (from > to || to.DayNumber - from.DayNumber > 400) return BadRequest(new { message = "El período del calendario no es válido." });
        return Ok(await BuildCalendarAsync(CurrentUserId(), from, to));
    }

    [HttpGet("adherence")]
    public async Task<ActionResult<AdherenceSummaryDto>> Adherence([FromQuery] DateOnly? date)
    {
        var today = date ?? DateOnly.FromDateTime(DateTime.UtcNow);
        var days = await BuildCalendarAsync(CurrentUserId(), today.AddDays(-89), today);
        int Avg(int count, Func<FitnessCalendarDayDto, int?> selector)
        {
            var values = days.Where(x => x.IsTracked && x.Date > today.AddDays(-count)).Select(selector).Where(x => x.HasValue).Select(x => x!.Value).ToArray();
            return values.Length == 0 ? 0 : (int)Math.Round(values.Average());
        }
        var weekly = Enumerable.Range(0, 12).Select(index =>
        {
            var start = today.AddDays(-((11 - index) * 7 + 6)); var end = start.AddDays(6);
            var slice = days.Where(x => x.IsTracked && x.Date >= start && x.Date <= end).ToArray();
            return new AdherenceWeekDto(start, AverageNullable(slice.Select(x => x.TrainingAdherence)),
                AverageNullable(slice.Select(x => x.NutritionAdherence)), slice.Length == 0 ? 0 : (int)Math.Round(slice.Average(x => x.OverallAdherence)));
        }).ToArray();
        var last30 = days.Where(x => x.IsTracked && x.Date > today.AddDays(-30)).ToArray();
        return Ok(new AdherenceSummaryDto(Avg(7, x => x.TrainingAdherence), Avg(30, x => x.TrainingAdherence),
            Avg(7, x => x.NutritionAdherence), Avg(30, x => x.NutritionAdherence), AvgOverall(days, today, 7),
            AvgOverall(days, today, 30), CalculateStreak(days, today, x => x.TrainingAdherence, x => x.IsRestDay),
            CalculateStreak(days, today, x => x.NutritionAdherence, _ => false), CalculateStreak(days, today, x => x.OverallAdherence, _ => false),
            last30.Count(x => x.OverallAdherence >= 90), last30.Count(x => !x.IsRestDay),
            last30.Count(x => x.TrainingAdherence >= 80), weekly));
    }

    private async Task<FitnessCalendarDayDto[]> BuildCalendarAsync(Guid userId, DateOnly from, DateOnly to)
    {
        var plan = await _context.WorkoutPlans.AsNoTracking().Where(x => x.UserId == userId && x.IsActive)
            .Include(x => x.Days).ThenInclude(x => x.Items).OrderByDescending(x => x.CreatedAt).FirstOrDefaultAsync();
        var workouts = await WorkoutQuery(userId).Where(x => x.Date >= from && x.Date <= to).ToListAsync();
        var allWorkouts = await WorkoutQuery(userId).Where(x => x.Date <= to).OrderBy(x => x.Date).ToListAsync();
        var mealLogs = await _context.MealLogs.AsNoTracking().Where(x => x.UserId == userId && x.Date >= from && x.Date <= to).Include(x => x.Entries).ToListAsync();
        var mealPlans = await _context.MealPlans.AsNoTracking().Where(x => x.UserId == userId && x.Date >= from && x.Date <= to).ToListAsync();
        var measurements = await _context.WeightEntries.AsNoTracking().Where(x => x.UserId == userId && x.Date >= from && x.Date <= to).Select(x => x.Date).ToListAsync();
        var profile = await _context.UserProfiles.AsNoTracking().FirstOrDefaultAsync(x => x.UserId == userId);
        var memberSince = DateOnly.FromDateTime(await _context.Users.AsNoTracking().Where(x => x.Id == userId).Select(x => x.CreatedAt).FirstAsync());
        MacroTargets? fallbackTargets = null;
        if (profile is not null)
        {
            var calories = _calculator.Tdee(profile.Sex, profile.BirthDate, profile.HeightCm, profile.WeightKg, profile.ActivityFactor, profile.Goal);
            if (calories > 0) fallbackTargets = _calculator.Macros(profile.WeightKg, profile.Goal, calories);
        }
        var prByDate = CalculateRecordDates(allWorkouts).Where(x => x.Key >= from).ToDictionary(x => x.Key, x => x.Value);
        var result = new List<FitnessCalendarDayDto>();
        for (var date = from; date <= to; date = date.AddDays(1))
        {
            var log = workouts.FirstOrDefault(x => x.Date == date);
            var isTracked = date >= memberSince;
            var planDay = plan is not null && date >= DateOnly.FromDateTime(plan.CreatedAt)
                ? plan.Days.FirstOrDefault(x => x.DayOfWeek == (int)date.DayOfWeek)
                : null;
            var scheduledSets = planDay?.Items.Sum(x => x.Sets) ?? 0;
            var isRest = (planDay is null || planDay.Modality == Modality.Rest || scheduledSets == 0) && log is null;
            var plannedSets = log?.Entries.Sum(x => x.PlannedSets) ?? scheduledSets;
            var completedSets = log?.Entries.Sum(x => GetStats(x).CompletedSets) ?? 0;
            int? trainingScore = !isTracked ? null : !isRest || log is not null ? (plannedSets > 0 ? Math.Clamp((int)Math.Round(completedSets * 100m / plannedSets), 0, 100) : completedSets > 0 ? 100 : 0) : null;

            var mealLog = mealLogs.FirstOrDefault(x => x.Date == date);
            var mealPlan = mealPlans.FirstOrDefault(x => x.Date == date);
            var calories = mealLog?.Entries.Sum(x => x.Calories) ?? 0;
            var protein = mealLog?.Entries.Sum(x => x.ProteinG) ?? 0;
            var carbs = mealLog?.Entries.Sum(x => x.CarbsG) ?? 0;
            var fat = mealLog?.Entries.Sum(x => x.FatG) ?? 0;
            var targets = mealPlan is not null ? new MacroTargets(mealPlan.TargetCalories, mealPlan.TargetProteinG, mealPlan.TargetCarbsG, mealPlan.TargetFatG) : fallbackTargets;
            int? nutritionScore = !isTracked ? null : targets is not null ? (mealLog is null ? 0 : NutritionScore(calories, protein, carbs, fat, targets)) : mealLog is not null ? 100 : null;
            var available = new[] { trainingScore, nutritionScore }.Where(x => x.HasValue).Select(x => x!.Value).ToArray();
            var overall = available.Length == 0 ? 0 : (int)Math.Round(available.Average());
            result.Add(new FitnessCalendarDayDto(date, isTracked, log is not null, mealLog is not null, measurements.Contains(date), isRest,
                trainingScore, nutritionScore, overall, completedSets, plannedSets, calories, targets?.Calories ?? 0,
                log?.Entries.Sum(x => GetStats(x).Volume) ?? 0, prByDate.GetValueOrDefault(date)));
        }
        return result.ToArray();
    }

    private IQueryable<WorkoutLog> WorkoutQuery(Guid userId) => _context.WorkoutLogs.AsNoTracking().Where(x => x.UserId == userId)
        .Include(x => x.Entries).ThenInclude(x => x.Exercise).Include(x => x.Entries).ThenInclude(x => x.Sets);

    private static EntryStats GetStats(WorkoutLogEntry entry)
    {
        if (entry.Sets.Count > 0)
        {
            var sets = entry.Sets.Where(x => x.Completed).ToArray();
            if (sets.Length == 0) return new EntryStats(0, 0, 0, 0, 0, 0, 0);
            var maxWeightSet = sets.OrderByDescending(x => x.ActualWeightKg ?? 0).ThenByDescending(x => x.ActualReps ?? 0).FirstOrDefault();
            return new EntryStats(sets.Length, sets.Sum(x => x.ActualReps ?? 0), sets.Max(x => x.ActualReps ?? 0),
                maxWeightSet?.ActualWeightKg ?? 0, maxWeightSet?.ActualReps ?? 0,
                sets.Sum(x => (x.ActualWeightKg ?? 0) * (x.ActualReps ?? 0)),
                sets.Max(x => EstimateOneRepMax(x.ActualWeightKg ?? 0, x.ActualReps ?? 0)));
        }
        var completed = entry.ActualSets ?? (entry.Completed ? entry.PlannedSets : 0);
        var reps = entry.ActualReps ?? entry.PlannedReps; var weight = entry.ActualWeightKg ?? 0;
        return new EntryStats(completed, completed * reps, reps, weight, reps, completed * reps * weight, EstimateOneRepMax(weight, reps));
    }

    private static decimal EstimateOneRepMax(decimal weight, int reps) => weight <= 0 || reps <= 0 ? 0 : Math.Round(weight * (1m + Math.Min(reps, 30) / 30m), 1);
    private static int NutritionScore(int calories, int protein, int carbs, int fat, MacroTargets targets) => (int)Math.Round(
        BandScore(calories, targets.Calories, .10m) * .4m + BandScore(protein, targets.ProteinG, .10m, true) * .3m +
        BandScore(carbs, targets.CarbsG, .20m) * .15m + BandScore(fat, targets.FatG, .20m) * .15m);
    private static decimal BandScore(decimal actual, decimal target, decimal tolerance, bool minimumOnly = false)
    {
        if (target <= 0) return 0;
        var ratio = actual / target;
        if (minimumOnly) return ratio >= 1 - tolerance ? 100 : Math.Clamp(ratio / (1 - tolerance) * 100, 0, 100);
        var deviation = Math.Abs(ratio - 1); if (deviation <= tolerance) return 100;
        return Math.Clamp(100 - (deviation - tolerance) / (tolerance * 2) * 100, 0, 100);
    }
    private static Dictionary<DateOnly, int> CalculateRecordDates(IEnumerable<WorkoutLog> logs)
    {
        var best = new Dictionary<int, EntryStats>(); var result = new Dictionary<DateOnly, int>();
        foreach (var log in logs.OrderBy(x => x.Date))
        {
            var improvedToday = new HashSet<int>();
            foreach (var entry in log.Entries)
            {
                var stats = GetStats(entry);
                var previous = best.GetValueOrDefault(entry.ExerciseId);
                var improved = previous is null || stats.MaxWeight > previous.MaxWeight || stats.MaxReps > previous.MaxReps ||
                    stats.EstimatedOneRepMax > previous.EstimatedOneRepMax || stats.Volume > previous.Volume;
                if (!improved) continue;
                best[entry.ExerciseId] = previous is null ? stats : new EntryStats(
                    Math.Max(previous.CompletedSets, stats.CompletedSets), Math.Max(previous.TotalReps, stats.TotalReps),
                    Math.Max(previous.MaxReps, stats.MaxReps), Math.Max(previous.MaxWeight, stats.MaxWeight),
                    stats.MaxWeight >= previous.MaxWeight ? stats.RepsAtMaxWeight : previous.RepsAtMaxWeight,
                    Math.Max(previous.Volume, stats.Volume), Math.Max(previous.EstimatedOneRepMax, stats.EstimatedOneRepMax));
                improvedToday.Add(entry.ExerciseId);
            }
            if (improvedToday.Count > 0) result[log.Date] = improvedToday.Count;
        }
        return result;
    }
    private static int AverageNullable(IEnumerable<int?> values) { var data = values.Where(x => x.HasValue).Select(x => x!.Value).ToArray(); return data.Length == 0 ? 0 : (int)Math.Round(data.Average()); }
    private static int AvgOverall(IEnumerable<FitnessCalendarDayDto> days, DateOnly today, int count) { var data = days.Where(x => x.IsTracked && x.Date > today.AddDays(-count)).ToArray(); return data.Length == 0 ? 0 : (int)Math.Round(data.Average(x => x.OverallAdherence)); }
    private static int CalculateStreak(IEnumerable<FitnessCalendarDayDto> source, DateOnly today, Func<FitnessCalendarDayDto, int?> selector, Func<FitnessCalendarDayDto, bool> skip)
    {
        var streak = 0; var firstRelevant = true;
        foreach (var day in source.OrderByDescending(x => x.Date))
        {
            if (!day.IsTracked) continue;
            if (skip(day)) continue;
            var score = selector(day);
            if (!score.HasValue) { if (firstRelevant && day.Date == today) continue; break; }
            if (firstRelevant && day.Date == today && score.Value < 80) { firstRelevant = false; continue; }
            firstRelevant = false; if (score.Value < 80) break; streak++;
        }
        return streak;
    }
    private static ExerciseDto MapExercise(Exercise ex) => new(ex.Id, ex.Name, ex.MuscleGroup, ex.Type, ex.Objective, ex.Difficulty,
        ex.Equipment, ex.Description, ex.Instructions, ex.Target, ex.Effect, ex.ImageSlug, ex.ImageVariants);
    private Guid CurrentUserId() => Guid.Parse(User.FindFirst("sub")?.Value ?? Guid.Empty.ToString());
    private sealed record EntryStats(int CompletedSets, int TotalReps, int MaxReps, decimal MaxWeight, int RepsAtMaxWeight, decimal Volume, decimal EstimatedOneRepMax);
}
