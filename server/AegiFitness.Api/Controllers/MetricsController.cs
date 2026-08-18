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

    [HttpGet("body")]
    public async Task<ActionResult<BodyMeasurementDto[]>> GetBody([FromQuery] DateOnly? from, [FromQuery] DateOnly? to)
    {
        var userId = CurrentUserId();
        var query = _context.WeightEntries.AsNoTracking().Where(x => x.UserId == userId).Include(x => x.Photos).AsQueryable();
        if (from.HasValue) query = query.Where(x => x.Date >= from.Value);
        if (to.HasValue) query = query.Where(x => x.Date <= to.Value);
        return Ok((await query.OrderByDescending(x => x.Date).ToListAsync()).Select(MapBody).ToArray());
    }

    [HttpPost("body")]
    public async Task<ActionResult<BodyMeasurementDto>> UpsertBody(BodyMeasurementCreateDto dto)
    {
        var userId = CurrentUserId();
        var entry = await _context.WeightEntries.Include(x => x.Photos).FirstOrDefaultAsync(x => x.UserId == userId && x.Date == dto.Date);
        var created = entry is null;
        if (entry is null)
        {
            entry = new WeightEntry { Id = Guid.NewGuid(), UserId = userId, Date = dto.Date };
            _context.WeightEntries.Add(entry);
        }
        entry.WeightKg = dto.WeightKg; entry.BodyFatPercent = dto.BodyFatPercent; entry.MuscleMassKg = dto.MuscleMassKg;
        entry.WaistCm = dto.WaistCm; entry.HipCm = dto.HipCm; entry.ChestCm = dto.ChestCm; entry.NeckCm = dto.NeckCm;
        entry.LeftArmCm = dto.LeftArmCm; entry.RightArmCm = dto.RightArmCm; entry.LeftThighCm = dto.LeftThighCm;
        entry.RightThighCm = dto.RightThighCm; entry.Notes = dto.Notes;
        await _context.SaveChangesAsync();
        if (created)
        {
            await _gamification.AddXpAsync(userId, 10, $"Seguimiento corporal {dto.Date:yyyy-MM-dd}", HttpContext.RequestAborted);
            await _gamification.EvaluateWeightLoggedAsync(userId, dto.Date, HttpContext.RequestAborted);
        }
        await _metrics.InvalidateAsync(userId, HttpContext.RequestAborted);
        return Ok(MapBody(entry));
    }

    [HttpPost("body/{entryId:guid}/photos")]
    [RequestSizeLimit(5_500_000)]
    public async Task<ActionResult<ProgressPhotoDto>> UploadPhoto(Guid entryId, IFormFile file, [FromForm] string? caption)
    {
        var userId = CurrentUserId();
        var entry = await _context.WeightEntries.FirstOrDefaultAsync(x => x.Id == entryId && x.UserId == userId);
        if (entry is null) return NotFound();
        var allowed = new[] { "image/jpeg", "image/png", "image/webp" };
        if (file.Length == 0 || file.Length > 5_000_000 || !allowed.Contains(file.ContentType))
            return BadRequest(new { message = "Usa una imagen JPG, PNG o WebP de hasta 5 MB." });
        await using var stream = new MemoryStream();
        await file.CopyToAsync(stream, HttpContext.RequestAborted);
        if (!IsValidImage(stream.ToArray(), file.ContentType))
            return BadRequest(new { message = "El contenido del archivo no corresponde a una imagen válida." });
        var photo = new ProgressPhoto { Id = Guid.NewGuid(), UserId = userId, WeightEntryId = entryId,
            FileName = Path.GetFileName(file.FileName), ContentType = file.ContentType, Data = stream.ToArray(), Caption = caption };
        _context.ProgressPhotos.Add(photo);
        await _context.SaveChangesAsync();
        return Ok(MapPhoto(photo));
    }

    [HttpGet("body/photos/{photoId:guid}")]
    public async Task<IActionResult> GetPhoto(Guid photoId)
    {
        var userId = CurrentUserId();
        var photo = await _context.ProgressPhotos.AsNoTracking().FirstOrDefaultAsync(x => x.Id == photoId && x.UserId == userId);
        return photo is null ? NotFound() : File(photo.Data, photo.ContentType, enableRangeProcessing: true);
    }

    [HttpDelete("body/photos/{photoId:guid}")]
    public async Task<IActionResult> DeletePhoto(Guid photoId)
    {
        var userId = CurrentUserId();
        var photo = await _context.ProgressPhotos.FirstOrDefaultAsync(x => x.Id == photoId && x.UserId == userId);
        if (photo is null) return NotFound();
        _context.ProgressPhotos.Remove(photo); await _context.SaveChangesAsync(); return NoContent();
    }

    [HttpGet("summary")]
    public async Task<ActionResult<MetricsSummary>> Summary([FromQuery] DateOnly? date)
    {
        var userId = CurrentUserId();
        var summary = await _metrics.GetSummaryAsync(userId, date);
        return Ok(summary);
    }

    private Guid CurrentUserId() => Guid.Parse(User.FindFirst("sub")?.Value ?? Guid.Empty.ToString());

    private static ProgressPhotoDto MapPhoto(ProgressPhoto p) => new(p.Id, p.WeightEntryId, p.FileName, p.ContentType, p.Caption, p.CreatedAt);
    private static BodyMeasurementDto MapBody(WeightEntry e) => new(e.Id, e.Date, e.WeightKg, e.BodyFatPercent, e.MuscleMassKg,
        e.WaistCm, e.HipCm, e.ChestCm, e.NeckCm, e.LeftArmCm, e.RightArmCm, e.LeftThighCm, e.RightThighCm,
        e.Notes, e.CreatedAt, e.Photos.OrderByDescending(x => x.CreatedAt).Select(MapPhoto).ToArray());

    private static bool IsValidImage(byte[] data, string contentType) => contentType switch
    {
        "image/jpeg" => data.Length > 3 && data[0] == 0xFF && data[1] == 0xD8 && data[2] == 0xFF,
        "image/png" => data.Length > 8 && data.Take(8).SequenceEqual(new byte[] { 137, 80, 78, 71, 13, 10, 26, 10 }),
        "image/webp" => data.Length > 12 && System.Text.Encoding.ASCII.GetString(data, 0, 4) == "RIFF" && System.Text.Encoding.ASCII.GetString(data, 8, 4) == "WEBP",
        _ => false
    };
}
