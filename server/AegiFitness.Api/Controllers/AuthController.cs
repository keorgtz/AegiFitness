using AegiFitness.Api.Auth;
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
[Route("api/auth")]
public class AuthController : ControllerBase
{
    private readonly UserManager<ApplicationUser> _userManager;
    private readonly SignInManager<ApplicationUser> _signInManager;
    private readonly JwtService _jwtService;
    private readonly AppDbContext _context;
    private readonly GamificationService _gamification;

    public AuthController(
        UserManager<ApplicationUser> userManager,
        SignInManager<ApplicationUser> signInManager,
        JwtService jwtService,
        AppDbContext context,
        GamificationService gamification)
    {
        _userManager = userManager;
        _signInManager = signInManager;
        _jwtService = jwtService;
        _context = context;
        _gamification = gamification;
    }

    [HttpPost("register")]
    [AllowAnonymous]
    public async Task<ActionResult<MessageDto>> Register(RegisterDto dto)
    {
        var user = new ApplicationUser
        {
            Id = Guid.NewGuid(),
            UserName = dto.Username,
            Email = dto.Email,
            DisplayName = dto.DisplayName
        };

        var result = await _userManager.CreateAsync(user, dto.Password);
        if (!result.Succeeded)
            return BadRequest(new { errors = result.Errors.Select(e => e.Description) });

        await _userManager.AddToRoleAsync(user, "Member");

        _context.Licenses.Add(new License
        {
            Id = Guid.NewGuid(),
            UserId = user.Id,
            Status = LicenseStatus.Pending,
            UpdatedAt = DateTime.UtcNow
        });

        _context.UserProfiles.Add(new UserProfile { UserId = user.Id, Goal = Goal.Recomposition });
        _context.TrainingConfigs.Add(new TrainingConfig { UserId = user.Id });

        await _context.SaveChangesAsync();
        return Ok(new MessageDto("Usuario registrado. Espera la activación de tu licencia."));
    }

    [HttpPost("login")]
    [AllowAnonymous]
    public async Task<ActionResult<AuthResponseDto>> Login(LoginDto dto)
    {
        var user = await _userManager.Users
            .FirstOrDefaultAsync(u => u.NormalizedUserName == _userManager.NormalizeName(dto.UsernameOrEmail)
                || u.NormalizedEmail == _userManager.NormalizeEmail(dto.UsernameOrEmail));

        if (user is null)
            return Unauthorized(new { message = "Credenciales inválidas." });

        var result = await _signInManager.CheckPasswordSignInAsync(user, dto.Password, false);
        if (!result.Succeeded)
            return Unauthorized(new { message = "Credenciales inválidas." });

        var tokens = await IssueTokensAsync(user);
        return Ok(tokens);
    }

    [HttpPost("refresh")]
    [AllowAnonymous]
    public async Task<ActionResult<AuthResponseDto>> Refresh(RefreshDto dto)
    {
        var refresh = await _jwtService.ValidateRefreshTokenAsync(dto.RefreshToken);
        if (refresh is null)
            return Unauthorized(new { message = "Refresh token inválido." });

        await _jwtService.RevokeRefreshTokenAsync(refresh);

        var user = await _userManager.FindByIdAsync(refresh.UserId.ToString());
        if (user is null)
            return Unauthorized(new { message = "Usuario no encontrado." });

        var tokens = await IssueTokensAsync(user);
        return Ok(tokens);
    }

    [HttpPost("logout")]
    [AllowAnonymous]
    public async Task<IActionResult> Logout(RefreshDto dto)
    {
        var refresh = await _jwtService.ValidateRefreshTokenAsync(dto.RefreshToken);
        if (refresh is not null)
            await _jwtService.RevokeRefreshTokenAsync(refresh);
        return NoContent();
    }

    [HttpGet("me")]
    [Authorize]
    public async Task<ActionResult<MeDto>> Me()
    {
        var userId = CurrentUserId();
        var user = await _userManager.FindByIdAsync(userId.ToString());
        if (user is null) return Unauthorized();

        var me = await BuildMeAsync(user);
        return Ok(me);
    }

    private async Task<AuthResponseDto> IssueTokensAsync(ApplicationUser user)
    {
        var roles = await _userManager.GetRolesAsync(user);
        var license = await _context.Licenses.AsNoTracking().FirstOrDefaultAsync(x => x.UserId == user.Id);
        var accessToken = _jwtService.GenerateAccessToken(user, roles, license?.Status ?? LicenseStatus.Pending);
        var (refreshToken, _) = await _jwtService.GenerateRefreshTokenAsync(user.Id);
        var me = await BuildMeAsync(user);
        return new AuthResponseDto(accessToken, refreshToken, me);
    }

    private async Task<MeDto> BuildMeAsync(ApplicationUser user)
    {
        var roles = await _userManager.GetRolesAsync(user);
        var license = await _context.Licenses.AsNoTracking().FirstOrDefaultAsync(x => x.UserId == user.Id);
        var profile = await _context.UserProfiles.AsNoTracking().FirstOrDefaultAsync(x => x.UserId == user.Id);
        var xp = await _gamification.GetTotalXpAsync(user.Id);
        var level = _gamification.LevelForXp(xp);
        var streak = await _gamification.GetStreakDaysAsync(user.Id);
        return new MeDto(
            user.Id,
            user.UserName ?? string.Empty,
            user.DisplayName,
            user.Email ?? string.Empty,
            roles.ToArray(),
            new LicenseDto(license?.Status ?? LicenseStatus.Pending, license?.ExpiresAt),
            profile?.OnboardingCompleted ?? false,
            new GamificationMiniDto(xp, level, _gamification.TitleForLevel(level), _gamification.XpForLevel(level + 1) - xp, streak));
    }

    private Guid CurrentUserId() => Guid.Parse(User.FindFirst("sub")?.Value ?? Guid.Empty.ToString());
}
