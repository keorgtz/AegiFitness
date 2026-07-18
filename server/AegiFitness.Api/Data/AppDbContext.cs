using AegiFitness.Api.Domain;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage.ValueConversion;
using System.Reflection;

namespace AegiFitness.Api.Data;

public class AppDbContext : IdentityDbContext<ApplicationUser, IdentityRole<Guid>, Guid>
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

    public DbSet<License> Licenses { get; set; } = null!;
    public DbSet<UserProfile> UserProfiles { get; set; } = null!;
    public DbSet<TrainingConfig> TrainingConfigs { get; set; } = null!;
    public DbSet<TrainingDayConfig> TrainingDayConfigs { get; set; } = null!;
    public DbSet<Exercise> Exercises { get; set; } = null!;
    public DbSet<Food> Foods { get; set; } = null!;
    public DbSet<WorkoutPlan> WorkoutPlans { get; set; } = null!;
    public DbSet<WorkoutPlanDay> WorkoutPlanDays { get; set; } = null!;
    public DbSet<WorkoutPlanItem> WorkoutPlanItems { get; set; } = null!;
    public DbSet<WorkoutLog> WorkoutLogs { get; set; } = null!;
    public DbSet<WorkoutLogEntry> WorkoutLogEntries { get; set; } = null!;
    public DbSet<MealPlan> MealPlans { get; set; } = null!;
    public DbSet<MealPlanItem> MealPlanItems { get; set; } = null!;
    public DbSet<MealLog> MealLogs { get; set; } = null!;
    public DbSet<MealLogEntry> MealLogEntries { get; set; } = null!;
    public DbSet<XpEvent> XpEvents { get; set; } = null!;
    public DbSet<Achievement> Achievements { get; set; } = null!;
    public DbSet<UserAchievement> UserAchievements { get; set; } = null!;
    public DbSet<UserGoal> UserGoals { get; set; } = null!;
    public DbSet<WeightEntry> WeightEntries { get; set; } = null!;
    public DbSet<RefreshToken> RefreshTokens { get; set; } = null!;

    protected override void OnModelCreating(ModelBuilder builder)
    {
        base.OnModelCreating(builder);

        foreach (var entityType in builder.Model.GetEntityTypes())
        {
            foreach (var property in entityType.GetProperties())
            {
                if (property.ClrType.IsEnum)
                {
                    var converterType = typeof(EnumToStringConverter<>).MakeGenericType(property.ClrType);
                    var converter = (ValueConverter)Activator.CreateInstance(converterType, (ConverterMappingHints?)null)!;
                    property.SetValueConverter(converter);
                }
            }
        }

        builder.Entity<ApplicationUser>(u =>
        {
            u.HasOne(x => x.License).WithOne(x => x.User).HasForeignKey<License>(x => x.UserId).OnDelete(DeleteBehavior.Cascade);
            u.HasOne(x => x.Profile).WithOne(x => x.User).HasForeignKey<UserProfile>(x => x.UserId).OnDelete(DeleteBehavior.Cascade);
            u.HasOne(x => x.TrainingConfig).WithOne(x => x.User).HasForeignKey<TrainingConfig>(x => x.UserId).OnDelete(DeleteBehavior.Cascade);
            u.HasIndex(x => x.UserName).IsUnique();
        });

        builder.Entity<License>(l =>
        {
            l.HasKey(x => x.Id);
            l.HasIndex(x => x.UserId).IsUnique();
        });

        builder.Entity<UserProfile>(p =>
        {
            p.HasKey(x => x.UserId);
        });

        builder.Entity<TrainingConfig>(tc =>
        {
            tc.HasKey(x => x.UserId);
            tc.HasMany(x => x.Days).WithOne(x => x.TrainingConfig).HasForeignKey(x => x.TrainingConfigId).OnDelete(DeleteBehavior.Cascade);
        });

        builder.Entity<TrainingDayConfig>(td =>
        {
            td.HasIndex(x => new { x.UserId, x.DayOfWeek }).IsUnique();
        });

        builder.Entity<Exercise>(e =>
        {
            e.HasIndex(x => new { x.MuscleGroup, x.Type });
            e.HasIndex(x => x.Name);
        });

        builder.Entity<Food>(f =>
        {
            f.HasIndex(x => new { x.MealType, x.Objective });
            f.HasIndex(x => x.Name);
            f.Property(x => x.Ingredients).HasColumnType("jsonb");
            f.Property(x => x.Steps).HasColumnType("jsonb");
        });

        builder.Entity<WorkoutPlan>(wp =>
        {
            wp.HasMany(x => x.Days).WithOne(x => x.Plan).HasForeignKey(x => x.PlanId).OnDelete(DeleteBehavior.Cascade);
        });

        builder.Entity<WorkoutPlanDay>(wd =>
        {
            wd.HasMany(x => x.Items).WithOne(x => x.Day).HasForeignKey(x => x.DayId).OnDelete(DeleteBehavior.Cascade);
        });

        builder.Entity<WorkoutPlanItem>(wi =>
        {
            wi.HasOne(x => x.Exercise).WithMany().HasForeignKey(x => x.ExerciseId).OnDelete(DeleteBehavior.Restrict);
        });

        builder.Entity<WorkoutLog>(wl =>
        {
            wl.HasIndex(x => new { x.UserId, x.Date });
            wl.HasMany(x => x.Entries).WithOne(x => x.Log).HasForeignKey(x => x.LogId).OnDelete(DeleteBehavior.Cascade);
            wl.HasOne(x => x.PlanDay).WithMany().HasForeignKey(x => x.PlanDayId).OnDelete(DeleteBehavior.SetNull);
        });

        builder.Entity<WorkoutLogEntry>(we =>
        {
            we.HasOne(x => x.Exercise).WithMany().HasForeignKey(x => x.ExerciseId).OnDelete(DeleteBehavior.Restrict);
        });

        builder.Entity<MealPlan>(mp =>
        {
            mp.HasIndex(x => new { x.UserId, x.Date });
            mp.HasMany(x => x.Items).WithOne(x => x.Plan).HasForeignKey(x => x.PlanId).OnDelete(DeleteBehavior.Cascade);
        });

        builder.Entity<MealPlanItem>(mi =>
        {
            mi.HasOne(x => x.Food).WithMany().HasForeignKey(x => x.FoodId).OnDelete(DeleteBehavior.Restrict);
        });

        builder.Entity<MealLog>(ml =>
        {
            ml.HasIndex(x => new { x.UserId, x.Date });
            ml.HasMany(x => x.Entries).WithOne(x => x.Log).HasForeignKey(x => x.LogId).OnDelete(DeleteBehavior.Cascade);
        });

        builder.Entity<MealLogEntry>(me =>
        {
            me.HasOne(x => x.Food).WithMany().HasForeignKey(x => x.FoodId).OnDelete(DeleteBehavior.SetNull);
        });

        builder.Entity<XpEvent>(x =>
        {
            x.HasIndex(x => x.UserId);
        });

        builder.Entity<Achievement>(a =>
        {
            a.HasIndex(x => x.Code).IsUnique();
        });

        builder.Entity<UserAchievement>(ua =>
        {
            ua.HasKey(x => new { x.UserId, x.AchievementId });
            ua.HasOne(x => x.Achievement).WithMany(x => x.UserAchievements).HasForeignKey(x => x.AchievementId).OnDelete(DeleteBehavior.Cascade);
            ua.HasOne(x => x.User).WithMany(x => x.UserAchievements).HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Cascade);
        });

        builder.Entity<UserGoal>(g =>
        {
            g.HasIndex(x => x.UserId);
        });

        builder.Entity<WeightEntry>(w =>
        {
            w.HasIndex(x => new { x.UserId, x.Date });
        });

        builder.Entity<RefreshToken>(rt =>
        {
            rt.HasIndex(x => x.TokenHash).IsUnique();
        });
    }
}
