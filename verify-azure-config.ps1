# Azure OpenAI Configuration Verification Script
# This script checks if your Azure OpenAI environment variables are properly configured

Write-Host "Azure OpenAI Configuration Verification" -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host ""

# Function to mask sensitive values
function Mask-Value {
    param([string]$value)
    if ([string]::IsNullOrEmpty($value)) {
        return "[NOT SET]"
    }
    if ($value.Length -le 8) {
        return "$($value.Substring(0, 2))..."
    }
    return "$($value.Substring(0, 8))..."
}

# Check system environment variables
Write-Host "System Environment Variables:" -ForegroundColor Yellow
Write-Host "-----------------------------" -ForegroundColor Yellow

$systemVars = @(
    "AZURE_OPENAI_API_KEY",
    "AZURE_OPENAI_ENDPOINT", 
    "AZURE_OPENAI_DEPLOYMENT_NAME"
)

$systemConfigured = $true
foreach ($var in $systemVars) {
    $value = [System.Environment]::GetEnvironmentVariable($var, 'User')
    if ([string]::IsNullOrEmpty($value)) {
        Write-Host "❌ ${var}: NOT SET" -ForegroundColor Red
        $systemConfigured = $false
    } else {
        if ($var -eq "AZURE_OPENAI_ENDPOINT" -or $var -eq "AZURE_OPENAI_DEPLOYMENT_NAME") {
            Write-Host "✅ ${var}: $value" -ForegroundColor Green
        } else {
            Write-Host "✅ ${var}: $(Mask-Value $value)" -ForegroundColor Green
        }
    }
}

Write-Host ""

# Check .env file configuration
Write-Host "Project .env File Configuration:" -ForegroundColor Yellow
Write-Host "--------------------------------" -ForegroundColor Yellow

$envFilePath = ".env"
if (Test-Path $envFilePath) {
    $envContent = Get-Content $envFilePath
    
    $projectVars = @(
        "EXPO_PUBLIC_AZURE_OPENAI_API_KEY",
        "EXPO_PUBLIC_AZURE_AI_ENDPOINT",
        "EXPO_PUBLIC_AZURE_OPENAI_DEPLOYMENT_NAME",
        "EXPO_PUBLIC_AZURE_AI_FOUNDRY_ENDPOINT",
        "EXPO_PUBLIC_AZURE_AI_SERVICES_ENDPOINT"
    )
    
    $projectConfigured = $true
    foreach ($var in $projectVars) {
        $line = $envContent | Where-Object { $_ -match "^$var=" }
        if ($line) {
            $value = ($line -split '=', 2)[1]
            if ([string]::IsNullOrEmpty($value) -or $value -eq "your_value_here" -or $value -match "REPLACE_WITH") {
                Write-Host "⚠️  ${var}: PLACEHOLDER VALUE" -ForegroundColor Yellow
                $projectConfigured = $false
            } else {
                if ($var -match "ENDPOINT" -or $var -match "DEPLOYMENT_NAME") {
                    Write-Host "✅ ${var}: $value" -ForegroundColor Green
                } else {
                    Write-Host "✅ ${var}: $(Mask-Value $value)" -ForegroundColor Green
                }
            }
        } else {
            Write-Host "❌ ${var}: NOT FOUND" -ForegroundColor Red
            $projectConfigured = $false
        }
    }
} else {
    Write-Host "❌ .env file not found" -ForegroundColor Red
    $projectConfigured = $false
}

Write-Host ""

# Summary
Write-Host "Configuration Summary:" -ForegroundColor Cyan
Write-Host "---------------------" -ForegroundColor Cyan

if ($systemConfigured) {
    Write-Host "✅ System environment variables: CONFIGURED" -ForegroundColor Green
} else {
    Write-Host "⚠️  System environment variables: INCOMPLETE" -ForegroundColor Yellow
    Write-Host "   Run setup-azure-env.ps1 to configure system variables" -ForegroundColor Gray
}

if ($projectConfigured) {
    Write-Host "✅ Project .env configuration: CONFIGURED" -ForegroundColor Green
    Write-Host "   Your app should work with Azure OpenAI" -ForegroundColor Gray
} else {
    Write-Host "❌ Project .env configuration: INCOMPLETE" -ForegroundColor Red
    Write-Host "   Update your .env file with actual Azure values" -ForegroundColor Gray
}

Write-Host ""

# Recommendations
Write-Host "Recommendations:" -ForegroundColor Cyan
Write-Host "---------------" -ForegroundColor Cyan

if (-not $systemConfigured -and $projectConfigured) {
    Write-Host "• Your project is ready to use Azure OpenAI" -ForegroundColor Green
    Write-Host "• System variables are optional for this project" -ForegroundColor Gray
    Write-Host "• Set system variables if you need them for other tools" -ForegroundColor Gray
}
elseif ($systemConfigured -and $projectConfigured) {
    Write-Host "• Everything is configured correctly!" -ForegroundColor Green
    Write-Host "• You can use Azure OpenAI in your project and other tools" -ForegroundColor Gray
}
else {
    Write-Host "• Update your configuration using the setup guide" -ForegroundColor Yellow
    Write-Host "• See AZURE_OPENAI_SETUP_GUIDE.md for detailed instructions" -ForegroundColor Gray
}

Write-Host ""
Write-Host "Press any key to exit..." -ForegroundColor Gray
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")