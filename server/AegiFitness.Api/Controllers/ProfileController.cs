using AegiFitness.Api.Data;
using AegiFitness.Api.Domain;
using AegiFitness.Api.Dtos;
using AegiFitness.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace AegiFitness.Api.Controllers;

[ApiController]
[Route("api/profile")]
[Authorize(Policy = "ActiveLicense")]
public class ProfileController : ControllerBase
{
    private readonly AppDbContext _context;
    private readonly PlanCalculator _calculator;
    private readonly MealPlanGenerator _mealPlanGenerator;
    private readonly GamificationService _gamification;

    public ProfileController(
        AppDbContext context,
        PlanCalculator calculator,
        MealPlanGenerator mealPlanGenerator,
        GamificationService gamification)
    {
        _context = context;
        _calculator = calculator;
        _mealPlanGenerator = mealPlanGenerator;
        _gamification = gamification;
    }

    [HttpGet]
    public async Task<ActionResult<ProfileDto>> Get()
    {
        var userId = CurrentUserId();
        var profile = await _context.UserProfiles.AsNoTracking().FirstOrDefaultAsync(x => x.UserId == userId);
        if (profile is null) return NotFound();
        return Ok(Map(profile));
    }

    [HttpPut]
    public async Task<ActionResult<ProfileDto>> Update(ProfileUpdateDto dto)
    {
        var userId = CurrentUserId();
        var profile = await _context.UserProfiles.FirstOrDefaultAsync(x => x.UserId == userId);
        if (profile is null) return NotFound();

        profile.Sex = dto.Sex;
        profile.BirthDate = dto.BirthDate;
        profile.HeightCm = dto.HeightCm;
        profile.WeightKg = dto.WeightKg;
        profile.TargetWeightKg = dto.TargetWeightKg;
        profile.BodyType = dto.BodyType;
        profile.ActivityFactor = dto.ActivityFactor;
        profile.Goal = dto.Goal;
        profile.MealTypes = string.Join(",", dto.MealTypes);
        profile.OnboardingCompleted = dto.OnboardingCompleted;
        profile.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();

        if (dto.OnboardingCompleted)
            await _gamification.EvaluateOnboardingAsync(userId);

        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        await _mealPlanGenerator.GenerateForDateAsync(userId, today);

        return Ok(Map(profile));
    }

    private ProfileDto Map(UserProfile p)
    {
        var tdee = _calculator.Tdee(p.Sex, p.BirthDate, p.HeightCm, p.WeightKg, p.ActivityFactor, p.Goal);
        var targets = _calculator.Macros(p.WeightKg, p.Goal, tdee);
        return new ProfileDto(
            p.Sex,
            p.BirthDate,
            p.HeightCm,
            p.WeightKg,
            p.TargetWeightKg,
            p.BodyType,
            p.ActivityFactor,
            p.Goal,
            p.MealTypes.Split(',', StringSplitOptions.RemoveEmptyEntries).Select(s => Enum.Parse<MealType>(s)).ToArray(),
            p.OnboardingCompleted,
            _calculator.Bmi(p.HeightCm, p.WeightKg),
            tdee,
            new MacroTargetsDto(targets.Calories, targets.ProteinG, targets.CarbsG, targets.FatG));
    }

    private Guid CurrentUserId() => Guid.Parse(User.FindFirst("sub")?.Value ?? Guid.Empty.ToString());
}
