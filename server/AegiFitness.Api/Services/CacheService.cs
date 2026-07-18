using System.Text.Json;
using Microsoft.Extensions.Caching.Memory;
using StackExchange.Redis;

namespace AegiFitness.Api.Services;

public class CacheService : ICacheService
{
    private readonly IDatabase? _redis;
    private readonly IMemoryCache _memory;
    private readonly IConnectionMultiplexer? _muxer;

    public CacheService(IConfiguration configuration, IMemoryCache memoryCache)
    {
        _memory = memoryCache;
        var connectionString = configuration["Redis:ConnectionString"];
        if (!string.IsNullOrWhiteSpace(connectionString))
        {
            try
            {
                _muxer = ConnectionMultiplexer.Connect(connectionString);
                _redis = _muxer.GetDatabase();
            }
            catch
            {
                _redis = null;
            }
        }
    }

    public async Task<T?> GetAsync<T>(string key, CancellationToken ct = default)
    {
        if (_redis is not null)
        {
            try
            {
                var value = await _redis.StringGetAsync(key);
                if (value.HasValue)
                    return JsonSerializer.Deserialize<T>(value.ToString());
                return default;
            }
            catch
            {
                // Redis no disponible: cae a memoria
            }
        }

        if (_memory.TryGetValue(key, out T? cached))
            return cached;
        return default;
    }

    public async Task SetAsync<T>(string key, T value, TimeSpan? expiry = null, CancellationToken ct = default)
    {
        var serialized = JsonSerializer.Serialize(value);
        if (_redis is not null)
        {
            try
            {
                await _redis.StringSetAsync(key, serialized, expiry);
                return;
            }
            catch
            {
                // Redis no disponible: cae a memoria
            }
        }

        var options = new MemoryCacheEntryOptions();
        if (expiry.HasValue)
            options.AbsoluteExpirationRelativeToNow = expiry.Value;
        _memory.Set(key, value, options);
    }

    public async Task RemoveAsync(string key, CancellationToken ct = default)
    {
        if (_redis is not null)
        {
            try
            {
                await _redis.KeyDeleteAsync(key);
                return;
            }
            catch
            {
                // Redis no disponible: cae a memoria
            }
        }
        _memory.Remove(key);
    }
}
