using AegiFitness.Api.Data;
using AegiFitness.Api.Domain;
using AegiFitness.Api.Dtos;
using AegiFitness.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace AegiFitness.Api.Controllers;

[ApiController]
[Route("api/meal-logs")]
[Authorize(Policy = "ActiveLicense")]
public class MealLogsController : ControllerBase
{
    private readonly AppDbContext _context;
    private readonly GamificationService _gamification;
    private readonly MetricsService _metrics;

    public MealLogsController(AppDbContext context, GamificationService gamification, MetricsService metrics)
    {
        _context = context;
        _gamification = gamification;
        _metrics = metrics;
    }

    [HttpGet]
    public async Task<ActionResult<MealLogDto[]>> List([FromQuery] DateOnly? from, [FromQuery] DateOnly? to)
    {
        var userId = CurrentUserId();
        var query = _context.MealLogs
            .AsNoTracking()
            .Where(x => x.UserId == userId)
            .Include(x => x.Entries)
            .ThenInclude(e => e.Food)
            .AsQueryable();

        if (from.HasValue) query = query.Where(x => x.Date >= from.Value);
        if (to.HasValue) query = query.Where(x => x.Date <= to.Value);

        var logs = await query.OrderByDescending(x => x.Date).ToListAsync();
        return Ok(logs.Select(Map).ToArray());
    }

    [HttpPost]
    public async Task<ActionResult<MealLogDto>> Create(MealLogCreateDto dto)
    {
        var userId = CurrentUserId();
        var existing = await _context.MealLogs
            .Include(x => x.Entries)
            .FirstOrDefaultAsync(x => x.UserId == userId && x.Date == dto.Date);

        if (existing is not null)
        {
            _context.MealLogEntries.RemoveRange(existing.Entries);
            _context.MealLogs.Remove(existing);
        }

        var log = new MealLog
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            Date = dto.Date
        };

        foreach (var entry in dto.Entries)
        {
            log.Entries.Add(new MealLogEntry
            {
                Id = Guid.NewGuid(),
                LogId = log.Id,
                FoodId = entry.FoodId,
                CustomName = entry.CustomName,
                MealType = entry.MealType,
                Servings = entry.Servings,
                Calories = entry.Calories,
                ProteinG = entry.ProteinG,
                CarbsG = entry.CarbsG,
                FatG = entry.FatG,
                IsExtra = entry.IsExtra
            });
        }

        _context.MealLogs.Add(log);
        await _context.SaveChangesAsync();

        var plan = await _context.MealPlans.AsNoTracking().FirstOrDefaultAsync(x => x.UserId == userId && x.Date == dto.Date);
        var totalCalories = log.Entries.Sum(e => e.Calories);
        var totalProtein = log.Entries.Sum(e => e.ProteinG);
        var profile = await _context.UserProfiles.AsNoTracking().FirstOrDefaultAsync(x => x.UserId == userId);
        var mealTypes = profile?.MealTypes.Split(',', StringSplitOptions.RemoveEmptyEntries).Select(s => Enum.Parse<MealType>(s)).ToArray() ?? Array.Empty<MealType>();
        var loggedTypes = log.Entries.Select(e => e.MealType).Distinct().ToArray();

        bool perfect = plan is not null
            && totalCalories >= plan.TargetCalories * 0.9m
            && totalCalories <= plan.TargetCalories * 1.1m
            && mealTypes.All(m => loggedTypes.Contains(m));

        if (perfect)
            await _gamification.AddXpAsync(userId, 40, $"Nutrición perfecta {dto.Date:yyyy-MM-dd}", HttpContext.RequestAborted);

        await _gamification.EvaluateMealLoggedAsync(userId, dto.Date, HttpContext.RequestAborted);
        if (dto.Entries.Any(e => e.IsExtra))
            await _gamification.EvaluateExtraAsync(userId, HttpContext.RequestAborted);
        await _metrics.InvalidateAsync(userId, HttpContext.RequestAborted);

        // Recargar con comidas incluidas para devolver el contrato completo
        var saved = await _context.MealLogs
            .AsNoTracking()
            .Include(x => x.Entries)
            .ThenInclude(e => e.Food)
            .FirstAsync(x => x.Id == log.Id, HttpContext.RequestAborted);

        return Ok(Map(saved));
    }

    private static FoodDto MapFood(Food f) => new(
        f.Id,
        f.Name,
        f.MealType,
        f.Objective,
        f.Calories,
        f.ProteinG,
        f.CarbsG,
        f.FatG,
        f.SugarsG,
        f.Portions,
        f.Ingredients,
        f.Steps,
        f.Description);

    private static MealLogDto Map(MealLog log) => new(
        log.Id,
        log.Date,
        log.Entries.Sum(e => e.Calories),
        log.Entries.Sum(e => e.ProteinG),
        log.Entries.Sum(e => e.CarbsG),
        log.Entries.Sum(e => e.FatG),
        log.Entries.Select(e => new MealLogEntryResponseDto(
            e.Id,
            e.FoodId,
            e.CustomName,
            e.MealType,
            e.Servings,
            e.Calories,
            e.ProteinG,
            e.CarbsG,
            e.FatG,
            e.IsExtra,
            e.Food is null ? null : MapFood(e.Food))).ToArray());

    private Guid CurrentUserId() => Guid.Parse(User.FindFirst("sub")?.Value ?? Guid.Empty.ToString());
}
