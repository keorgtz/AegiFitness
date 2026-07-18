using AegiFitness.Api.Domain;

namespace AegiFitness.Api.Services;

public class PlanCalculator
{
    public decimal Bmr(Sex? sex, DateOnly? birthDate, decimal heightCm, decimal weightKg)
    {
        if (sex is null || birthDate is null)
            return 0;

        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var age = today.Year - birthDate.Value.Year;
        if (today < new DateOnly(today.Year, birthDate.Value.Month, birthDate.Value.Day))
            age--;

        return sex switch
        {
            Sex.Male => 10m * weightKg + 6.25m * heightCm - 5m * age + 5m,
            Sex.Female => 10m * weightKg + 6.25m * heightCm - 5m * age - 161m,
            _ => 0
        };
    }

    public decimal Tdee(Sex? sex, DateOnly? birthDate, decimal heightCm, decimal weightKg, decimal activityFactor, Goal goal)
    {
        var bmr = Bmr(sex, birthDate, heightCm, weightKg);
        var tdee = bmr * activityFactor;
        var adjustment = goal switch
        {
            Goal.Bulk => 350m,
            Goal.Cut => -450m,
            _ => -100m
        };
        return tdee + adjustment;
    }

    public MacroTargets Macros(decimal weightKg, Goal goal, decimal calories)
    {
        var proteinFactor = goal switch
        {
            Goal.Bulk => 2.0m,
            Goal.Cut => 2.4m,
            _ => 2.2m
        };
        var proteinG = (int)Math.Round(weightKg * proteinFactor);
        var fatG = (int)Math.Round(calories * 0.25m / 9m);
        var carbsG = (int)Math.Round((calories - (proteinG * 4m) - (fatG * 9m)) / 4m);
        return new MacroTargets((int)calories, proteinG, carbsG, fatG);
    }

    public decimal Bmi(decimal heightCm, decimal weightKg)
    {
        var heightM = heightCm / 100m;
        if (heightM <= 0) return 0;
        return weightKg / (heightM * heightM);
    }
}

public record MacroTargets(int Calories, int ProteinG, int CarbsG, int FatG);
