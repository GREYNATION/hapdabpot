Write-Host "🤖 Hermes: Initializing Vault Connection..." -ForegroundColor Cyan

# Ensure we are in the correct directory (optional, but good for stability)
$ScriptDir = Split-Path $MyInvocation.MyCommand.Path
Set-Location $ScriptDir

# Run the initialization and pipeline via our sync script
# We use npx tsx to handle the TypeScript execution directly
npx tsx scripts/sync_vault.ts

Write-Host "✅ Vault Updated. Open Obsidian to see your leads." -ForegroundColor Green
