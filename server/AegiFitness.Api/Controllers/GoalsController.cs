using AegiFitness.Api.Data;
using AegiFitness.Api.Domain;
using AegiFitness.Api.Dtos;
using AegiFitness.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace AegiFitness.Api.Controllers;

[ApiController]
[Route("api/goals")]
[Authorize(Policy = "ActiveLicense")]
public class GoalsController : ControllerBase
{
    private readonly AppDbContext _context;
    private readonly GamificationService _gamification;

    public GoalsController(AppDbContext context, GamificationService gamification)
    {
        _context = context;
        _gamification = gamification;
    }

    [HttpGet]
    public async Task<ActionResult<UserGoalDto[]>> List()
    {
        var userId = CurrentUserId();
        await _gamification.UpdateGoalsAsync(userId, await LatestActivityDateAsync(userId));
        var goals = await _context.UserGoals
            .AsNoTracking()
            .Where(x => x.UserId == userId)
            .OrderByDescending(x => x.CreatedAt)
            .Select(g => Map(g))
            .ToArrayAsync();
        return Ok(goals);
    }

    [HttpPost]
    public async Task<ActionResult<UserGoalDto>> Create(UserGoalCreateDto dto)
    {
        var userId = CurrentUserId();
        var goal = new UserGoal
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            Type = dto.Type,
            Title = dto.Title,
            TargetValue = dto.TargetValue,
            Unit = dto.Unit,
            Deadline = dto.Deadline.HasValue
                ? DateTime.SpecifyKind(dto.Deadline.Value, DateTimeKind.Utc)
                : null
        };
        _context.UserGoals.Add(goal);
        await _context.SaveChangesAsync();
        await _gamification.UpdateGoalsAsync(userId, await LatestActivityDateAsync(userId));
        await _context.Entry(goal).ReloadAsync();
        return Ok(Map(goal));
    }

    private async Task<DateOnly?> LatestActivityDateAsync(Guid userId)
    {
        var w = await _context.WorkoutLogs.Where(x => x.UserId == userId).MaxAsync(x => (DateOnly?)x.Date);
        var m = await _context.MealLogs.Where(x => x.UserId == userId).MaxAsync(x => (DateOnly?)x.Date);
        var latest = new[] { w, m }.Where(d => d.HasValue).Select(d => d!.Value).DefaultIfEmpty().Max();
        return latest == default ? null : latest;
    }

    [HttpPut("{id:guid}")]
    public async Task<ActionResult<UserGoalDto>> Update(Guid id, UserGoalUpdateDto dto)
    {
        var userId = CurrentUserId();
        var goal = await _context.UserGoals.FirstOrDefaultAsync(x => x.Id == id && x.UserId == userId);
        if (goal is null) return NotFound();

        if (dto.Status.HasValue)
            goal.Status = dto.Status.Value;

        await _context.SaveChangesAsync();
        return Ok(Map(goal));
    }

    private static UserGoalDto Map(UserGoal g) => new(
        g.Id,
        g.Type,
        g.Title,
        g.TargetValue,
        g.CurrentValue,
        g.Unit,
        g.Deadline,
        g.Status,
        g.CreatedAt);

    private Guid CurrentUserId() => Guid.Parse(User.FindFirst("sub")?.Value ?? Guid.Empty.ToString());
}
