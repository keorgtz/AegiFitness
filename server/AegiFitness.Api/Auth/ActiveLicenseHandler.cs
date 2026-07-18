using AegiFitness.Api.Data;
using AegiFitness.Api.Domain;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using System.Security.Claims;

namespace AegiFitness.Api.Auth;

public class ActiveLicenseRequirement : IAuthorizationRequirement { }

public class ActiveLicenseHandler : AuthorizationHandler<ActiveLicenseRequirement>
{
    private readonly IServiceProvider _serviceProvider;
    private readonly IMemoryCache _cache;

    public ActiveLicenseHandler(IServiceProvider serviceProvider, IMemoryCache cache)
    {
        _serviceProvider = serviceProvider;
        _cache = cache;
    }

    protected override async Task HandleRequirementAsync(AuthorizationHandlerContext context, ActiveLicenseRequirement requirement)
    {
        var subClaim = context.User.FindFirst("sub")?.Value;
        if (string.IsNullOrEmpty(subClaim) || !Guid.TryParse(subClaim, out var userId))
            return;

        if (context.User.IsInRole("Admin"))
        {
            context.Succeed(requirement);
            return;
        }

        var cacheKey = $"license:{userId}";
        if (!_cache.TryGetValue(cacheKey, out Domain.LicenseStatus status))
        {
            using var scope = _serviceProvider.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<Data.AppDbContext>();
            var license = await db.Licenses.AsNoTracking().FirstOrDefaultAsync(x => x.UserId == userId);
            status = license?.Status ?? Domain.LicenseStatus.Pending;
            _cache.Set(cacheKey, status, TimeSpan.FromSeconds(60));
        }

        if (status == Domain.LicenseStatus.Active)
            context.Succeed(requirement);
    }
}
