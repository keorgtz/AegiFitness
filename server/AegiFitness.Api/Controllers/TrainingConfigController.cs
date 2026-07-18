using AegiFitness.Api.Data;
using AegiFitness.Api.Domain;
using AegiFitness.Api.Dtos;
using AegiFitness.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace AegiFitness.Api.Controllers;

[ApiController]
[Route("api/training-config")]
[Authorize(Policy = "ActiveLicense")]
public class TrainingConfigController : ControllerBase
{
    private readonly AppDbContext _context;
    private readonly WorkoutPlanGenerator _workoutGenerator;

    public TrainingConfigController(AppDbContext context, WorkoutPlanGenerator workoutGenerator)
    {
        _context = context;
        _workoutGenerator = workoutGenerator;
    }

    [HttpGet]
    public async Task<ActionResult<TrainingConfigDto>> Get()
    {
        var userId = CurrentUserId();
        var config = await _context.TrainingConfigs
            .AsNoTracking()
            .Include(x => x.Days)
            .FirstOrDefaultAsync(x => x.UserId == userId);

        if (config is null) return NotFound();
        return Ok(Map(config));
    }

    [HttpPut]
    public async Task<ActionResult<TrainingConfigDto>> Update(TrainingConfigUpdateDto dto)
    {
        var userId = CurrentUserId();
        var config = await _context.TrainingConfigs
            .Include(x => x.Days)
            .FirstOrDefaultAsync(x => x.UserId == userId);

        if (config is null)
        {
            config = new TrainingConfig { UserId = userId };
            _context.TrainingConfigs.Add(config);
        }
        else
        {
            _context.TrainingDayConfigs.RemoveRange(config.Days);
        }

        config.GymMode = dto.GymMode;
        config.CalisthenicsMode = dto.CalisthenicsMode;
        config.UpdatedAt = DateTime.UtcNow;
        var newDays = dto.Days.Select(d => new TrainingDayConfig
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            TrainingConfigId = userId,
            DayOfWeek = d.DayOfWeek,
            Modality = d.Modality,
            MuscleGroups = string.Join(",", d.MuscleGroups)
        }).ToList();

        _context.TrainingDayConfigs.AddRange(newDays);
        config.Days = newDays;

        await _context.SaveChangesAsync();

        var profile = await _context.UserProfiles.AsNoTracking().FirstOrDefaultAsync(x => x.UserId == userId);
        await _workoutGenerator.GenerateAsync(userId, config, profile?.Goal ?? Goal.Recomposition);

        return Ok(Map(config));
    }

    private static TrainingConfigDto Map(TrainingConfig c) => new(
        c.GymMode,
        c.CalisthenicsMode,
        c.Days.OrderBy(d => d.DayOfWeek).Select(d => new TrainingDayConfigDto(
            d.DayOfWeek,
            d.Modality,
            d.MuscleGroups.Split(',', StringSplitOptions.RemoveEmptyEntries).Select(s => Enum.Parse<MuscleGroup>(s)).ToArray())).ToArray());

    private Guid CurrentUserId() => Guid.Parse(User.FindFirst("sub")?.Value ?? Guid.Empty.ToString());
}
