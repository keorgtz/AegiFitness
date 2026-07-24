# ==========================================================
# AegiFitness - Smoke de administracion
# Levanta la API (Debug), verifica gestion de usuarios,
# licencias, passwords y roles con un usuario temporal.
#
# Uso:
#   pwsh scripts/run-smoke-admin.ps1 [-Port 5212] [-SkipBuild]
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

  $out = Join-Path $env:TEMP "aegi-smoke-admin-out.log"
  $err = Join-Path $env:TEMP "aegi-smoke-admin-err.log"
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

  $stamp = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds() % 100000
  $uname = "adm$stamp"

  $admin = Api "/auth/login" "POST" $null @{ usernameOrEmail = "admin"; password = "Admin#2026!" }
  $at = $admin.accessToken
  Check "login admin" ([bool]$at)

  # Usuario temporal para operar
  Api "/auth/register" "POST" $null @{ username = $uname; email = "$uname@test.dev"; displayName = "Admin Smoke"; password = "Smoke#12345" } | Out-Null
  $pending = (Api "/admin/users?filter=pending" "GET" $at)
  $target = $pending | Where-Object { $_.username -eq $uname } | Select-Object -First 1
  Check "GET admin/users?filter=pending contiene al nuevo usuario" ($null -ne $target)
  $uid = $target.id

  $all = (Api "/admin/users?filter=all" "GET" $at)
  Check "GET admin/users?filter=all" ($all.Count -ge 2)

  # Sin rol admin -> prohibido
  $tmpLogin = Api "/auth/login" "POST" $null @{ usernameOrEmail = $uname; password = "Smoke#12345" }
  Check "usuario sin rol admin -> 403 en /api/admin/users" ((ApiStatus "/admin/users" "GET" $tmpLogin.accessToken) -eq 403)

  # Aprobar (de por vida)
  $lic = Api "/admin/users/$uid/license/approve" "POST" $at $null
  Check "approve -> Active de por vida" ($lic.status -eq "Active" -and $null -eq $lic.expiresAt)

  # Datos de usuario
  $upd = Api "/admin/users/$uid" "PUT" $at @{ displayName = "Admin Smoke Editado"; username = $uname; email = "$uname@test.dev" }
  Check "PUT admin/users/{id} datos" ($upd.displayName -eq "Admin Smoke Editado")

  # Reset de password -> login con la nueva
  Api "/admin/users/$uid/password" "POST" $at @{ newPassword = "Nueva#Pass123" } | Out-Null
  $relogin = ApiStatus "/auth/login" "POST" $null @{ usernameOrEmail = $uname; password = "Nueva#Pass123" }
  Check "POST admin/users/{id}/password permite relogin" ($relogin -eq 200)

  # Licencia con vencimiento (UTC) y lifetime
  $exp = (Get-Date).AddDays(30).ToString("yyyy-MM-dd")
  $licExp = Api "/admin/users/$uid/license" "PUT" $at @{ status = "Active"; expiresAt = $exp; notes = "smoke" }
  Check "PUT license con vencimiento" ($null -ne $licExp.expiresAt) "(vence: $($licExp.expiresAt))"
  $licLife = Api "/admin/users/$uid/license" "PUT" $at @{ status = "Active"; expiresAt = $null; notes = "smoke" }
  Check "PUT license de por vida" ($null -eq $licLife.expiresAt)
  $licExt = Api "/admin/users/$uid/license/extend" "PUT" $at @{ days = 15 }
  Check "PUT license/extend suma dias" ($null -ne $licExt.expiresAt)

  # Roles
  $roles = Api "/admin/users/$uid/roles" "POST" $at @{ role = "Admin"; grant = $true }
  Check "roles grant Admin" ($roles -contains "Admin")
  $roles2 = Api "/admin/users/$uid/roles" "POST" $at @{ role = "Admin"; grant = $false }
  Check "roles revoke Admin" ($roles2 -notcontains "Admin")
  $meId = (Api "/auth/me" "GET" $at).id
  Check "revocar propio rol admin -> 400" ((ApiStatus "/admin/users/$meId/roles" "POST" $at @{ role = "Admin"; grant = $false }) -eq 400)

  # Suspender -> usuario bloqueado; revocar
  $tmpActive = Api "/auth/login" "POST" $null @{ usernameOrEmail = $uname; password = "Nueva#Pass123" }
  $sus = Api "/admin/users/$uid/license/suspend" "POST" $at $null
  Check "suspend -> Suspended" ($sus.status -eq "Suspended")
  Check "usuario suspendido -> 403 en endpoints de licencia" ((ApiStatus "/metrics/summary" "GET" $tmpActive.accessToken) -eq 403)
  $rev = Api "/admin/users/$uid/license/revoke" "POST" $at $null
  Check "revoke -> Revoked" ($rev.status -eq "Revoked")
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
