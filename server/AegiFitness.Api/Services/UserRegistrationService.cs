using AegiFitness.Api.Data;
using AegiFitness.Api.Domain;
using AegiFitness.Api.Dtos;
using Microsoft.AspNetCore.Identity;

namespace AegiFitness.Api.Services;

public class UserRegistrationService(AppDbContext context, UserManager<ApplicationUser> users)
{
    public async Task<(ApplicationUser? User, string[] Errors)> CreateAsync(RegisterDto dto, bool activateLicense = false)
    {
        if (dto.Username.Trim().Length < 3)
            return (null, ["El usuario debe tener al menos 3 caracteres, sin contar espacios externos."]);
        await using var transaction = await context.Database.BeginTransactionAsync();
        var user = new ApplicationUser
        {
            Id = Guid.NewGuid(),
            UserName = dto.Username.Trim(),
            Email = dto.Email.Trim(),
            DisplayName = dto.DisplayName.Trim()
        };
        var result = await users.CreateAsync(user, dto.Password);
        if (!result.Succeeded) return (null, result.Errors.Select(Describe).ToArray());

        result = await users.AddToRoleAsync(user, "Member");
        if (!result.Succeeded) return (null, ["No se pudo asignar el rol de usuario. Intenta de nuevo."]);

        context.Licenses.Add(new License
        {
            Id = Guid.NewGuid(), UserId = user.Id,
            Status = activateLicense ? LicenseStatus.Active : LicenseStatus.Pending,
            LicensedAt = activateLicense ? DateTime.UtcNow : null,
            UpdatedAt = DateTime.UtcNow
        });
        context.UserProfiles.Add(new UserProfile { UserId = user.Id, Goal = Goal.Recomposition });
        context.TrainingConfigs.Add(new TrainingConfig { UserId = user.Id });
        await context.SaveChangesAsync();
        await transaction.CommitAsync();
        return (user, []);
    }

    private static string Describe(IdentityError error) => error.Code switch
    {
        "DuplicateUserName" => "Ese nombre de usuario ya está en uso.",
        "DuplicateEmail" => "Ese correo ya está en uso.",
        "InvalidUserName" => "El usuario solo puede contener letras sin acentos, números y los símbolos . _ - @ +.",
        "InvalidEmail" => "Ingresa un correo válido.",
        "PasswordTooShort" => "La contraseña debe tener al menos 8 caracteres.",
        "PasswordRequiresDigit" => "La contraseña debe incluir un número.",
        "PasswordRequiresUpper" => "La contraseña debe incluir una mayúscula.",
        "PasswordRequiresLower" => "La contraseña debe incluir una minúscula.",
        "PasswordRequiresNonAlphanumeric" => "La contraseña debe incluir un símbolo.",
        _ => error.Description
    };
}
