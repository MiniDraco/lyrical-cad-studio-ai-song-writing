# Opens TCP 4000 on the Private network profile so phones / other devices on
# the same Wi-Fi can reach the Next.js dev server.
#
# Run ONCE from an ELEVATED PowerShell:
#   npm run firewall:open
#
# Remove later with:
#   npm run firewall:close

$ErrorActionPreference = 'Stop'

$ruleName = 'Lyrical CAD Studio - Dev (TCP 4000)'
$port = 4000

$isAdmin = ([Security.Principal.WindowsPrincipal] `
    [Security.Principal.WindowsIdentity]::GetCurrent() `
).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

if (-not $isAdmin) {
    Write-Host ''
    Write-Host 'This needs to run from an ELEVATED PowerShell.' -ForegroundColor Yellow
    Write-Host 'Right-click PowerShell -> "Run as administrator", then re-run:' -ForegroundColor Yellow
    Write-Host '  npm run firewall:open'
    Write-Host ''
    exit 1
}

# Remove any prior copy so the script is idempotent.
Get-NetFirewallRule -DisplayName $ruleName -ErrorAction SilentlyContinue | Remove-NetFirewallRule

New-NetFirewallRule `
    -DisplayName $ruleName `
    -Direction Inbound `
    -Action Allow `
    -Protocol TCP `
    -LocalPort $port `
    -Profile Private `
    | Out-Null

Write-Host ''
Write-Host "Firewall rule added: '$ruleName' on TCP $port (Private profile)." -ForegroundColor Green
Write-Host 'Your Wi-Fi network profile must be set to "Private" for this to take effect.'
Write-Host ''
