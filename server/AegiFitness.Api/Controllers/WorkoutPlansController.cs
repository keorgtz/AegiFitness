using AegiFitness.Api.Data;
using AegiFitness.Api.Domain;
using AegiFitness.Api.Dtos;
using AegiFitness.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace AegiFitness.Api.Controllers;

[ApiController]
[Route("api/workout-plans")]
[Authorize(Policy = "ActiveLicense")]
public class WorkoutPlansController : ControllerBase
{
    private readonly AppDbContext _context;
    private readonly WorkoutPlanGenerator _generator;

    public WorkoutPlansController(AppDbContext context, WorkoutPlanGenerator generator)
    {
        _context = context;
        _generator = generator;
    }

    [HttpGet("current")]
    public async Task<ActionResult<WorkoutPlanDto>> Current()
    {
        var userId = CurrentUserId();
        var plan = await _context.WorkoutPlans
            .AsNoTracking()
            .Include(x => x.Days)
            .ThenInclude(d => d.Items)
            .ThenInclude(i => i.Exercise)
            .Where(x => x.UserId == userId && x.IsActive)
            .OrderByDescending(x => x.CreatedAt)
            .FirstOrDefaultAsync();

        if (plan is null)
        {
            var config = await _context.TrainingConfigs
                .Include(x => x.Days)
                .FirstOrDefaultAsync(x => x.UserId == userId);
            if (config is null) return NotFound(new { message = "Configuración de entrenamiento no encontrada." });

            var profile = await _context.UserProfiles.AsNoTracking().FirstOrDefaultAsync(x => x.UserId == userId);
            plan = await _generator.GenerateAsync(userId, config, profile?.Goal ?? Goal.Recomposition);
        }

        return Ok(Map(plan));
    }

    [HttpPost("regenerate")]
    public async Task<ActionResult<WorkoutPlanDto>> Regenerate()
    {
        var userId = CurrentUserId();
        var config = await _context.TrainingConfigs
            .Include(x => x.Days)
            .FirstOrDefaultAsync(x => x.UserId == userId);
        if (config is null) return NotFound();

        var profile = await _context.UserProfiles.AsNoTracking().FirstOrDefaultAsync(x => x.UserId == userId);
        var plan = await _generator.GenerateAsync(userId, config, profile?.Goal ?? Goal.Recomposition);
        return Ok(Map(plan));
    }

    private static WorkoutPlanDto Map(WorkoutPlan p) => new(
        p.Id,
        p.CreatedAt,
        p.IsActive,
        p.Days.OrderBy(d => d.DayOfWeek).Select(d => new WorkoutPlanDayDto(
            d.Id,
            d.DayOfWeek,
            d.Modality,
            d.Focus,
            d.Items.OrderBy(i => i.Order).Select(i => new WorkoutPlanItemDto(
                i.Id,
                i.ExerciseId,
                i.Order,
                i.Sets,
                i.RepsMin,
                i.RepsMax,
                i.RestSeconds,
                i.Notes,
                new ExerciseDto(
                    i.Exercise.Id,
                    i.Exercise.Name,
                    i.Exercise.MuscleGroup,
                    i.Exercise.Type,
                    i.Exercise.Objective,
                    i.Exercise.Difficulty,
                    i.Exercise.Equipment,
                    i.Exercise.Description,
                    i.Exercise.Instructions,
                    i.Exercise.Target,
                    i.Exercise.Effect))).ToArray())).ToArray());

    private Guid CurrentUserId() => Guid.Parse(User.FindFirst("sub")?.Value ?? Guid.Empty.ToString());
}
