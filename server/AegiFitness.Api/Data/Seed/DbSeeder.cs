using AegiFitness.Api.Domain;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace AegiFitness.Api.Data.Seed;

public static class DbSeeder
{
    public static async Task RunAsync(IServiceProvider services)
    {
        using var scope = services.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var userManager = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();
        var roleManager = scope.ServiceProvider.GetRequiredService<RoleManager<IdentityRole<Guid>>>();

        await context.Database.MigrateAsync();

        await SeedRolesAsync(roleManager);
        await SeedAdminAsync(userManager, context);
        await SeedAchievementsAsync(context);
        await SeedCatalogAsync(context);
    }

    private static async Task SeedRolesAsync(RoleManager<IdentityRole<Guid>> roleManager)
    {
        foreach (var role in new[] { "Admin", "Member" })
        {
            if (!await roleManager.RoleExistsAsync(role))
                await roleManager.CreateAsync(new IdentityRole<Guid>(role));
        }
    }

    private static async Task SeedAdminAsync(UserManager<ApplicationUser> userManager, AppDbContext context)
    {
        const string adminEmail = "admin@aegifit.local";
        var admin = await userManager.FindByEmailAsync(adminEmail);
        if (admin is not null) return;

        var password = Environment.GetEnvironmentVariable("SEED_ADMIN_PASSWORD") ?? "Admin#2026!";
        admin = new ApplicationUser
        {
            Id = Guid.NewGuid(),
            UserName = "admin",
            Email = adminEmail,
            DisplayName = "Administrador",
            EmailConfirmed = true,
            CreatedAt = DateTime.UtcNow
        };

        var result = await userManager.CreateAsync(admin, password);
        if (!result.Succeeded)
            throw new InvalidOperationException(string.Join(", ", result.Errors.Select(e => e.Description)));

        await userManager.AddToRoleAsync(admin, "Admin");

        var license = new License
        {
            Id = Guid.NewGuid(),
            UserId = admin.Id,
            Status = LicenseStatus.Active,
            LicensedAt = DateTime.UtcNow,
            ExpiresAt = DateTime.UtcNow.AddYears(10),
            Notes = "Licencia de administrador",
            UpdatedAt = DateTime.UtcNow
        };
        context.Licenses.Add(license);

        context.UserProfiles.Add(new UserProfile
        {
            UserId = admin.Id,
            HeightCm = 175,
            WeightKg = 75,
            Goal = Goal.Recomposition,
            ActivityFactor = 1.4m,
            MealTypes = "Breakfast,Lunch,Dinner,Snack",
            OnboardingCompleted = false
        });

        context.TrainingConfigs.Add(new TrainingConfig
        {
            UserId = admin.Id,
            GymMode = GymMode.Bodybuilding,
            CalisthenicsMode = CalisthenicsMode.Classic,
            Days =
            [
                new TrainingDayConfig { Id = Guid.NewGuid(), UserId = admin.Id, TrainingConfigId = admin.Id, DayOfWeek = 0, Modality = Modality.Rest, MuscleGroups = "" },
                new TrainingDayConfig { Id = Guid.NewGuid(), UserId = admin.Id, TrainingConfigId = admin.Id, DayOfWeek = 1, Modality = Modality.Gym, MuscleGroups = "Chest,Shoulders,Triceps,Core" },
                new TrainingDayConfig { Id = Guid.NewGuid(), UserId = admin.Id, TrainingConfigId = admin.Id, DayOfWeek = 2, Modality = Modality.Gym, MuscleGroups = "Back,Biceps,Core" },
                new TrainingDayConfig { Id = Guid.NewGuid(), UserId = admin.Id, TrainingConfigId = admin.Id, DayOfWeek = 3, Modality = Modality.Gym, MuscleGroups = "Legs" },
                new TrainingDayConfig { Id = Guid.NewGuid(), UserId = admin.Id, TrainingConfigId = admin.Id, DayOfWeek = 4, Modality = Modality.Gym, MuscleGroups = "Chest,Back,Shoulders,Core" },
                new TrainingDayConfig { Id = Guid.NewGuid(), UserId = admin.Id, TrainingConfigId = admin.Id, DayOfWeek = 5, Modality = Modality.Calisthenics, MuscleGroups = "Chest,Back,Legs,Core" },
                new TrainingDayConfig { Id = Guid.NewGuid(), UserId = admin.Id, TrainingConfigId = admin.Id, DayOfWeek = 6, Modality = Modality.Rest, MuscleGroups = "" }
            ]
        });

        await context.SaveChangesAsync();
    }

