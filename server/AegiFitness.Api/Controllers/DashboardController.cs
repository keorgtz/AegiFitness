using AegiFitness.Api.Data;
using AegiFitness.Api.Domain;
using AegiFitness.Api.Dtos;
using AegiFitness.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace AegiFitness.Api.Controllers;

[ApiController]
[Route("api/dashboard")]
[Authorize(Policy = "ActiveLicense")]
public class DashboardController : ControllerBase
{
    private readonly AppDbContext _context;
    private readonly GamificationService _gamification;

    public DashboardController(AppDbContext context, GamificationService gamification)
    {
        _context = context;
        _gamification = gamification;
    }

    [HttpGet("summary")]
    public async Task<ActionResult<DashboardSummaryDto>> Summary()
    {
        var userId = CurrentUserId();
        var user = await _context.Users.AsNoTracking().FirstOrDefaultAsync(x => x.Id == userId);
        if (user is null) return Unauthorized();

        var xp = await _gamification.GetTotalXpAsync(userId);
        var level = _gamification.LevelForXp(xp);
        var title = _gamification.TitleForLevel(level);
        var streak = await _gamification.GetStreakDaysAsync(userId);

        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var dayOfWeek = (int)today.DayOfWeek;

        var plan = await _context.WorkoutPlans
            .AsNoTracking()
            .Include(x => x.Days)
            .ThenInclude(d => d.Items)
            .ThenInclude(i => i.Exercise)
            .Where(x => x.UserId == userId && x.IsActive)
            .OrderByDescending(x => x.CreatedAt)
            .FirstOrDefaultAsync();

        var planDay = plan?.Days.FirstOrDefault(d => d.DayOfWeek == dayOfWeek);
        var workoutLog = await _context.WorkoutLogs.AsNoTracking().FirstOrDefaultAsync(x => x.UserId == userId && x.Date == today);

        var mealPlan = await _context.MealPlans
            .AsNoTracking()
            .Include(x => x.Items)
            .FirstOrDefaultAsync(x => x.UserId == userId && x.Date == today);

        var mealLog = await _context.MealLogs
            .AsNoTracking()
            .Include(x => x.Entries)
            .FirstOrDefaultAsync(x => x.UserId == userId && x.Date == today);

        var latestWeight = await _context.WeightEntries
            .AsNoTracking()
            .Where(x => x.UserId == userId)
            .OrderByDescending(x => x.Date)
            .FirstOrDefaultAsync();

        var weight7dAgo = await _context.WeightEntries
            .AsNoTracking()
            .Where(x => x.UserId == userId && x.Date <= today.AddDays(-7))
            .OrderByDescending(x => x.Date)
            .FirstOrDefaultAsync();

        var startOfWeek = today.AddDays(-(int)today.DayOfWeek);
        var workoutsPlanned = plan?.Days.Count ?? 0;
        var workoutsDone = await _context.WorkoutLogs.CountAsync(x => x.UserId == userId && x.Date >= startOfWeek);

        var recentAchievements = await _context.UserAchievements
            .AsNoTracking()
            .Where(x => x.UserId == userId && x.UnlockedAt.HasValue)
            .OrderByDescending(x => x.UnlockedAt)
            .Take(3)
            .Select(x => new AchievementDto(
                x.Achievement.Code,
                x.Achievement.Name,
                x.Achievement.Description,
                x.Achievement.Icon,
                x.Achievement.Category,
                x.Achievement.XpReward,
                x.Progress,
                x.Achievement.Threshold,
                x.UnlockedAt))
            .ToArrayAsync();

        var result = new DashboardSummaryDto(
            new DashboardUserDto(user.DisplayName, level, title, xp, _gamification.XpForLevel(level + 1) - xp, streak),
            new DashboardTodayDto(
                today,
                new DashboardWorkoutDto(
                    planDay?.Id,
                    planDay?.Focus ?? "Descanso",
                    planDay?.Modality ?? Modality.Rest,
                    planDay?.Items.Count ?? 0,
                    workoutLog?.Entries.Any(e => e.Completed) ?? false,
                    workoutLog?.Id),
                new DashboardMealsDto(
                    mealPlan?.TargetCalories ?? 0,
                    mealLog?.Entries.Sum(e => e.Calories) ?? 0,
                    mealPlan?.TargetProteinG ?? 0,
                    mealLog?.Entries.Sum(e => e.ProteinG) ?? 0,
                    mealLog?.Entries.Count ?? 0,
                    mealPlan?.Items.Count ?? 0)),
            new DashboardWeekDto(workoutsPlanned, workoutsDone),
            latestWeight?.WeightKg,
            latestWeight is not null && weight7dAgo is not null ? latestWeight.WeightKg - weight7dAgo.WeightKg : null,
            recentAchievements);

        return Ok(result);
    }

    private Guid CurrentUserId() => Guid.Parse(User.FindFirst("sub")?.Value ?? Guid.Empty.ToString());
}
