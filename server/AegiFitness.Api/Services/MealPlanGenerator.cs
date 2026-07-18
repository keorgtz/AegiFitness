using AegiFitness.Api.Data;
using AegiFitness.Api.Domain;
using Microsoft.EntityFrameworkCore;

namespace AegiFitness.Api.Services;

public class MealPlanGenerator
{
    private readonly AppDbContext _context;
    private readonly PlanCalculator _calculator;

    public MealPlanGenerator(AppDbContext context, PlanCalculator calculator)
    {
        _context = context;
        _calculator = calculator;
    }

    public async Task<MealPlan> GenerateForDateAsync(Guid userId, DateOnly date, CancellationToken ct = default)
    {
        var profile = await _context.UserProfiles.AsNoTracking().FirstOrDefaultAsync(x => x.UserId == userId, ct)
            ?? throw new InvalidOperationException("Perfil no encontrado.");

        var targets = _calculator.Macros(profile.WeightKg, profile.Goal, _calculator.Tdee(
            profile.Sex, profile.BirthDate, profile.HeightCm, profile.WeightKg, profile.ActivityFactor, profile.Goal));

        var mealTypesString = string.IsNullOrWhiteSpace(profile.MealTypes) ? "Breakfast,Lunch,Dinner,Snack" : profile.MealTypes;
        var activeMealTypes = mealTypesString.Split(',', StringSplitOptions.RemoveEmptyEntries)
            .Select(s => Enum.Parse<MealType>(s.Trim())).ToList();

        if (activeMealTypes.Count == 0)
            activeMealTypes = new List<MealType> { MealType.Breakfast, MealType.Lunch, MealType.Dinner, MealType.Snack };

        var existing = await _context.MealPlans
            .Include(x => x.Items)
            .FirstOrDefaultAsync(x => x.UserId == userId && x.Date == date, ct);

        if (existing is not null)
        {
            _context.MealPlanItems.RemoveRange(existing.Items);
            _context.MealPlans.Remove(existing);
        }

        var plan = new MealPlan
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            Date = date,
            TargetCalories = targets.Calories,
            TargetProteinG = targets.ProteinG,
            TargetCarbsG = targets.CarbsG,
            TargetFatG = targets.FatG
        };

        var ratios = new Dictionary<MealType, decimal>
        {
            [MealType.Breakfast] = 0.25m,
            [MealType.Lunch] = 0.35m,
            [MealType.Dinner] = 0.30m,
            [MealType.Snack] = 0.10m
        };

        var totalRatio = activeMealTypes.Sum(m => ratios[m]);

        foreach (var mealType in activeMealTypes)
        {
            var mealCalories = (int)Math.Round(targets.Calories * (ratios[mealType] / totalRatio));
            var food = await PickFoodAsync(userId, date, mealType, profile.Goal, mealCalories, ct);
            if (food is null) continue;

            var servings = Math.Clamp(Math.Round(mealCalories / (decimal)food.Calories, 1), 0.5m, 2.5m);

            plan.Items.Add(new MealPlanItem
            {
                Id = Guid.NewGuid(),
                FoodId = food.Id,
                MealType = mealType,
                Servings = servings,
                Eaten = false
            });
        }

        _context.MealPlans.Add(plan);
        await _context.SaveChangesAsync(ct);
        return plan;
    }

    private async Task<Food?> PickFoodAsync(Guid userId, DateOnly date, MealType mealType, Goal goal, int targetCalories, CancellationToken ct)
    {
        var allowedObjectives = goal switch
        {
            Goal.Bulk => new[] { CatalogObjective.Bulk, CatalogObjective.Both },
            Goal.Cut => new[] { CatalogObjective.Cut, CatalogObjective.Both },
            _ => new[] { CatalogObjective.Both, CatalogObjective.Bulk }
        };

        var candidates = await _context.Foods
            .AsNoTracking()
            .Where(f => f.MealType == mealType && allowedObjectives.Contains(f.Objective))
            .ToListAsync(ct);

        if (!candidates.Any()) return null;

        var previousDate = date.AddDays(-1);
        var previousPlan = await _context.MealPlans
            .AsNoTracking()
            .Include(x => x.Items)
            .Where(x => x.UserId == userId && x.Date == previousDate && x.Items.Any(i => i.MealType == mealType))
            .SelectMany(x => x.Items)
            .Select(i => i.FoodId)
            .ToListAsync(ct);

        candidates = candidates.Where(c => !previousPlan.Contains(c.Id)).ToList();
        if (!candidates.Any())
            candidates = await _context.Foods.AsNoTracking().Where(f => f.MealType == mealType && allowedObjectives.Contains(f.Objective)).ToListAsync(ct);

        var seed = userId.GetHashCode() ^ date.DayNumber ^ (int)mealType;
        var rng = new Random(seed);
        candidates = candidates.OrderBy(f => Math.Abs(f.Calories - targetCalories)).ThenBy(_ => rng.Next()).ToList();

        return candidates.FirstOrDefault();
    }
}
