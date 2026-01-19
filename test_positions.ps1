# PowerShell script to test Binance position retrieval
# Usage: .\test_positions.ps1 [--all] [--symbol SYMBOL] [--asset ASSET]

param(
    [switch]$all,
    [string]$symbol = "",
    [string]$asset = "",
    [switch]$position
)

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  BINANCE POSITION RETRIEVAL TEST" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check if Python is available
try {
    $pythonVersion = python --version 2>&1
    Write-Host "✓ Python found: $pythonVersion" -ForegroundColor Green
} catch {
    Write-Host "✗ Python not found. Please install Python first." -ForegroundColor Red
    exit 1
}

# Build command arguments
$argsList = @()

if ($all) {
    $argsList += "--all"
} elseif ($position -or $symbol -or $asset) {
    if ($position) {
        $argsList += "--position"
    }
    if ($symbol) {
        $argsList += "--symbol"
        $argsList += $symbol
    }
    if ($asset) {
        $argsList += "--asset"
        $argsList += $asset
    }
}

# Run the test script
Write-Host "Running test script..." -ForegroundColor Yellow
Write-Host ""

try {
    if ($argsList.Count -gt 0) {
        poetry run python test_binance_positions.py $argsList
    } else {
        poetry run python test_binance_positions.py
    }
    
    Write-Host ""
    Write-Host "✓ Test completed!" -ForegroundColor Green
} catch {
    Write-Host ""
    Write-Host "✗ Error running test: $_" -ForegroundColor Red
    exit 1
}
