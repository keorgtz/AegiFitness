using AegiFitness.Api.Data;
using AegiFitness.Api.Domain;
using AegiFitness.Api.Dtos;
using AegiFitness.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace AegiFitness.Api.Controllers;

[ApiController]
[Route("api/metrics")]
[Authorize(Policy = "ActiveLicense")]
public class MetricsController : ControllerBase
{
    private readonly AppDbContext _context;
    private readonly GamificationService _gamification;
    private readonly MetricsService _metrics;

    public MetricsController(AppDbContext context, GamificationService gamification, MetricsService metrics)
    {
        _context = context;
        _gamification = gamification;
        _metrics = metrics;
    }

    [HttpGet("weight")]
    public async Task<ActionResult<WeightEntryDto[]>> GetWeights([FromQuery] DateOnly? from, [FromQuery] DateOnly? to)
    {
        var userId = CurrentUserId();
        var query = _context.WeightEntries.AsNoTracking().Where(x => x.UserId == userId).AsQueryable();
        if (from.HasValue) query = query.Where(x => x.Date >= from.Value);
        if (to.HasValue) query = query.Where(x => x.Date <= to.Value);
        var entries = await query.OrderByDescending(x => x.Date).ToListAsync();
        return Ok(entries.Select(e => new WeightEntryDto(e.Id, e.Date, e.WeightKg, e.Notes)).ToArray());
    }

    [HttpPost("weight")]
    public async Task<ActionResult<WeightEntryDto>> UpsertWeight(WeightEntryCreateDto dto)
    {
        var userId = CurrentUserId();
        var existing = await _context.WeightEntries.FirstOrDefaultAsync(x => x.UserId == userId && x.Date == dto.Date);
        if (existing is not null)
        {
            existing.WeightKg = dto.WeightKg;
            existing.Notes = dto.Notes;
        }
        else
        {
            _context.WeightEntries.Add(new WeightEntry
            {
                Id = Guid.NewGuid(),
                UserId = userId,
                Date = dto.Date,
                WeightKg = dto.WeightKg,
                Notes = dto.Notes
            });
        }

        await _context.SaveChangesAsync();
        await _gamification.AddXpAsync(userId, 10, $"Peso registrado {dto.Date:yyyy-MM-dd}", HttpContext.RequestAborted);
        await _gamification.EvaluateWeightLoggedAsync(userId, dto.Date, HttpContext.RequestAborted);
        await _metrics.InvalidateAsync(userId, HttpContext.RequestAborted);

        var entry = await _context.WeightEntries.AsNoTracking().FirstOrDefaultAsync(x => x.UserId == userId && x.Date == dto.Date);
        return Ok(new WeightEntryDto(entry!.Id, entry.Date, entry.WeightKg, entry.Notes));
    }

    [HttpGet("summary")]
    public async Task<ActionResult<MetricsSummary>> Summary()
    {
        var userId = CurrentUserId();
        var summary = await _metrics.GetSummaryAsync(userId);
        return Ok(summary);
    }

    private Guid CurrentUserId() => Guid.Parse(User.FindFirst("sub")?.Value ?? Guid.Empty.ToString());
}
