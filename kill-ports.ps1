#!/usr/bin/env pwsh
<#
.SYNOPSIS
Kill ports used by SALFANET RADIUS development servers

.DESCRIPTION
Kills processes running on ports commonly used by development servers:
- 3000 (Next.js Backend)
- 8081 (Expo Dev Server)
- 19000, 19001 (Expo Metro)

.EXAMPLE
.\kill-ports.ps1

.EXAMPLE
Kill specific port:
.\kill-ports.ps1 -Port 3000

.NOTES
Useful when servers crash or hang and ports remain locked.
#>

param(
    [int[]]$Port = @(3000, 8081, 19000, 19001),
    [switch]$Verbose = $false
)

$ErrorActionPreference = "Continue"

Write-Host "======================================" -ForegroundColor Cyan
Write-Host "Killing Development Server Ports" -ForegroundColor Cyan
Write-Host "======================================" -ForegroundColor Cyan
Write-Host ""

# Port descriptions
$portDescriptions = @{
    3000 = "Next.js Backend"
    8081 = "Expo Dev Server"
    19000 = "Expo Metro"
    19001 = "Expo"
}

$killedCount = 0
$freeCount = 0

foreach ($p in $Port) {
    if ($portDescriptions.ContainsKey($p)) {
        $desc = $portDescriptions[$p]
    } else {
        $desc = "Application"
    }
    
    try {
        $connection = Get-NetTCPConnection -LocalPort $p -ErrorAction SilentlyContinue | Select-Object -First 1
        
        if ($connection) {
            $process = Get-Process -Id $connection.OwningProcess -ErrorAction SilentlyContinue
            
            if ($process) {
                Write-Host "Port $p ($desc)" -ForegroundColor Yellow -NoNewline
                Write-Host " - Killing $($process.ProcessName) (PID: $($process.Id))" -ForegroundColor Gray
                
                Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue
                Start-Sleep -Milliseconds 300
                
                # Verify it's killed
                $stillRunning = Get-Process -Id $process.Id -ErrorAction SilentlyContinue
                if (-not $stillRunning) {
                    Write-Host "  OK - Successfully killed" -ForegroundColor Green
                    $killedCount++
                } else {
                    Write-Host "  FAILED - Could not kill" -ForegroundColor Red
                }
            }
        } else {
            if ($Verbose) {
                Write-Host "Port $p ($desc)" -ForegroundColor Gray -NoNewline
                Write-Host " - Already free" -ForegroundColor Green
            }
            $freeCount++
        }
    } catch {
        if ($Verbose) {
            Write-Host "Port $p ($desc)" -ForegroundColor Red -NoNewline
            Write-Host " - Error checking port" -ForegroundColor Red
        }
    }
}

Write-Host ""
Write-Host "======================================" -ForegroundColor Cyan
Write-Host "Results:" -ForegroundColor Cyan
Write-Host "  Killed:  $killedCount" -ForegroundColor Green
Write-Host "  Already Free: $freeCount" -ForegroundColor Green
Write-Host "======================================" -ForegroundColor Cyan

if ($killedCount -gt 0) {
    Write-Host ""
    Write-Host "Done - You can now start development servers again" -ForegroundColor Green
}