    private static async Task SeedAchievementsAsync(AppDbContext context)
    {
        var achievements = new Achievement[]
        {
            new() { Id = Guid.NewGuid(), Code = "first-workout", Name = "Primer entrenamiento", Description = "Completa tu primera sesión de entrenamiento.", Icon = "fitness_center", Category = AchievementCategory.Training, XpReward = 50, Threshold = 1, Metric = "workouts-logged" },
            new() { Id = Guid.NewGuid(), Code = "workouts-10", Name = "Diez entrenamientos", Description = "Completa 10 sesiones de entrenamiento.", Icon = "fitness_center", Category = AchievementCategory.Training, XpReward = 100, Threshold = 10, Metric = "workouts-logged" },
            new() { Id = Guid.NewGuid(), Code = "workouts-25", Name = "Veinticinco entrenamientos", Description = "Completa 25 sesiones de entrenamiento.", Icon = "fitness_center", Category = AchievementCategory.Training, XpReward = 200, Threshold = 25, Metric = "workouts-logged" },
            new() { Id = Guid.NewGuid(), Code = "workouts-50", Name = "Cincuenta entrenamientos", Description = "Completa 50 sesiones de entrenamiento.", Icon = "fitness_center", Category = AchievementCategory.Training, XpReward = 350, Threshold = 50, Metric = "workouts-logged" },
            new() { Id = Guid.NewGuid(), Code = "workouts-100", Name = "Cien entrenamientos", Description = "Completa 100 sesiones de entrenamiento.", Icon = "fitness_center", Category = AchievementCategory.Training, XpReward = 500, Threshold = 100, Metric = "workouts-logged" },
            new() { Id = Guid.NewGuid(), Code = "streak-7", Name = "Racha de 7 días", Description = "Mantén una racha activa de 7 días.", Icon = "local_fire_department", Category = AchievementCategory.Consistency, XpReward = 150, Threshold = 7, Metric = "streak-days" },
            new() { Id = Guid.NewGuid(), Code = "streak-14", Name = "Racha de 14 días", Description = "Mantén una racha activa de 14 días.", Icon = "local_fire_department", Category = AchievementCategory.Consistency, XpReward = 300, Threshold = 14, Metric = "streak-days" },
            new() { Id = Guid.NewGuid(), Code = "streak-30", Name = "Racha de 30 días", Description = "Mantén una racha activa de 30 días.", Icon = "local_fire_department", Category = AchievementCategory.Consistency, XpReward = 600, Threshold = 30, Metric = "streak-days" },
            new() { Id = Guid.NewGuid(), Code = "meals-perfect-7", Name = "7 días de nutrición perfecta", Description = "Cumple tus objetivos calóricos 7 días seguidos.", Icon = "restaurant", Category = AchievementCategory.Nutrition, XpReward = 250, Threshold = 7, Metric = "meals-perfect-days" },
            new() { Id = Guid.NewGuid(), Code = "meal-logs-30", Name = "30 registros de comidas", Description = "Registra tus comidas durante 30 días.", Icon = "restaurant", Category = AchievementCategory.Nutrition, XpReward = 150, Threshold = 30, Metric = "meal-logs" },
            new() { Id = Guid.NewGuid(), Code = "weight-goal", Name = "Meta de peso", Description = "Alcanza tu peso objetivo.", Icon = "monitor_weight", Category = AchievementCategory.Progress, XpReward = 400, Threshold = 1, Metric = "weight-goal-reached" },
            new() { Id = Guid.NewGuid(), Code = "protein-streak-7", Name = "Racha proteica", Description = "Cumple tu objetivo de proteína 7 días seguidos.", Icon = "egg_alt", Category = AchievementCategory.Nutrition, XpReward = 200, Threshold = 7, Metric = "protein-streak-days" },
            new() { Id = Guid.NewGuid(), Code = "first-extra", Name = "Primer extra", Description = "Registra tu primer ejercicio o comida extra.", Icon = "add_circle", Category = AchievementCategory.Special, XpReward = 25, Threshold = 1, Metric = "extras-logged" },
            new() { Id = Guid.NewGuid(), Code = "onboarding-done", Name = "Configuración inicial", Description = "Completa el onboarding.", Icon = "check_circle", Category = AchievementCategory.Special, XpReward = 50, Threshold = 1, Metric = "onboarding-completed" }
        };

        foreach (var a in achievements)
        {
            if (!await context.Achievements.AnyAsync(x => x.Code == a.Code))
                context.Achievements.Add(a);
        }

        await context.SaveChangesAsync();
    }

    private static async Task SeedCatalogAsync(AppDbContext context)
    {
        if (!await context.Exercises.AnyAsync())
        {
            var exercises = SeedCatalog.Exercises.Concat(SeedCatalog.ExtraExercises).Select(e => new Exercise
            {
                Name = e.Name,
                MuscleGroup = Enum.Parse<MuscleGroup>(e.MuscleGroup),
                Type = Enum.Parse<Modality>(e.Type),
                Objective = Enum.Parse<CatalogObjective>(e.Objective),
                Difficulty = e.Difficulty,
                Equipment = e.Equipment,
                Description = e.Description,
                Instructions = e.Instructions,
                Target = e.Target,
                Effect = e.Effect
            });
            context.Exercises.AddRange(exercises);
        }

        if (!await context.Foods.AnyAsync())
        {
            var foods = SeedCatalog.Foods.Concat(SeedCatalog.ExtraFoods).Select(f => new Food
            {
                Name = f.Name,
                MealType = Enum.Parse<MealType>(f.MealType),
                Objective = Enum.Parse<CatalogObjective>(f.Objective),
                Calories = f.Calories,
                ProteinG = f.ProteinG,
                CarbsG = f.CarbsG,
                FatG = f.FatG,
                SugarsG = f.SugarsG,
                Portions = f.Portions,
                Ingredients = f.Ingredients,
                Steps = f.Steps,
                Description = f.Description
            });
            context.Foods.AddRange(foods);
        }

        await context.SaveChangesAsync();
    }
}
