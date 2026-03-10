#!/usr/bin/env pwsh
<#
.SYNOPSIS
Start development servers for SALFANET RADIUS (Backend + Mobile)

.DESCRIPTION
Starts both Next.js backend dev server and Expo mobile dev server in parallel.
Automatically kills existing processes if they're already running.

.EXAMPLE
.\start-dev.ps1

.NOTES
- Backend will run on http://localhost:3000
- Expo will run on http://localhost:8081
- Press Ctrl+C to stop all servers
#>

param(
    [switch]$KillIfRunning = $false,
    [switch]$BackendOnly = $false,
    [switch]$MobileOnly = $false,
    [switch]$NoKill = $false
)

$ErrorActionPreference = "Continue"

Write-Host "======================================" -ForegroundColor Cyan
Write-Host "SALFANET RADIUS - Development Server" -ForegroundColor Cyan
Write-Host "======================================" -ForegroundColor Cyan
Write-Host ""

# Determine backend and mobile root paths
$scriptPath = $MyInvocation.MyCommandPath
if (-not $scriptPath) {
    $scriptPath = $PSCommandPath
}
if (-not $scriptPath) {
    $backendRoot = "c:\Users\yanz\Downloads\salfanet-radius-main"
} else {
    $backendRoot = Split-Path -Parent $scriptPath
    if ((Split-Path -Leaf $backendRoot) -ne "salfanet-radius-main") {
        $backendRoot = "c:\Users\yanz\Downloads\salfanet-radius-main"
    }
}
$mobileRoot = "C:\m"

Write-Host "Backend: $backendRoot" -ForegroundColor Green
Write-Host "Mobile:  $mobileRoot" -ForegroundColor Green
Write-Host ""

# Function to kill port
function Stop-Port {
    param(
        [int]$Port
    )
    
    try {
        $connection = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue | Select-Object -First 1
        
        if ($connection) {
            $process = Get-Process -Id $connection.OwningProcess -ErrorAction SilentlyContinue
            
            if ($process) {
                Write-Host "Killing process on port $Port : $($process.ProcessName) (PID: $($process.Id))" -ForegroundColor Yellow
                Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue
                Start-Sleep -Milliseconds 500
                Write-Host "[OK] Port $Port is now free" -ForegroundColor Green
            }
        }
    }
    catch {
        # Port is free, ignore error
    }
}

# Kill ports if requested
if (-not $NoKill) {
    Write-Host "Checking ports..." -ForegroundColor Yellow
    
    if (-not $MobileOnly) {
        Write-Host "  > Port 3000 (Backend Next.js)..." -ForegroundColor Gray
        Stop-Port -Port 3000
    }
    
    if (-not $BackendOnly) {
        Write-Host "  > Port 8081 (Expo)..." -ForegroundColor Gray
        Stop-Port -Port 8081
        Write-Host "  > Port 19000 (Expo Metro)..." -ForegroundColor Gray
        Stop-Port -Port 19000
        Write-Host "  > Port 19001 (Expo)..." -ForegroundColor Gray
        Stop-Port -Port 19001
    }
    
    Write-Host ""
}

# Create jobs array
$jobs = @()

# Start backend if not mobile-only
if (-not $MobileOnly) {
    Write-Host "Starting Backend (Next.js Dev Server)..." -ForegroundColor Cyan
    $backendJob = Start-Job -ScriptBlock {
        param($root)
        Set-Location $root
        Write-Host "[Backend] Starting..." -ForegroundColor Blue
        npm run dev
    } -ArgumentList $backendRoot -Name "backend-dev"
    
    $jobs += $backendJob
    Write-Host "[OK] Backend job started (PID: $($backendJob.Id))" -ForegroundColor Green
    Write-Host "     Starting Next.js on port 3000..." -ForegroundColor Gray
    Write-Host ""
}

# Start mobile if not backend-only
if (-not $BackendOnly) {
    Write-Host "Starting Mobile (Expo Dev Server)..." -ForegroundColor Cyan
    $mobileJob = Start-Job -ScriptBlock {
        param($root)
        Set-Location $root
        Write-Host "[Mobile] Starting..." -ForegroundColor Blue
        `$env:EXPO_PUBLIC_API_URL = "http://192.168.1.6:3000"
        npx expo start
    } -ArgumentList $mobileRoot -Name "mobile-dev"
    
    $jobs += $mobileJob
    Write-Host "[OK] Mobile job started (PID: $($mobileJob.Id))" -ForegroundColor Green
    Write-Host "     Starting Expo on port 8081..." -ForegroundColor Gray
    Write-Host ""
}

Write-Host "======================================" -ForegroundColor Cyan
Write-Host "All servers running!" -ForegroundColor Green
Write-Host "======================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Backend:  http://localhost:3000" -ForegroundColor Cyan
Write-Host "Mobile:   http://localhost:8081" -ForegroundColor Cyan
Write-Host ""
Write-Host "Press Ctrl+C to stop all servers..." -ForegroundColor Yellow
Write-Host ""

# Wait for jobs
if ($jobs.Count -gt 0) {
    $jobs | Wait-Job | Out-Null
}

# Cleanup
Write-Host ""
Write-Host "Stopping all servers..." -ForegroundColor Yellow
if ($jobs.Count -gt 0) {
    $jobs | Stop-Job -PassThru | Remove-Job -Force
}

Write-Host "[OK] All servers stopped" -ForegroundColor Green
