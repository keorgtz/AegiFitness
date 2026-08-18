using AegiFitness.Api.Data;
using AegiFitness.Api.Domain;
using Microsoft.EntityFrameworkCore;

namespace AegiFitness.Api.Services;

public class WorkoutPlanGenerator
{
    private readonly AppDbContext _context;

    public WorkoutPlanGenerator(AppDbContext context)
    {
        _context = context;
    }

    public async Task<WorkoutPlan> GenerateAsync(Guid userId, TrainingConfig config, Goal goal, CancellationToken ct = default)
    {
        var exercises = await _context.Exercises.AsNoTracking().ToListAsync(ct);
        var activeDays = config.Days.OrderBy(d => d.DayOfWeek).Where(d => d.Modality != Modality.Rest).ToList();
        var recentCutoff = DateOnly.FromDateTime(DateTime.UtcNow).AddDays(-21);
        var recentUsage = await _context.WorkoutLogEntries
            .AsNoTracking()
            .Where(x => x.Log.UserId == userId && x.Log.Date >= recentCutoff && x.Completed)
            .GroupBy(x => x.ExerciseId)
            .Select(group => new { ExerciseId = group.Key, Count = group.Count() })
            .ToDictionaryAsync(x => x.ExerciseId, x => x.Count, ct);
        var weekSeed = userId.GetHashCode() ^ DateTime.UtcNow.Year ^ DateTime.UtcNow.DayOfYear / 7;
        var rng = new Random(weekSeed);

        var plan = new WorkoutPlan
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            CreatedAt = DateTime.UtcNow,
            IsActive = true
        };

        var usedExerciseIds = new HashSet<int>();
        var usedExerciseNames = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

        foreach (var day in activeDays)
        {
            var muscles = GetMusclesForDay(day, activeDays.Count, activeDays.IndexOf(day));
            var dayModality = day.Modality;
            var scheme = ResolveScheme(config, dayModality);
            var candidates = SelectCandidates(exercises, dayModality, muscles, goal, usedExerciseIds, usedExerciseNames, recentUsage, rng);
            var items = BuildItems(candidates, config, dayModality, scheme, rng);

            var planDay = new WorkoutPlanDay
            {
                Id = Guid.NewGuid(),
                DayOfWeek = day.DayOfWeek,
                Modality = dayModality,
                Focus = string.Join(", ", muscles.Select(MuscleLabel)),
                Items = items.ToList()
            };
            plan.Days.Add(planDay);

            foreach (var item in items)
            {
                usedExerciseIds.Add(item.ExerciseId);
                var ex = exercises.FirstOrDefault(e => e.Id == item.ExerciseId);
                if (ex is not null) usedExerciseNames.Add(ex.Name);
            }
        }

        var previous = await _context.WorkoutPlans.Where(x => x.UserId == userId && x.IsActive).ToListAsync(ct);
        foreach (var p in previous)
            p.IsActive = false;

