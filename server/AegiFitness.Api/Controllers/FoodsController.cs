using AegiFitness.Api.Data;
using AegiFitness.Api.Domain;
using AegiFitness.Api.Dtos;
using AegiFitness.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace AegiFitness.Api.Controllers;

[ApiController]
[Route("api/foods")]
[Authorize(Policy = "ActiveLicense")]
public class FoodsController : ControllerBase
{
    private readonly AppDbContext _context;
    private readonly ICacheService _cache;

    public FoodsController(AppDbContext context, ICacheService cache)
    {
        _context = context;
        _cache = cache;
    }

    [HttpGet]
    public async Task<ActionResult<FoodListDto>> List(
        [FromQuery] string? mealType,
        [FromQuery] string? objective,
        [FromQuery] int? maxCalories,
        [FromQuery] int? minProtein,
        [FromQuery] int? maxSugars,
        [FromQuery] string? search,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20)
    {
        var cacheKey = $"foods:{mealType}:{objective}:{maxCalories}:{minProtein}:{maxSugars}:{search}:{page}:{pageSize}";
        var cached = await _cache.GetAsync<FoodListDto>(cacheKey);
        if (cached is not null) return Ok(cached);

        var query = _context.Foods.AsNoTracking().AsQueryable();

        if (!string.IsNullOrWhiteSpace(mealType) && Enum.TryParse<MealType>(mealType, out var mt))
            query = query.Where(x => x.MealType == mt);

        if (!string.IsNullOrWhiteSpace(objective) && Enum.TryParse<CatalogObjective>(objective, out var obj))
            query = query.Where(x => x.Objective == obj);

        if (maxCalories is > 0)
            query = query.Where(x => x.Calories <= maxCalories.Value);

        if (minProtein is >= 0)
            query = query.Where(x => x.ProteinG >= minProtein.Value);

        if (maxSugars is >= 0)
            query = query.Where(x => x.SugarsG <= maxSugars.Value);

        if (!string.IsNullOrWhiteSpace(search))
            query = query.Where(x => EF.Functions.ILike(x.Name, $"%{search.Trim()}%"));

        var total = await query.CountAsync();
        var items = await query
            .OrderBy(x => x.MealType)
            .ThenBy(x => x.Name)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(x => Map(x))
            .ToArrayAsync();

        var result = new FoodListDto(items, total, page, pageSize);
        await _cache.SetAsync(cacheKey, result, TimeSpan.FromMinutes(10));
        return Ok(result);
    }

    [HttpGet("{id:int}")]
    public async Task<ActionResult<FoodDto>> Get(int id)
    {
        var food = await _context.Foods.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id);
        if (food is null) return NotFound();
        return Ok(Map(food));
    }

    private static FoodDto Map(Food f) => new(
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
}
