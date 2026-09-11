<#
.SYNOPSIS
  Installs the pharmacy server as a Windows service via NSSM, so it survives
  a reboot without anyone having to open a terminal.

.USAGE
  # from apps/server, as Administrator:
  powershell -ExecutionPolicy Bypass -File .\scripts\install-service.ps1 -NssmPath C:\nssm\nssm.exe
#>
param(
    [Parameter(Mandatory = $true)]
    [string]$NssmPath,
    [string]$ServiceName = "PharmacyServer"
)

$ErrorActionPreference = "Stop"

# scripts/ -> apps/server — every path below is built from here, not from
# whatever directory the caller happened to be in.
$ServerDir = Split-Path -Parent $PSScriptRoot

if (-not (Test-Path $NssmPath)) {
    Write-Error "لم يُعثر على nssm.exe في: $NssmPath — نزّله من https://nssm.cc"
    exit 1
}

$EnvFile = Join-Path $ServerDir ".env"
if (-not (Test-Path $EnvFile)) {
    Write-Error "لم يُعثر على $EnvFile — انسخ .env.example إلى .env واملأه أولاً."
    exit 1
}

$EntryPoint = Join-Path $ServerDir "dist\src\index.js"
if (-not (Test-Path $EntryPoint)) {
    Write-Error "لم يُعثر على $EntryPoint — شغّل ``npm run build --workspace=@pharmacy/server`` أولاً."
    exit 1
}

$NodeExe = (Get-Command node -ErrorAction Stop).Source
$LogDir = Join-Path $ServerDir "logs"
New-Item -ItemType Directory -Force -Path $LogDir | Out-Null

Write-Output "تثبيت الخدمة '$ServiceName'..."
& $NssmPath install $ServiceName $NodeExe $EntryPoint

# The one setting this whole script exists for: without it the service runs
# from System32, dotenv can't find .env relative to that, and the server
# dies on every boot.
& $NssmPath set $ServiceName AppDirectory $ServerDir

& $NssmPath set $ServiceName Start SERVICE_AUTO_START
& $NssmPath set $ServiceName AppExit Default Restart
& $NssmPath set $ServiceName AppStdout (Join-Path $LogDir "service-out.log")
& $NssmPath set $ServiceName AppStderr (Join-Path $LogDir "service-err.log")
& $NssmPath set $ServiceName AppRotateFiles 1
& $NssmPath set $ServiceName AppRotateBytes 5242880

& $NssmPath start $ServiceName

Write-Output "`nتم. تحقّق بإعادة تشغيل الجهاز ثم فتح http://<ip-الخادم>:$($env:PORT ?? 3000)/api/health من جهاز آخر."
