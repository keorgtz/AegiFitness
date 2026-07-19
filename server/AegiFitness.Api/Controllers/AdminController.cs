using AegiFitness.Api.Data;
using AegiFitness.Api.Domain;
using AegiFitness.Api.Dtos;
using AegiFitness.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace AegiFitness.Api.Controllers;

[ApiController]
[Route("api/admin")]
[Authorize(Roles = "Admin")]
[Authorize(Policy = "ActiveLicense")]
public class AdminController : ControllerBase
{
    private readonly AppDbContext _context;
    private readonly UserManager<ApplicationUser> _userManager;
    private readonly GamificationService _gamification;
    private readonly Microsoft.Extensions.Caching.Memory.IMemoryCache _cache;

    public AdminController(AppDbContext context, UserManager<ApplicationUser> userManager, GamificationService gamification, Microsoft.Extensions.Caching.Memory.IMemoryCache cache)
    {
        _context = context;
        _userManager = userManager;
        _gamification = gamification;
        _cache = cache;
    }

    private void InvalidateLicenseCache(Guid userId) => _cache.Remove($"license:{userId}");

    [HttpGet("users")]
    public async Task<ActionResult<AdminUserDto[]>> Users([FromQuery] string filter = "all")
    {
        var query = _context.Users.AsNoTracking().AsQueryable();

        if (filter == "pending")
            query = query.Where(u => _context.Licenses.Any(l => l.UserId == u.Id && l.Status == LicenseStatus.Pending));
        else if (filter == "active")
            query = query.Where(u => _context.Licenses.Any(l => l.UserId == u.Id && l.Status == LicenseStatus.Active));

        var users = await query.ToListAsync();
        var result = new List<AdminUserDto>();

        foreach (var u in users)
        {
            var roles = await _userManager.GetRolesAsync(u);
            var license = await _context.Licenses.AsNoTracking().FirstOrDefaultAsync(l => l.UserId == u.Id);
            var workouts = await _context.WorkoutLogs.CountAsync(x => x.UserId == u.Id);
            var lastActive = await _context.WorkoutLogs.AsNoTracking()
                .Where(x => x.UserId == u.Id)
                .OrderByDescending(x => x.Date)
                .Select(x => (DateTime?)x.Date.ToDateTime(TimeOnly.MinValue))
                .FirstOrDefaultAsync();

            result.Add(new AdminUserDto(
                u.Id,
                u.UserName ?? string.Empty,
                u.DisplayName,
                u.Email ?? string.Empty,
                u.CreatedAt,
                roles.ToArray(),
                new AdminLicenseDto(license?.Status ?? LicenseStatus.Pending, license?.LicensedAt, license?.ExpiresAt, license?.Notes),
                new AdminStatsDto(workouts, lastActive)));
        }

        return Ok(result.ToArray());
    }

    [HttpPost("users/{id:guid}/license/approve")]
    public async Task<ActionResult<AdminLicenseDto>> Approve(Guid id, [FromBody] LicenseActionDto? dto)
    {
        var license = await _context.Licenses.FirstOrDefaultAsync(x => x.UserId == id);
        if (license is null) return NotFound();

        license.Status = LicenseStatus.Active;
        license.LicensedAt = DateTime.UtcNow;
        // Sin validDays => licencia de por vida (ExpiresAt null)
        license.ExpiresAt = dto?.ValidDays is > 0 ? DateTime.UtcNow.AddDays(dto.ValidDays.Value) : null;
        license.Notes = dto?.Notes;
        license.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();
        InvalidateLicenseCache(id);
        await _gamification.AddXpAsync(id, 50, "Licencia activada", HttpContext.RequestAborted);

        return Ok(new AdminLicenseDto(license.Status, license.LicensedAt, license.ExpiresAt, license.Notes));
    }

    [HttpPut("users/{id:guid}")]
    public async Task<ActionResult<AdminUserDto>> UpdateUser(Guid id, [FromBody] AdminUserUpdateDto dto)
    {
        var user = await _userManager.FindByIdAsync(id.ToString());
        if (user is null) return NotFound();

        var usernameTaken = await _userManager.Users.AnyAsync(u => u.Id != id && u.NormalizedUserName == _userManager.NormalizeName(dto.Username));
        if (usernameTaken)
            return BadRequest(new { message = "Ese nombre de usuario ya está en uso." });

        var emailTaken = await _userManager.Users.AnyAsync(u => u.Id != id && u.NormalizedEmail == _userManager.NormalizeEmail(dto.Email));
        if (emailTaken)
            return BadRequest(new { message = "Ese correo ya está en uso por otra cuenta." });

        user.UserName = dto.Username.Trim();
        user.DisplayName = dto.DisplayName.Trim();
        user.Email = dto.Email.Trim();

        var result = await _userManager.UpdateAsync(user);
        if (!result.Succeeded)
            return BadRequest(new { message = string.Join(" ", result.Errors.Select(e => e.Description)) });

        var roles = await _userManager.GetRolesAsync(user);
        var license = await _context.Licenses.AsNoTracking().FirstOrDefaultAsync(l => l.UserId == id);
        var workouts = await _context.WorkoutLogs.CountAsync(x => x.UserId == id);
        return Ok(new AdminUserDto(
            user.Id,
            user.UserName ?? string.Empty,
            user.DisplayName,
            user.Email ?? string.Empty,
            user.CreatedAt,
            roles.ToArray(),
            new AdminLicenseDto(license?.Status ?? LicenseStatus.Pending, license?.LicensedAt, license?.ExpiresAt, license?.Notes),
            new AdminStatsDto(workouts, null)));
    }

