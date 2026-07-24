using AegiFitness.Api.Data;
using AegiFitness.Api.Domain;
using AegiFitness.Api.Dtos;
using AegiFitness.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace AegiFitness.Api.Controllers;

[ApiController]
[Route("api/workout-logs")]
[Authorize(Policy = "ActiveLicense")]
public class WorkoutLogsController : ControllerBase
{
    private readonly AppDbContext _context;
    private readonly GamificationService _gamification;
    private readonly MetricsService _metrics;

    public WorkoutLogsController(AppDbContext context, GamificationService gamification, MetricsService metrics)
    {
        _context = context;
        _gamification = gamification;
        _metrics = metrics;
    }

    [HttpGet]
    public async Task<ActionResult<WorkoutLogDto[]>> List([FromQuery] DateOnly? from, [FromQuery] DateOnly? to)
    {
        var userId = CurrentUserId();
        var query = _context.WorkoutLogs
            .AsNoTracking()
            .Where(x => x.UserId == userId)
            .Include(x => x.Entries)
            .ThenInclude(e => e.Exercise)
            .AsQueryable();

        if (from.HasValue) query = query.Where(x => x.Date >= from.Value);
        if (to.HasValue) query = query.Where(x => x.Date <= to.Value);

        var logs = await query.OrderByDescending(x => x.Date).ToListAsync();
        return Ok(logs.Select(Map).ToArray());
    }

    [HttpPost]
    public async Task<ActionResult<WorkoutLogDto>> Create(WorkoutLogCreateDto dto)
    {
        var userId = CurrentUserId();
        var existing = await _context.WorkoutLogs
            .Include(x => x.Entries)
            .FirstOrDefaultAsync(x => x.UserId == userId && x.Date == dto.Date);

        if (existing is not null)
        {
            _context.WorkoutLogEntries.RemoveRange(existing.Entries);
            _context.WorkoutLogs.Remove(existing);
        }

        var log = new WorkoutLog
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            Date = dto.Date,
            PlanDayId = dto.PlanDayId,
            StartedAt = DateTime.UtcNow,
            FinishedAt = DateTime.UtcNow,
            Notes = dto.Notes
        };

        int xp = 0;
        int completedCount = 0;
        int totalCount = dto.Entries.Length;

        foreach (var entry in dto.Entries)
        {
            log.Entries.Add(new WorkoutLogEntry
            {
                Id = Guid.NewGuid(),
                LogId = log.Id,
                ExerciseId = entry.ExerciseId,
                PlannedSets = entry.PlannedSets,
                PlannedReps = entry.PlannedReps,
                ActualSets = entry.ActualSets,
                ActualReps = entry.ActualReps,
                ActualWeightKg = entry.ActualWeightKg,
                Completed = entry.Completed,
                IsExtra = entry.IsExtra
            });

            if (entry.Completed)
            {
                xp += 15;
                completedCount++;
            }
            if (entry.IsExtra)
                xp += 5;
        }

        if (totalCount > 0 && (decimal)completedCount / totalCount >= 0.8m)
            xp += 50;

        _context.WorkoutLogs.Add(log);
        await _context.SaveChangesAsync();

        await _gamification.AddXpAsync(userId, xp, $"Entrenamiento {dto.Date:yyyy-MM-dd}", HttpContext.RequestAborted);
        await _gamification.EvaluateWorkoutLoggedAsync(userId, dto.Date, HttpContext.RequestAborted);
        if (dto.Entries.Any(e => e.IsExtra))
            await _gamification.EvaluateExtraAsync(userId, HttpContext.RequestAborted);
        await _metrics.InvalidateAsync(userId, HttpContext.RequestAborted);

        // Recargar con ejercicios incluidos para devolver el contrato completo
        var saved = await _context.WorkoutLogs
            .AsNoTracking()
            .Include(x => x.Entries)
            .ThenInclude(e => e.Exercise)
            .FirstAsync(x => x.Id == log.Id, HttpContext.RequestAborted);

        return Ok(Map(saved, xp));
    }

    private static ExerciseDto MapExercise(Exercise ex) => new(
        ex.Id,
        ex.Name,
        ex.MuscleGroup,
        ex.Type,
        ex.Objective,
        ex.Difficulty,
        ex.Equipment,
        ex.Description,
        ex.Instructions,
        ex.Target,
        ex.Effect);

    private static WorkoutLogDto Map(WorkoutLog log, int xp = 0) => new(
        log.Id,
        log.Date,
        log.PlanDayId,
        log.Notes,
        xp,
        log.StartedAt,
        log.FinishedAt,
        log.Entries.Select(e => new WorkoutLogEntryResponseDto(
            e.Id,
            e.ExerciseId,
            e.PlannedSets,
            e.PlannedReps,
            e.ActualSets,
            e.ActualReps,
            e.ActualWeightKg,
            e.Completed,
            e.IsExtra,
            MapExercise(e.Exercise))).ToArray());

    private Guid CurrentUserId() => Guid.Parse(User.FindFirst("sub")?.Value ?? Guid.Empty.ToString());
}
