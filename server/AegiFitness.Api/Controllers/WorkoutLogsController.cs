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
            .Include(x => x.Entries)
            .ThenInclude(e => e.Sets)
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
        if (dto.Entries.Length == 0) return BadRequest(new { message = "La sesión debe incluir al menos un ejercicio." });
        var startedAt = AsUtc(dto.StartedAt) ?? DateTime.UtcNow;
        var finishedAt = AsUtc(dto.FinishedAt) ?? DateTime.UtcNow;
        if (finishedAt < startedAt) return BadRequest(new { message = "La hora de finalización no puede ser anterior al inicio." });
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
            StartedAt = startedAt,
            FinishedAt = finishedAt,
            Notes = dto.Notes
        };

        int xp = 0;
        int completedCount = 0;
        int totalCount = dto.Entries.Length;

        foreach (var entry in dto.Entries)
        {
            var logEntry = new WorkoutLogEntry
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
            };

            var submittedSets = entry.Sets ?? [];
            if (submittedSets.Length == 0 && entry.ActualSets is > 0)
            {
                submittedSets = Enumerable.Range(1, entry.ActualSets.Value).Select(number => new WorkoutSetDto(
                    null, number, entry.PlannedReps, entry.ActualWeightKg, entry.ActualReps,
                    entry.ActualWeightKg, null, entry.Completed, entry.Completed ? log.FinishedAt : null)).ToArray();
            }

            foreach (var set in submittedSets.OrderBy(x => x.SetNumber))
            {
                logEntry.Sets.Add(new WorkoutSetEntry
                {
                    Id = Guid.NewGuid(), SetNumber = set.SetNumber, PlannedReps = set.PlannedReps,
                    PlannedWeightKg = set.PlannedWeightKg, ActualReps = set.ActualReps,
                    ActualWeightKg = set.ActualWeightKg, Rir = set.Rir is null ? null : Math.Clamp(set.Rir.Value, 0, 10),
                    Completed = set.Completed, CompletedAt = AsUtc(set.CompletedAt)
                });
            }
            if (logEntry.Sets.Count > 0)
            {
                var done = logEntry.Sets.Where(x => x.Completed).ToArray();
                logEntry.ActualSets = done.Length;
                logEntry.ActualReps = done.Length == 0 ? null : (int)Math.Round(done.Average(x => x.ActualReps ?? 0));
                logEntry.ActualWeightKg = done.Length == 0 ? null : done.Max(x => x.ActualWeightKg);
                logEntry.Completed = done.Length == logEntry.Sets.Count;
            }
            log.Entries.Add(logEntry);

            if (logEntry.Completed)
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
            .Include(x => x.Entries)
            .ThenInclude(e => e.Sets)
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
        ex.Effect,
        ex.ImageSlug,
        ex.ImageVariants);

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
            MapExercise(e.Exercise),
            e.Sets.OrderBy(s => s.SetNumber).Select(s => new WorkoutSetDto(s.Id, s.SetNumber, s.PlannedReps,
                s.PlannedWeightKg, s.ActualReps, s.ActualWeightKg, s.Rir, s.Completed, s.CompletedAt)).ToArray())).ToArray());

    private static DateTime? AsUtc(DateTime? value)
    {
        if (!value.HasValue) return null;
        return value.Value.Kind == DateTimeKind.Utc ? value.Value : value.Value.ToUniversalTime();
    }

    private Guid CurrentUserId() => Guid.Parse(User.FindFirst("sub")?.Value ?? Guid.Empty.ToString());
}
