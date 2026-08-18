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
        var cacheKey = $"exercises:{type}:{muscleGroup}:{objective}:{difficulty}:{equipment}:{search}:{page}:{pageSize}";
        var cached = await _cache.GetAsync<ExerciseListDto>(cacheKey);
        if (cached is not null) return Ok(cached);

        var query = _context.Exercises.AsNoTracking().AsQueryable();

        if (!string.IsNullOrWhiteSpace(type) && Enum.TryParse<Modality>(type, out var modality))
            query = query.Where(x => x.Type == modality);

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
