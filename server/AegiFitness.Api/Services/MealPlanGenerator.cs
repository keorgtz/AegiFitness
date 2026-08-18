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
            var normalizedRatio = ratios[mealType] / totalRatio;
            var mealTarget = new MacroTargets(
                (int)Math.Round(targets.Calories * normalizedRatio),
                (int)Math.Round(targets.ProteinG * normalizedRatio),
                (int)Math.Round(targets.CarbsG * normalizedRatio),
                (int)Math.Round(targets.FatG * normalizedRatio));
            var food = await PickFoodAsync(userId, date, mealType, profile.Goal, mealTarget, ct);
            if (food is null) continue;

            var servings = BestServing(food, mealTarget.Calories);

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

    private async Task<Food?> PickFoodAsync(Guid userId, DateOnly date, MealType mealType, Goal goal, MacroTargets target, CancellationToken ct)
    {
        var allowedObjectives = goal switch
        {
            Goal.Bulk => new[] { CatalogObjective.Bulk, CatalogObjective.Both },
            Goal.Cut => new[] { CatalogObjective.Cut, CatalogObjective.Both },
            _ => new[] { CatalogObjective.Both, CatalogObjective.Bulk, CatalogObjective.Cut }
        };

        var candidates = await _context.Foods
            .AsNoTracking()
            .Where(f => f.MealType == mealType && allowedObjectives.Contains(f.Objective))
            .ToListAsync(ct);

        if (!candidates.Any()) return null;

        var recentFoodUsage = await _context.MealPlans
            .AsNoTracking()
            .Include(x => x.Items)
            .Where(x => x.UserId == userId && x.Date >= date.AddDays(-7) && x.Date < date)
            .SelectMany(x => x.Items)
            .Where(i => i.MealType == mealType)
            .GroupBy(i => i.FoodId)
            .Select(group => new { FoodId = group.Key, Count = group.Count() })
            .ToDictionaryAsync(x => x.FoodId, x => x.Count, ct);

        var seed = userId.GetHashCode() ^ date.DayNumber ^ (int)mealType;
        var rng = new Random(seed);
        candidates = candidates
            .OrderBy(food => ScoreFood(food, target, goal, recentFoodUsage.GetValueOrDefault(food.Id)))
            .ThenBy(_ => rng.Next())
            .ToList();

        return candidates.FirstOrDefault();
    }

    private static decimal BestServing(Food food, int targetCalories)
    {
        if (food.Calories <= 0) return 1m;
        return Math.Clamp(Math.Round(targetCalories / (decimal)food.Calories, 1), 0.5m, 3m);
    }

    private static decimal ScoreFood(Food food, MacroTargets target, Goal goal, int recentUses)
    {
        var servings = BestServing(food, target.Calories);
        decimal Difference(decimal actual, decimal expected) => expected <= 0 ? 0 : Math.Abs(actual - expected) / expected;

        var calorieDifference = Difference(food.Calories * servings, target.Calories);
        var proteinDifference = Difference(food.ProteinG * servings, target.ProteinG);
        var carbDifference = Difference(food.CarbsG * servings, target.CarbsG);
        var fatDifference = Difference(food.FatG * servings, target.FatG);
        var varietyPenalty = recentUses * 0.12m;
        var objectivePenalty = food.Objective == CatalogObjective.Both
            || (goal == Goal.Bulk && food.Objective == CatalogObjective.Bulk)
            || (goal == Goal.Cut && food.Objective == CatalogObjective.Cut)
            ? 0m
            : 0.2m;
        var sugarPenalty = goal == Goal.Cut && target.Calories > 0
            ? food.SugarsG * servings / target.Calories * 0.15m
            : 0m;

        return calorieDifference * 0.4m
            + proteinDifference * 0.3m
            + carbDifference * 0.15m
            + fatDifference * 0.15m
            + varietyPenalty
            + objectivePenalty
            + sugarPenalty;
    }
}
