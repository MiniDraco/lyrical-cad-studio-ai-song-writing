# Removes the LAN firewall rule added by firewall-open.ps1.
# Run from an ELEVATED PowerShell:  npm run firewall:close

$ErrorActionPreference = 'Stop'
$ruleName = 'Lyrical CAD Studio - Dev (TCP 4000)'

$isAdmin = ([Security.Principal.WindowsPrincipal] `
    [Security.Principal.WindowsIdentity]::GetCurrent() `
).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

if (-not $isAdmin) {
    Write-Host 'Run from an ELEVATED PowerShell.' -ForegroundColor Yellow
    exit 1
}

$existing = Get-NetFirewallRule -DisplayName $ruleName -ErrorAction SilentlyContinue
if ($existing) {
    $existing | Remove-NetFirewallRule
    Write-Host "Removed firewall rule '$ruleName'." -ForegroundColor Green
} else {
    Write-Host "No rule named '$ruleName' was present." -ForegroundColor Yellow
}