        _context.WorkoutPlans.Add(plan);
        await _context.SaveChangesAsync(ct);
        return plan;
    }

    private static List<MuscleGroup> GetMusclesForDay(TrainingDayConfig day, int activeDayCount, int index)
    {
        if (!string.IsNullOrWhiteSpace(day.MuscleGroups))
            return day.MuscleGroups.Split(',', StringSplitOptions.RemoveEmptyEntries)
                .Select(s => Enum.Parse<MuscleGroup>(s.Trim())).ToList();

        var push = new List<MuscleGroup> { MuscleGroup.Chest, MuscleGroup.Shoulders, MuscleGroup.Triceps };
        var pull = new List<MuscleGroup> { MuscleGroup.Back, MuscleGroup.Biceps, MuscleGroup.Core };
        var legs = new List<MuscleGroup> { MuscleGroup.Legs, MuscleGroup.Core };
        var upper = new List<MuscleGroup> { MuscleGroup.Chest, MuscleGroup.Back, MuscleGroup.Shoulders, MuscleGroup.Biceps, MuscleGroup.Triceps };
        var fullBody = new List<MuscleGroup> { MuscleGroup.Chest, MuscleGroup.Back, MuscleGroup.Legs, MuscleGroup.Shoulders, MuscleGroup.Core };

        return activeDayCount switch
        {
            <= 1 => fullBody,
            2 => index == 0 ? upper : legs,
            3 => fullBody,
            4 => index % 2 == 0 ? upper : legs,
            5 => index switch { 0 => push, 1 => pull, 2 => legs, 3 => upper, _ => legs },
            _ => (index % 3) switch
            {
                0 => push,
                1 => pull,
                _ => legs
            }
        };
    }

    private static Scheme ResolveScheme(TrainingConfig config, Modality modality)
    {
        if (modality == Modality.Gym)
            return config.GymMode switch
            {
                GymMode.Bodybuilding => Scheme.Bodybuilding,
                GymMode.Health => Scheme.Health,
                _ => Scheme.Combined
            };

        if (modality == Modality.Calisthenics)
            return config.CalisthenicsMode switch
            {
                CalisthenicsMode.Military => Scheme.Military,
                CalisthenicsMode.CrossFit => Scheme.CrossFit,
                _ => Scheme.Classic
            };

        // Both: el día usa un esquema mixto; los ejercicios individuales deciden por Type
        return config.GymMode switch
        {
            GymMode.Bodybuilding => Scheme.Bodybuilding,
            GymMode.Health => Scheme.Health,
            _ => Scheme.Combined
        };
    }

    private static Scheme ExerciseScheme(Exercise exercise, TrainingConfig config, Modality dayModality)
    {
        if (dayModality != Modality.Both)
            return ResolveScheme(config, dayModality);

        return exercise.Type switch
        {
            Modality.Gym => config.GymMode switch
            {
                GymMode.Bodybuilding => Scheme.Bodybuilding,
                GymMode.Health => Scheme.Health,
                _ => Scheme.Combined
            },
            Modality.Calisthenics => config.CalisthenicsMode switch
            {
                CalisthenicsMode.Military => Scheme.Military,
                CalisthenicsMode.CrossFit => Scheme.CrossFit,
                _ => Scheme.Classic
            },
            _ => Scheme.Classic
        };
    }

    private static List<Exercise> SelectCandidates(List<Exercise> all, Modality modality, List<MuscleGroup> muscles, Goal goal, HashSet<int> used, HashSet<string> usedNames, IReadOnlyDictionary<int, int> recentUsage, Random rng)
    {
        var allowedTypes = modality switch
        {
            Modality.Gym => new[] { Modality.Gym },
            Modality.Calisthenics => new[] { Modality.Calisthenics },
            Modality.Both => new[] { Modality.Gym, Modality.Calisthenics },
            _ => new[] { Modality.Gym }
        };

        // El catálogo tiene variantes Bulk/Cut del mismo ejercicio: dedup por nombre
        // para no meter "el mismo" ejercicio dos veces en el día o la semana.
        IEnumerable<Exercise> DistinctNames(IEnumerable<Exercise> source) => source
            .GroupBy(e => e.Name, StringComparer.OrdinalIgnoreCase)
            .Select(g => g.First());

        IEnumerable<Exercise> ByType(IEnumerable<Exercise> source) => DistinctNames(source.Where(e => allowedTypes.Contains(e.Type)));
        IEnumerable<Exercise> Unused(IEnumerable<Exercise> source) => source.Where(e => !used.Contains(e.Id) && !usedNames.Contains(e.Name));

        bool MatchesGoal(Exercise exercise) => exercise.Objective == CatalogObjective.Both
            || (goal == Goal.Bulk && exercise.Objective == CatalogObjective.Bulk)
            || (goal == Goal.Cut && exercise.Objective == CatalogObjective.Cut)
            || goal == Goal.Recomposition;

        List<Exercise> Order(IEnumerable<Exercise> source) => source
            .OrderBy(e => MatchesGoal(e) ? 0 : 1)
            .ThenBy(e => recentUsage.GetValueOrDefault(e.Id))
            .ThenBy(e => goal == Goal.Bulk ? -e.Difficulty : e.Difficulty)
            .ThenBy(_ => rng.Next())
            .ToList();

        var typed = ByType(all).ToList();
        var candidates = new List<Exercise>();
        for (var round = 0; round < 2; round++)
        {
            foreach (var muscle in muscles)
            {
                var candidate = Order(Unused(typed.Where(e => e.MuscleGroup == muscle))).Skip(round).FirstOrDefault();
                if (candidate is not null) candidates.Add(candidate);
            }
        }
        candidates = candidates.DistinctBy(e => e.Name, StringComparer.OrdinalIgnoreCase).ToList();
        candidates.AddRange(Order(Unused(typed.Where(e => muscles.Contains(e.MuscleGroup) && !candidates.Any(c => c.Name.Equals(e.Name, StringComparison.OrdinalIgnoreCase))))));
        if (candidates.Count < 4)
            candidates.AddRange(Order(Unused(typed.Where(e => !candidates.Any(c => c.Name.Equals(e.Name, StringComparison.OrdinalIgnoreCase))))));
        if (candidates.Count < 4)
            candidates.AddRange(Order(typed.Where(e => !candidates.Any(c => c.Name.Equals(e.Name, StringComparison.OrdinalIgnoreCase)))));
        if (candidates.Count < 4)
            candidates.AddRange(Order(DistinctNames(all).Where(e => !candidates.Any(c => c.Name.Equals(e.Name, StringComparison.OrdinalIgnoreCase)))));

        if (muscles.Contains(MuscleGroup.Core) && !candidates.Any(e => e.MuscleGroup == MuscleGroup.Core))
        {
            var core = Order(Unused(typed.Where(e => e.MuscleGroup == MuscleGroup.Core))).FirstOrDefault()
                ?? Order(typed.Where(e => e.MuscleGroup == MuscleGroup.Core)).FirstOrDefault();
            if (core is not null && !candidates.Contains(core)) candidates.Add(core);
        }

        return candidates;
    }

    private static List<WorkoutPlanItem> BuildItems(List<Exercise> candidates, TrainingConfig config, Modality dayModality, Scheme dayScheme, Random rng)
    {
        int count = dayScheme switch
        {
            Scheme.Bodybuilding => 7,
            Scheme.Health => 5,
            Scheme.Combined => 7,
            Scheme.Classic => 6,
            Scheme.Military => 7,
            Scheme.CrossFit => 6,
            _ => 6
        };

        var selected = candidates.Take(count).ToList();
        if (selected.Count < count)
            selected = candidates.Take(Math.Max(count, candidates.Count)).ToList();

        if (dayModality == Modality.Both && selected.Count >= 5)
        {
            foreach (var neededType in new[] { Modality.Gym, Modality.Calisthenics })
            {
                var surplusType = neededType == Modality.Gym ? Modality.Calisthenics : Modality.Gym;
                while (selected.Count(e => e.Type == neededType) < 2)
                {
                    var extra = candidates.FirstOrDefault(e => e.Type == neededType && !selected.Contains(e));
                    if (extra is null) break;
                    var idx = selected.FindLastIndex(e => e.Type == surplusType && selected.Count(x => x.Type == surplusType) > 2);
                    if (idx < 0) break;
                    selected[idx] = extra;
                }
            }
        }

        int order = 1;
        var items = new List<WorkoutPlanItem>();
        foreach (var ex in selected)
        {
            var scheme = ExerciseScheme(ex, config, dayModality);
            var (sets, repsMin, repsMax, rest, notes) = scheme switch
            {
                Scheme.Bodybuilding => ex.Difficulty >= 2
                    ? (4, 8, 10, 120, null)
                    : (ex.Difficulty == 1 ? 3 : 4, 12, 15, 60, null),
                Scheme.Health => (3, 12, 15, 60, null),
                Scheme.Combined => ex.Type == Modality.Gym
                    ? (4, 8, 10, 120, null)
                    : (3, 8, 15, 60, "AMRAP"),
                Scheme.Classic => (4, 6, 12, 90, null),
                Scheme.Military => (4, 15, 25, 45, "Circuito ×4"),
                Scheme.CrossFit => (3, 10, 20, 60, PickCrossFitFormat(rng)),
                _ => (3, 10, 12, 60, null)
            };

            items.Add(new WorkoutPlanItem
            {
                Id = Guid.NewGuid(),
                ExerciseId = ex.Id,
                Order = order++,
                Sets = sets,
                RepsMin = repsMin,
                RepsMax = repsMax,
                RestSeconds = rest,
                Notes = notes
            });
        }

        return items;
    }

    private static string PickCrossFitFormat(Random rng)
    {
        var formats = new[] { "AMRAP 15'", "EMOM 12'", "For Time" };
        return formats[rng.Next(formats.Length)];
    }

    private static string MuscleLabel(MuscleGroup m) => m switch
    {
        MuscleGroup.Chest => "Pecho",
        MuscleGroup.Back => "Espalda",
        MuscleGroup.Legs => "Piernas",
        MuscleGroup.Shoulders => "Hombros",
        MuscleGroup.Biceps => "Bíceps",
        MuscleGroup.Triceps => "Tríceps",
        MuscleGroup.Core => "Abdomen",
        _ => m.ToString()
    };

    private enum Scheme { Bodybuilding, Health, Combined, Classic, Military, CrossFit }
}
