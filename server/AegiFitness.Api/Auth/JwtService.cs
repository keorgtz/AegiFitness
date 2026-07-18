using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using AegiFitness.Api.Data;
using AegiFitness.Api.Domain;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;

namespace AegiFitness.Api.Auth;

public class JwtService
{
    private readonly IConfiguration _configuration;
    private readonly AppDbContext _context;

    public JwtService(IConfiguration configuration, AppDbContext context)
    {
        _configuration = configuration;
        _context = context;
    }

    public string GenerateAccessToken(ApplicationUser user, IEnumerable<string> roles, LicenseStatus licenseStatus)
    {
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(GetKey()));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

        var claims = new List<Claim>
        {
            new(ClaimTypes.NameIdentifier, user.Id.ToString()),
            new("sub", user.Id.ToString()),
            new("username", user.UserName ?? string.Empty),
            new("lic", licenseStatus.ToString())
        };

        foreach (var role in roles)
            claims.Add(new Claim(ClaimTypes.Role, role));

        var token = new JwtSecurityToken(
            issuer: GetIssuer(),
            audience: GetAudience(),
            claims: claims,
            expires: DateTime.UtcNow.AddHours(12),
            signingCredentials: creds);

        return new JwtSecurityTokenHandler().WriteToken(token);
    }

    public async Task<(string token, string tokenHash)> GenerateRefreshTokenAsync(Guid userId)
    {
        var token = Convert.ToBase64String(RandomNumberGenerator.GetBytes(64));
        var tokenHash = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(token)));

        var refresh = new RefreshToken
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            TokenHash = tokenHash,
            ExpiresAt = DateTime.UtcNow.AddDays(14)
        };

        _context.RefreshTokens.Add(refresh);
        await _context.SaveChangesAsync();

        return (token, tokenHash);
    }

    public async Task<RefreshToken?> ValidateRefreshTokenAsync(string token)
    {
        var tokenHash = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(token)));
        var refresh = await _context.RefreshTokens
            .FirstOrDefaultAsync(x => x.TokenHash == tokenHash && x.RevokedAt == null && x.ExpiresAt > DateTime.UtcNow);
        return refresh;
    }

    public async Task RevokeRefreshTokenAsync(RefreshToken token)
    {
        token.RevokedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync();
    }

    private string GetKey() => _configuration["Jwt:Key"] ?? "AegiFitnessSuperSecureDevKey2026!";
    private string GetIssuer() => _configuration["Jwt:Issuer"] ?? "AegiFitness";
    private string GetAudience() => _configuration["Jwt:Audience"] ?? "AegiFitness";
}