    [HttpPost("users/{id:guid}/password")]
    public async Task<ActionResult<MessageDto>> ResetPassword(Guid id, [FromBody] AdminPasswordResetDto dto)
    {
        var user = await _userManager.FindByIdAsync(id.ToString());
        if (user is null) return NotFound();

        var token = await _userManager.GeneratePasswordResetTokenAsync(user);
        var result = await _userManager.ResetPasswordAsync(user, token, dto.NewPassword);
        if (!result.Succeeded)
            return BadRequest(new { message = string.Join(" ", result.Errors.Select(e => e.Description)) });

        // Cerrar sesiones activas del usuario: revocar refresh tokens
        var activeTokens = await _context.RefreshTokens.Where(t => t.UserId == id && t.RevokedAt == null).ToListAsync();
        foreach (var t in activeTokens) t.RevokedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync();

        return Ok(new MessageDto("Contraseña restablecida."));
    }

    [HttpPut("users/{id:guid}/license")]
    public async Task<ActionResult<AdminLicenseDto>> UpdateLicense(Guid id, [FromBody] AdminLicenseUpdateDto dto)
    {
        var license = await _context.Licenses.FirstOrDefaultAsync(x => x.UserId == id);
        if (license is null) return NotFound();

        if (dto.Status.HasValue)
        {
            license.Status = dto.Status.Value;
            if (dto.Status.Value == LicenseStatus.Active && license.LicensedAt is null)
                license.LicensedAt = DateTime.UtcNow;
        }

        // ExpiresAt null => licencia de por vida.
        // El cliente envía fechas sin zona (Kind=Unspecified): normalizar a UTC
        // porque la columna es timestamptz (Npgsql rechaza Unspecified).
        license.ExpiresAt = dto.ExpiresAt.HasValue
            ? DateTime.SpecifyKind(dto.ExpiresAt.Value, DateTimeKind.Utc)
            : null;
        license.Notes = dto.Notes ?? license.Notes;
        license.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();
        InvalidateLicenseCache(id);

        return Ok(new AdminLicenseDto(license.Status, license.LicensedAt, license.ExpiresAt, license.Notes));
    }

    [HttpPost("users/{id:guid}/license/suspend")]
    public async Task<ActionResult<AdminLicenseDto>> Suspend(Guid id, [FromBody] LicenseActionDto? dto)
    {
        var license = await _context.Licenses.FirstOrDefaultAsync(x => x.UserId == id);
        if (license is null) return NotFound();

        license.Status = LicenseStatus.Suspended;
        license.Notes = dto?.Notes;
        license.UpdatedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync();
        InvalidateLicenseCache(id);

        return Ok(new AdminLicenseDto(license.Status, license.LicensedAt, license.ExpiresAt, license.Notes));
    }

    [HttpPost("users/{id:guid}/license/revoke")]
    public async Task<ActionResult<AdminLicenseDto>> Revoke(Guid id, [FromBody] LicenseActionDto? dto)
    {
        var license = await _context.Licenses.FirstOrDefaultAsync(x => x.UserId == id);
        if (license is null) return NotFound();

        license.Status = LicenseStatus.Revoked;
        license.Notes = dto?.Notes;
        license.UpdatedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync();
        InvalidateLicenseCache(id);

        return Ok(new AdminLicenseDto(license.Status, license.LicensedAt, license.ExpiresAt, license.Notes));
    }

    [HttpPut("users/{id:guid}/license/extend")]
    public async Task<ActionResult<AdminLicenseDto>> Extend(Guid id, [FromBody] LicenseExtendDto dto)
    {
        var license = await _context.Licenses.FirstOrDefaultAsync(x => x.UserId == id);
        if (license is null) return NotFound();

        license.ExpiresAt = (license.ExpiresAt ?? DateTime.UtcNow).AddDays(dto.Days);
        license.UpdatedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync();
        InvalidateLicenseCache(id);

        return Ok(new AdminLicenseDto(license.Status, license.LicensedAt, license.ExpiresAt, license.Notes));
    }

    [HttpPost("users/{id:guid}/roles")]
    public async Task<ActionResult<string[]>> Roles(Guid id, [FromBody] RoleActionDto dto)
    {
        var currentAdminId = Guid.Parse(User.FindFirst("sub")?.Value ?? Guid.Empty.ToString());
        if (id == currentAdminId && !dto.Grant && dto.Role == "Admin")
            return BadRequest(new { message = "No puedes revocarte tu propio rol de administrador." });

        var user = await _userManager.FindByIdAsync(id.ToString());
        if (user is null) return NotFound();

        if (dto.Grant)
        {
            if (!await _userManager.IsInRoleAsync(user, dto.Role))
                await _userManager.AddToRoleAsync(user, dto.Role);
        }
        else
        {
            if (await _userManager.IsInRoleAsync(user, dto.Role))
                await _userManager.RemoveFromRoleAsync(user, dto.Role);
        }

        var roles = await _userManager.GetRolesAsync(user);
        return Ok(roles.ToArray());
    }
}
