# Azure OpenAI Environment Variables Setup Script
# This script sets up the required Azure OpenAI environment variables

# Instructions:
# 1. Replace the placeholder values below with your actual Azure OpenAI credentials
# 2. Run this script in PowerShell as Administrator
# 3. Restart your development environment after running this script

Write-Host "Setting up Azure OpenAI Environment Variables..." -ForegroundColor Green

# Replace these values with your actual Azure OpenAI credentials:
# ENDPOINT: Found in Keys & Endpoint section of your Azure portal resource
# Example: https://docs-test-001.openai.azure.com/
$AZURE_OPENAI_ENDPOINT = "REPLACE_WITH_YOUR_ENDPOINT_HERE"

# API-KEY: Found in Keys & Endpoint section of your Azure portal resource
# You can use either KEY1 or KEY2
$AZURE_OPENAI_API_KEY = "REPLACE_WITH_YOUR_KEY_VALUE_HERE"

# DEPLOYMENT-NAME: Custom name you chose when deploying your model
# Found under Resource Management > Deployments in Azure portal
$AZURE_OPENAI_DEPLOYMENT_NAME = "REPLACE_WITH_YOUR_DEPLOYMENT_NAME_HERE"

# Set environment variables for current user
try {
    [System.Environment]::SetEnvironmentVariable('AZURE_OPENAI_API_KEY', $AZURE_OPENAI_API_KEY, 'User')
    Write-Host "✓ AZURE_OPENAI_API_KEY set successfully" -ForegroundColor Green
    
    [System.Environment]::SetEnvironmentVariable('AZURE_OPENAI_ENDPOINT', $AZURE_OPENAI_ENDPOINT, 'User')
    Write-Host "✓ AZURE_OPENAI_ENDPOINT set successfully" -ForegroundColor Green
    
    [System.Environment]::SetEnvironmentVariable('AZURE_OPENAI_DEPLOYMENT_NAME', $AZURE_OPENAI_DEPLOYMENT_NAME, 'User')
    Write-Host "✓ AZURE_OPENAI_DEPLOYMENT_NAME set successfully" -ForegroundColor Green
    
    Write-Host "`nEnvironment variables have been set successfully!" -ForegroundColor Green
    Write-Host "Please restart your development environment (VS Code, terminals, etc.) to use the new variables." -ForegroundColor Yellow
    
    # Display current values (masked for security)
    Write-Host "`nCurrent Environment Variables:" -ForegroundColor Cyan
    Write-Host "AZURE_OPENAI_ENDPOINT: $($AZURE_OPENAI_ENDPOINT.Substring(0, [Math]::Min(30, $AZURE_OPENAI_ENDPOINT.Length)))..." -ForegroundColor White
    Write-Host "AZURE_OPENAI_API_KEY: $($AZURE_OPENAI_API_KEY.Substring(0, [Math]::Min(8, $AZURE_OPENAI_API_KEY.Length)))..." -ForegroundColor White
    Write-Host "AZURE_OPENAI_DEPLOYMENT_NAME: $AZURE_OPENAI_DEPLOYMENT_NAME" -ForegroundColor White
    
} catch {
    Write-Host "Error setting environment variables: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "Please run this script as Administrator" -ForegroundColor Yellow
}

# Optional: Also update the .env file for your project
$envFilePath = ".env"
if (Test-Path $envFilePath) {
    Write-Host "`nWould you like to update the .env file as well? (y/n): " -ForegroundColor Yellow -NoNewline
    $updateEnv = Read-Host
    
    if ($updateEnv -eq 'y' -or $updateEnv -eq 'Y') {
        try {
            # Read current .env content
            $envContent = Get-Content $envFilePath
            
            # Update or add Azure OpenAI variables
            $envContent = $envContent | ForEach-Object {
                if ($_ -match '^EXPO_PUBLIC_AZURE_OPENAI_API_KEY=') {
                    "EXPO_PUBLIC_AZURE_OPENAI_API_KEY=$AZURE_OPENAI_API_KEY"
                } elseif ($_ -match '^EXPO_PUBLIC_AZURE_AI_ENDPOINT=') {
                    "EXPO_PUBLIC_AZURE_AI_ENDPOINT=$AZURE_OPENAI_ENDPOINT"
                } elseif ($_ -match '^EXPO_PUBLIC_AZURE_OPENAI_DEPLOYMENT_NAME=') {
                    "EXPO_PUBLIC_AZURE_OPENAI_DEPLOYMENT_NAME=$AZURE_OPENAI_DEPLOYMENT_NAME"
                } else {
                    $_
                }
            }
            
            # Write back to .env file
            $envContent | Set-Content $envFilePath
            Write-Host "✓ .env file updated successfully" -ForegroundColor Green
            
        } catch {
            Write-Host "Error updating .env file: $($_.Exception.Message)" -ForegroundColor Red
        }
    }
}

Write-Host "`nSetup complete! Remember to:" -ForegroundColor Cyan
Write-Host "1. Replace placeholder values with your actual credentials" -ForegroundColor White
Write-Host "2. Restart your development environment" -ForegroundColor White
Write-Host "3. Test your Azure OpenAI integration" -ForegroundColor White

Pause