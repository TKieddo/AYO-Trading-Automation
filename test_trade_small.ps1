# Quick test trade script wrapper
Write-Host "=== Hyperliquid Trade Test ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "This script will:" -ForegroundColor Yellow
Write-Host "  1. Check your account balance" -ForegroundColor White
Write-Host "  2. Place a small test trade (~$1)" -ForegroundColor White
Write-Host "  3. Verify the position appears" -ForegroundColor White
Write-Host "  4. Show you how to view it on Hyperliquid" -ForegroundColor White
Write-Host ""
Write-Host "⚠️  Make sure you have:" -ForegroundColor Yellow
Write-Host "  • HYPERLIQUID_PRIVATE_KEY set in .env" -ForegroundColor White
Write-Host "  • At least $1-2 in your Hyperliquid account" -ForegroundColor White
Write-Host ""

$response = Read-Host "Continue? (yes/no)"
if ($response -ne "yes") {
    Write-Host "Cancelled." -ForegroundColor Yellow
    exit
}

Write-Host ""
Write-Host "Running test trade..." -ForegroundColor Green
Write-Host ""

poetry run python test_trade.py

