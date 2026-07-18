using AegiFitness.Api.Data;
using AegiFitness.Api.Domain;
using AegiFitness.Api.Dtos;
using AegiFitness.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace AegiFitness.Api.Controllers;

[ApiController]
[Route("api/meal-plans")]
[Authorize(Policy = "ActiveLicense")]
public class MealPlansController : ControllerBase
{
    private readonly AppDbContext _context;
    private readonly MealPlanGenerator _generator;

    public MealPlansController(AppDbContext context, MealPlanGenerator generator)
    {
        _context = context;
        _generator = generator;
    }

    [HttpGet("today")]
    public async Task<ActionResult<MealPlanDto>> Today([FromQuery] DateOnly? date)
    {
        var userId = CurrentUserId();
        var targetDate = date ?? DateOnly.FromDateTime(DateTime.UtcNow);

        var plan = await _context.MealPlans
            .AsNoTracking()
            .Include(x => x.Items)
            .ThenInclude(i => i.Food)
            .FirstOrDefaultAsync(x => x.UserId == userId && x.Date == targetDate);

        if (plan is null)
            plan = await _generator.GenerateForDateAsync(userId, targetDate);

        return Ok(Map(plan));
    }

    [HttpPost("regenerate")]
    public async Task<ActionResult<MealPlanDto>> Regenerate([FromQuery] DateOnly? date)
    {
        var userId = CurrentUserId();
        var targetDate = date ?? DateOnly.FromDateTime(DateTime.UtcNow);
        var plan = await _generator.GenerateForDateAsync(userId, targetDate);
        return Ok(Map(plan));
    }

    private static MealPlanDto Map(MealPlan p)
    {
        var items = p.Items.Select(i => new MealPlanItemDto(
            i.Id,
            new FoodDto(
                i.Food.Id,
                i.Food.Name,
                i.Food.MealType,
                i.Food.Objective,
                i.Food.Calories,
                i.Food.ProteinG,
                i.Food.CarbsG,
                i.Food.FatG,
                i.Food.SugarsG,
                i.Food.Portions,
                i.Food.Ingredients,
                i.Food.Steps,
                i.Food.Description),
            i.MealType,
            i.Servings,
            i.Eaten,
            (int)Math.Round(i.Food.Calories * i.Servings),
            (int)Math.Round(i.Food.ProteinG * i.Servings),
            (int)Math.Round(i.Food.CarbsG * i.Servings),
            (int)Math.Round(i.Food.FatG * i.Servings))).ToArray();

        return new MealPlanDto(
            p.Id,
            p.Date,
            p.TargetCalories,
            p.TargetProteinG,
            p.TargetCarbsG,
            p.TargetFatG,
            items,
            items.Sum(i => i.Calories),
            items.Sum(i => i.ProteinG),
            items.Sum(i => i.CarbsG),
            items.Sum(i => i.FatG));
    }

    private Guid CurrentUserId() => Guid.Parse(User.FindFirst("sub")?.Value ?? Guid.Empty.ToString());
}
