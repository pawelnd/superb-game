param(
    [switch]$RecreateVenv
)

$ErrorActionPreference = 'Stop'

function Write-Step {
    param([string]$Message)
    Write-Host "[setup] $Message" -ForegroundColor Cyan
}

function Get-PythonExecutable {
    param([string]$VenvPath)
    if ($IsWindows) {
        return Join-Path $VenvPath 'Scripts/python.exe'
    }
    return Join-Path $VenvPath 'bin/python'
}

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
if (-not $root) {
    $root = Get-Location
}

$backendDir = Join-Path $root 'backend'
$frontendDir = Join-Path $root 'frontend'
$venvPath = Join-Path $backendDir '.venv'
$requirementsPath = Join-Path $backendDir 'requirements.txt'

if (-not (Test-Path $backendDir) -or -not (Test-Path $frontendDir)) {
    throw 'Run this script from the repository root.'
}

if ($RecreateVenv -and (Test-Path $venvPath)) {
    Write-Step "Removing existing virtual environment at $venvPath"
    Remove-Item $venvPath -Recurse -Force
}

if (-not (Test-Path $venvPath)) {
    Write-Step "Creating virtual environment in backend/.venv"
    python -m venv $venvPath
}

$venvPython = Get-PythonExecutable -VenvPath $venvPath
if (-not (Test-Path $venvPython)) {
    throw "Virtual environment python executable not found at $venvPython"
}

Write-Step "Upgrading pip"
& $venvPython -m pip install --upgrade pip > $null

if (-not (Test-Path $requirementsPath)) {
    throw "Requirements file not found at $requirementsPath"
}

Write-Step "Installing backend dependencies"
& $venvPython -m pip install -r $requirementsPath

Write-Step "Installing frontend dependencies"
Push-Location $frontendDir
try {
    npm install
}
finally {
    Pop-Location
}

Write-Step "All dependencies installed"