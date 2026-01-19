# PowerShell script to test Binance account trade history
# Usage: .\test_trades.ps1 [--symbol SYMBOL] [--asset ASSET] [--days DAYS] [--limit LIMIT]

param(
    [string]$symbol = "",
    [string]$asset = "",
    [int]$days = 30,
    [int]$limit = 1000,
    [switch]$export
)

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  BINANCE ACCOUNT TRADE HISTORY TEST" -ForegroundColor Cyan
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

if ($symbol) {
    $argsList += "--symbol"
    $argsList += $symbol
}

if ($asset) {
    $argsList += "--asset"
    $argsList += $asset
}

if ($days) {
    $argsList += "--days"
    $argsList += $days
}

if ($limit) {
    $argsList += "--limit"
    $argsList += $limit
}

if ($closedOnly) {
    $argsList += "--closed-only"
}

if ($export) {
    $argsList += "--export"
}

# Run the test script
Write-Host "Running trade history test..." -ForegroundColor Yellow
Write-Host ""

try {
    if ($argsList.Count -gt 0) {
        poetry run python test_binance_trades.py $argsList
    } else {
        poetry run python test_binance_trades.py
    }
    
    Write-Host ""
    Write-Host "✓ Test completed!" -ForegroundColor Green
} catch {
    Write-Host ""
    Write-Host "✗ Error running test: $_" -ForegroundColor Red
    exit 1
}
