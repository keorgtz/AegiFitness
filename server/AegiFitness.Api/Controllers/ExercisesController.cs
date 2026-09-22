using AegiFitness.Api.Data;
using AegiFitness.Api.Domain;
using AegiFitness.Api.Dtos;
using AegiFitness.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace AegiFitness.Api.Controllers;

[ApiController]
[Route("api/exercises")]
[Authorize(Policy = "ActiveLicense")]
public class ExercisesController : ControllerBase
{
    private readonly AppDbContext _context;
    private readonly ICacheService _cache;

    public ExercisesController(AppDbContext context, ICacheService cache)
    {
        _context = context;
        _cache = cache;
    }

    [HttpGet]
    public async Task<ActionResult<ExerciseListDto>> List(
        [FromQuery] string? type,
        [FromQuery] string? muscleGroup,
        [FromQuery] string? objective,
        [FromQuery] int? difficulty,
        [FromQuery] string? equipment,
        [FromQuery] string? search,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20)
    {
        var cacheKey = $"exercises:v2:{type}:{muscleGroup}:{objective}:{difficulty}:{equipment}:{search}:{page}:{pageSize}";
        var cached = await _cache.GetAsync<ExerciseListDto>(cacheKey);
        if (cached is not null) return Ok(cached);

        var query = _context.Exercises.AsNoTracking().AsQueryable();

        if (!string.IsNullOrWhiteSpace(type) && Enum.TryParse<Modality>(type, out var modality))
            query = query.Where(x => x.Type == modality || (modality != Modality.Both && x.Type == Modality.Both));

        if (!string.IsNullOrWhiteSpace(muscleGroup) && Enum.TryParse<MuscleGroup>(muscleGroup, out var muscle))
            query = query.Where(x => x.MuscleGroup == muscle);

        if (!string.IsNullOrWhiteSpace(objective) && Enum.TryParse<CatalogObjective>(objective, out var obj))
            query = query.Where(x => x.Objective == obj);

        if (difficulty is >= 1 and <= 3)
            query = query.Where(x => x.Difficulty == difficulty.Value);

        if (!string.IsNullOrWhiteSpace(equipment))
            query = query.Where(x => EF.Functions.ILike(x.Equipment, $"%{equipment.Trim()}%"));

        if (!string.IsNullOrWhiteSpace(search))
            query = query.Where(x => EF.Functions.ILike(x.Name, $"%{search.Trim()}%"));

        var total = await query.CountAsync();
        var items = await query
            .OrderBy(x => x.MuscleGroup)
            .ThenBy(x => x.Name)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(x => Map(x))
            .ToArrayAsync();

        var result = new ExerciseListDto(items, total, page, pageSize);
        await _cache.SetAsync(cacheKey, result, TimeSpan.FromMinutes(10));
        return Ok(result);
    }

    [HttpGet("{id:int}")]
    public async Task<ActionResult<ExerciseDto>> Get(int id)
    {
        var exercise = await _context.Exercises.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id);
        if (exercise is null) return NotFound();
        return Ok(Map(exercise));
    }

    [HttpGet("{id:int}/recommendation")]
    public async Task<IActionResult> Recommendation(int id, [FromQuery] int dayOfWeek)
    {
        if (dayOfWeek is < 0 or > 6) return BadRequest(new { message = "El día debe estar entre 0 y 6." });
        var userId = Guid.Parse(User.FindFirst("sub")?.Value ?? Guid.Empty.ToString());
        var exercise = await _context.Exercises.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id);
        if (exercise is null) return NotFound();
        var config = await _context.TrainingConfigs.AsNoTracking().Include(x => x.Days).FirstOrDefaultAsync(x => x.UserId == userId);
        if (config is null) return NotFound(new { message = "Completa tu configuración de entrenamiento." });
        var modality = config.Days.FirstOrDefault(x => x.DayOfWeek == dayOfWeek)?.Modality ?? exercise.Type;
        if (exercise.Type != Modality.Both) modality = exercise.Type;
        var recommendation = WorkoutPlanGenerator.Recommend(exercise, config, modality, Random.Shared);
        return Ok(new { recommendation.Sets, recommendation.RepsMin, recommendation.RepsMax, recommendation.RestSeconds, recommendation.Notes });
    }

    private static ExerciseDto Map(Exercise e) => new(
        e.Id,
        e.Name,
        e.MuscleGroup,
        e.Type,
        e.Objective,
        e.Difficulty,
        e.Equipment,
        e.Description,
        e.Instructions,
        e.Target,
        e.Effect,
        e.ImageSlug,
        e.ImageVariants);
}
