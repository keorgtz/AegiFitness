namespace AegiFitness.Api.Data.Seed;

public sealed record ExerciseSeed(
    string Name,
    string MuscleGroup,
    string Type,
    string Objective,
    int Difficulty,
    string Equipment,
    string Description,
    string Instructions,
    string Target,
    string Effect);

public sealed record FoodSeed(
    string Name,
    string MealType,
    string Objective,
    int Calories,
    int ProteinG,
    int CarbsG,
    int FatG,
    int SugarsG,
    string Portions,
    string[] Ingredients,
    string[] Steps,
    string Description);
