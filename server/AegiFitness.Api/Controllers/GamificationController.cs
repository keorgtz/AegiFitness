using AegiFitness.Api.Data;
using AegiFitness.Api.Dtos;
using AegiFitness.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace AegiFitness.Api.Controllers;

[ApiController]
[Route("api/gamification")]
[Authorize(Policy = "ActiveLicense")]
public class GamificationController : ControllerBase
{
    private readonly AppDbContext _context;
    private readonly GamificationService _gamification;

    public GamificationController(AppDbContext context, GamificationService gamification)
    {
        _context = context;
        _gamification = gamification;
    }

    [HttpGet("summary")]
    public async Task<ActionResult<GamificationSummaryDto>> Summary()
    {
        var userId = CurrentUserId();
        var xp = await _gamification.GetTotalXpAsync(userId);
        var level = _gamification.LevelForXp(xp);
        var title = _gamification.TitleForLevel(level);
        var xpForLevel = _gamification.XpForLevel(level);
        var xpForNext = _gamification.XpForLevel(level + 1);
        var streak = await _gamification.GetStreakDaysAsync(userId);

        var userAchievements = await _context.UserAchievements
            .AsNoTracking()
            .Where(x => x.UserId == userId)
            .ToDictionaryAsync(x => x.AchievementId);

        var achievements = await _context.Achievements.AsNoTracking().ToListAsync();

        var achievementDtos = achievements.Select(a =>
        {
            userAchievements.TryGetValue(a.Id, out var ua);
            return new AchievementDto(
                a.Code,
                a.Name,
                a.Description,
                a.Icon,
                a.Category,
                a.XpReward,
                ua?.Progress ?? 0,
                a.Threshold,
                ua?.UnlockedAt);
        }).ToArray();

        var goals = await _context.UserGoals
            .AsNoTracking()
            .Where(x => x.UserId == userId)
            .OrderByDescending(x => x.CreatedAt)
            .Select(g => new UserGoalDto(
                g.Id,
                g.Type,
                g.Title,
                g.TargetValue,
                g.CurrentValue,
                g.Unit,
                g.Deadline,
                g.Status,
                g.CreatedAt))
            .ToArrayAsync();

        return Ok(new GamificationSummaryDto(
            xp,
            level,
            title,
            xp - xpForLevel,
            xpForNext - xpForLevel,
            streak,
            achievementDtos,
            goals));
    }

    private Guid CurrentUserId() => Guid.Parse(User.FindFirst("sub")?.Value ?? Guid.Empty.ToString());
}
