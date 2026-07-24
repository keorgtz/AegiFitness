# ==========================================================
# AegiFitness - Smoke general de API
# Levanta la API (Debug), ejecuta checks contra endpoints
# publicos y autenticados, y termina con codigo 0/1.
#
# Uso:
#   pwsh scripts/run-smoke.ps1 [-Port 5212] [-SkipBuild]
# ==========================================================
param(
  [int]$Port = 5212,
  [switch]$SkipBuild
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$apiDir = Join-Path $root "server/AegiFitness.Api"
$dll = Join-Path $apiDir "bin/Debug/net10.0/AegiFitness.Api.dll"
$base = "http://localhost:$Port"

$script:pass = 0
$script:fail = 0
function Check([string]$name, [bool]$ok, [string]$extra = "") {
  if ($ok) { $script:pass++; Write-Output "PASS  $name $extra" }
  else { $script:fail++; Write-Output "FAIL  $name $extra" }
}

function Api([string]$path, [string]$method = "GET", [string]$token = $null, $body = $null) {
  $headers = @{}
  if ($token) { $headers["Authorization"] = "Bearer $token" }
  $params = @{
    Uri = "$base/api$path"
    Method = $method
    Headers = $headers
    ContentType = "application/json"
  }
  if ($null -ne $body) { $params["Body"] = ($body | ConvertTo-Json -Depth 8) }
  return Invoke-RestMethod @params
}

function ApiStatus([string]$path, [string]$method = "GET", [string]$token = $null, $body = $null) {
  try { Api $path $method $token $body | Out-Null; return 200 }
  catch {
    $resp = $_.Exception.Response
    if ($resp) { return [int]$resp.StatusCode }
    return -1
  }
}

$proc = $null
try {
  if (-not $SkipBuild) {
    dotnet build -c Debug --nologo -v q $apiDir | Out-Null
    if ($LASTEXITCODE -ne 0) { Write-Output "FAIL  dotnet build"; exit 1 }
  }

  $out = Join-Path $env:TEMP "aegi-smoke-out.log"
  $err = Join-Path $env:TEMP "aegi-smoke-err.log"
  $proc = Start-Process -FilePath "dotnet" -ArgumentList "`"$dll`" --urls $base" `
    -WorkingDirectory $apiDir -PassThru -WindowStyle Hidden `
    -RedirectStandardOutput $out -RedirectStandardError $err

  $up = $false
  foreach ($i in 1..40) {
    try { Invoke-RestMethod -Uri "$base/api/health" -TimeoutSec 2 | Out-Null; $up = $true; break }
    catch { Start-Sleep -Seconds 1 }
  }
  Check "health endpoint" $up
  if (-not $up) { throw "API no levanto en $base" }

  $today = (Get-Date).ToString("yyyy-MM-dd")
  $stamp = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds() % 100000

  # --- Auth ---
  $admin = Api "/auth/login" "POST" $null @{ usernameOrEmail = "admin"; password = "Admin#2026!" }
  $at = $admin.accessToken
  Check "login admin" ([bool]$at)
  Check "login password incorrecta -> 401" ((ApiStatus "/auth/login" "POST" $null @{ usernameOrEmail = "admin"; password = "mala" }) -eq 401)
  Check "sin token -> 401" ((ApiStatus "/metrics/summary") -eq 401)

  $reg = Api "/auth/register" "POST" $null @{ username = "smoke$stamp"; email = "smoke$stamp@test.dev"; displayName = "Smoke Test"; password = "Smoke#12345" }
  Check "registro usuario nuevo" ($reg.message.Length -gt 0)
  $pendingLogin = Api "/auth/login" "POST" $null @{ usernameOrEmail = "smoke$stamp"; password = "Smoke#12345" }
  Check "usuario pendiente -> 403 en endpoints de licencia" ((ApiStatus "/metrics/summary" "GET" $pendingLogin.accessToken) -eq 403)

  $refresh = Api "/auth/refresh" "POST" $null @{ refreshToken = $admin.refreshToken }
  Check "refresh token rota sesion" ([bool]$refresh.accessToken)
  $at = $refresh.accessToken

  $me = Api "/auth/me" "GET" $at
  Check "GET auth/me" ($me.username -eq "admin")
  $meUpd = Api "/auth/account" "PUT" $at @{ displayName = $me.displayName; email = $me.email }
  Check "PUT auth/account" ($meUpd.username -eq "admin")

  # --- Perfil y config ---
  Api "/profile" "PUT" $at @{ sex = "Male"; birthDate = "1994-03-10"; heightCm = 180; weightKg = 88; targetWeightKg = 95; bodyType = "mesomorfo"; activityFactor = 1.55; goal = "Bulk"; mealTypes = @("Breakfast","Lunch","Dinner","Snack"); onboardingCompleted = $true } | Out-Null
  $profile = Api "/profile" "GET" $at
  Check "PUT/GET profile" ($profile.goal -eq "Bulk")

  $days = @(
    @{ dayOfWeek = 0; modality = "Rest"; muscleGroups = @() },
    @{ dayOfWeek = 1; modality = "Gym"; muscleGroups = @("Chest","Triceps") },
    @{ dayOfWeek = 2; modality = "Gym"; muscleGroups = @("Back","Biceps") },
    @{ dayOfWeek = 3; modality = "Gym"; muscleGroups = @("Legs","Core") },
    @{ dayOfWeek = 4; modality = "Gym"; muscleGroups = @("Shoulders") },
    @{ dayOfWeek = 5; modality = "Both"; muscleGroups = @("Chest","Back") },
    @{ dayOfWeek = 6; modality = "Calisthenics"; muscleGroups = @("Core") }
  )
  Api "/training-config" "PUT" $at @{ gymMode = "Bodybuilding"; calisthenicsMode = "Classic"; days = $days } | Out-Null
  $tc = Api "/training-config" "GET" $at
  Check "PUT/GET training-config" ($tc.days.Count -eq 7)

  # --- Plan de entrenamiento ---
  $plan = Api "/workout-plans/current" "GET" $at
  Check "GET workout-plans/current" ($plan.days.Count -gt 0)
  $regen = Api "/workout-plans/regenerate" "POST" $at $null
  Check "POST workout-plans/regenerate -> 200" ($regen.days.Count -gt 0)
  $plan = Api "/workout-plans/current" "GET" $at
  $dow = [int](Get-Date).DayOfWeek
  $pd = $plan.days | Where-Object { $_.dayOfWeek -eq $dow } | Select-Object -First 1
  if (-not $pd -or $pd.items.Count -eq 0) { $pd = $plan.days | Where-Object { $_.items.Count -gt 0 } | Select-Object -First 1 }
  Check "plan items incluyen exercise.name" ([bool]$pd.items[0].exercise.name)
  $names = $pd.items | ForEach-Object { $_.exercise.name }
  Check "plan sin ejercicios duplicados por nombre" (($names | Sort-Object -Unique).Count -eq $names.Count)

  # --- Workout logs ---
  $entry = $pd.items[0]
  $wlBody = @{ date = $today; planDayId = $pd.id; notes = ""; entries = @(@{
    exerciseId = $entry.exerciseId; plannedSets = $entry.sets; plannedReps = $entry.repsMin
    actualSets = $entry.sets; actualReps = $entry.repsMin; actualWeightKg = 40; completed = $true; isExtra = $false
  }) }
  $wlPost = Api "/workout-logs" "POST" $at $wlBody
  Check "POST workout-logs" ($wlPost.entries.Count -eq 1)
  Check "POST workout-logs devuelve exercise.name" ([bool]$wlPost.entries[0].exercise.name)
  $wl = (Api "/workout-logs?from=$today&to=$today" "GET" $at)
  Check "GET workout-logs" ($wl.Count -ge 1)
  Check "GET workout-logs incluye exercise.name" ([bool]$wl[0].entries[0].exercise.name)

  # --- Nutricion ---
  $mp = Api "/meal-plans/today?date=$today" "GET" $at
  Check "GET meal-plans/today" ($mp.items.Count -gt 0)
  Check "meal plan items incluyen foodId" ($mp.items[0].foodId -gt 0)
  $regenMeal = Api "/meal-plans/regenerate?date=$today" "POST" $at $null
  Check "POST meal-plans/regenerate -> 200" ($regenMeal.items.Count -gt 0)
  $mp = Api "/meal-plans/today?date=$today" "GET" $at
  $fi = $mp.items[0]
  $mlBody = @{ date = $today; entries = @(@{
    foodId = $fi.foodId; mealType = $fi.mealType; servings = 1
    calories = $fi.food.calories; proteinG = $fi.food.proteinG; carbsG = $fi.food.carbsG; fatG = $fi.food.fatG; isExtra = $false
  }) }
  $mlPost = Api "/meal-logs" "POST" $at $mlBody
  Check "POST meal-logs devuelve food.name" ([bool]$mlPost.entries[0].food.name)
  $ml = (Api "/meal-logs?from=$today&to=$today" "GET" $at)
  Check "GET meal-logs incluye food.name" ([bool]$ml[0].entries[0].food.name)

  # --- Metricas ---
  $ms = Api "/metrics/summary?date=$today" "GET" $at
  Check "metrics adherence7d 0-100" ($ms.adherence7d -ge 0 -and $ms.adherence7d -le 100) "(valor: $($ms.adherence7d))"
  Check "metrics adherence30d 0-100" ($ms.adherence30d -ge 0 -and $ms.adherence30d -le 100) "(valor: $($ms.adherence30d))"
  Api "/metrics/weight" "POST" $at @{ date = $today; weightKg = 87.2 } | Out-Null
  $weights = (Api "/metrics/weight?from=$today&to=$today" "GET" $at)
  Check "POST/GET metrics/weight" ($weights.Count -ge 1)

  # --- Gamificacion y metas ---
  $gam = Api "/gamification/summary" "GET" $at
  Check "gamification xpInLevel >= 0" ($gam.xpInLevel -ge 0) "(valor: $($gam.xpInLevel))"
  Check "gamification xpForLevel > 0" ($gam.xpForLevel -gt 0)
  $goal = Api "/goals" "POST" $at @{ type = "WeeklyWorkouts"; title = "Smoke semanal"; targetValue = 5; unit = "entrenos" }
  Check "POST goals" ([bool]$goal.id)
  $goals = (Api "/goals" "GET" $at)
  Check "GET goals" (($goals | Where-Object { $_.id -eq $goal.id }).Count -eq 1)
  $goalUpd = Api "/goals/$($goal.id)" "PUT" $at @{ status = "Completed" }
  Check "PUT goals/{id} status" ($goalUpd.status -eq "Completed")

  # --- Dashboard y catalogos ---
  $dash = Api "/dashboard/summary?date=$today" "GET" $at
  Check "GET dashboard/summary?date" ($null -ne $dash)
  $ex = Api "/exercises?type=Gym&page=1&pageSize=5" "GET" $at
  Check "GET exercises filtrado por tipo" ($ex.items.Count -ge 1)
  $exSearch = Api "/exercises?search=Press&page=1&pageSize=5" "GET" $at
  Check "GET exercises search" ($exSearch.items.Count -ge 1) "($($exSearch.totalCount) resultados)"
  $ex1 = Api "/exercises/$($ex.items[0].id)" "GET" $at
  Check "GET exercises/{id}" ([bool]$ex1.name)
  $foods = Api "/foods?search=&page=1&pageSize=5" "GET" $at
  Check "GET foods search" ($foods.items.Count -ge 1)
  $food1 = Api "/foods/$($foods.items[0].id)" "GET" $at
  Check "GET foods/{id}" ([bool]$food1.name)
}
catch {
  $script:fail++
  Write-Output "FAIL  excepcion: $($_.Exception.Message)"
}
finally {
  if ($proc -and -not $proc.HasExited) { Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue }
}

Write-Output ""
Write-Output "RESULTADO: $($script:pass) PASS / $($script:fail) FAIL"
if ($script:fail -gt 0) { exit 1 }
exit 0
