<#
.SYNOPSIS
    Test Azure Logic App webhook endpoint

.DESCRIPTION
    This PowerShell script tests your Azure Logic App webhook by sending a test payload
    that mimics what Supabase would send when an order is inserted or updated.

.PARAMETER LogicAppUrl
    The complete Azure Logic App webhook URL

.PARAMETER TestType
    Type of test to run: INSERT, UPDATE, or DELETE

.EXAMPLE
    .\Test-Webhook.ps1 -LogicAppUrl "https://your-logic-app-url" -TestType "INSERT"
#>

param(
    [Parameter(Mandatory=$true)]
    [string]$LogicAppUrl,
    
    [Parameter(Mandatory=$false)]
    [ValidateSet("INSERT", "UPDATE", "DELETE")]
    [string]$TestType = "INSERT"
)

# Test payload that mimics Supabase webhook
$timestamp = Get-Date -Format "yyyy-MM-ddTHH:mm:ss.fffZ"
$orderId = "test-order-" + (Get-Date).Ticks

$testPayload = @{
    type = $TestType
    table = "orders"
    record = @{
        id = $orderId
        user_id = "test-user-123"
        retailer_id = "test-retailer-456"
        seller_id = "test-seller-789"
        status = "pending"
        total_amount = 125.50
        is_ai_order = $true
        created_at = $timestamp
        updated_at = $timestamp
    }
    old_record = if ($TestType -eq "UPDATE") { @{
        id = $orderId
        status = "confirmed"
        updated_at = (Get-Date).AddMinutes(-5).ToString("yyyy-MM-ddTHH:mm:ss.fffZ")
    } } else { $null }
    schema = "public"
}

# Convert to JSON
$jsonPayload = $testPayload | ConvertTo-Json -Depth 10

Write-Host "🚀 Testing Azure Logic App Webhook" -ForegroundColor Green
Write-Host "=" * 50 -ForegroundColor Gray
Write-Host "📍 URL: $LogicAppUrl" -ForegroundColor Cyan
Write-Host "📦 Test Type: $TestType" -ForegroundColor Cyan
Write-Host "📄 Payload:" -ForegroundColor Cyan
Write-Host $jsonPayload -ForegroundColor White
Write-Host ""

# Validate URL format
if (-not $LogicAppUrl.StartsWith("https://")) {
    Write-Error "❌ ERROR: Logic App URL must use HTTPS"
    exit 1
}

if (-not $LogicAppUrl.Contains("logic.azure.com")) {
    Write-Error "❌ ERROR: URL does not appear to be an Azure Logic App"
    exit 1
}

if (-not $LogicAppUrl.Contains("api-version=")) {
    Write-Warning "⚠️  WARNING: URL missing api-version parameter"
}

if (-not $LogicAppUrl.Contains("sig=")) {
    Write-Warning "⚠️  WARNING: URL missing signature parameter"
}

try {
    Write-Host "🧪 Sending test request..." -ForegroundColor Yellow
    
    # Create headers
    $headers = @{
        "Content-Type" = "application/json"
        "User-Agent" = "Supabase-Webhook-Test-PS/1.0"
    }
    
    # Send the request
    $response = Invoke-RestMethod -Uri $LogicAppUrl -Method POST -Body $jsonPayload -Headers $headers -TimeoutSec 30
    
    Write-Host "✅ SUCCESS: Request completed successfully!" -ForegroundColor Green
    Write-Host "📊 Response:" -ForegroundColor Cyan
    
    if ($response) {
        $response | ConvertTo-Json -Depth 10 | Write-Host -ForegroundColor White
    } else {
        Write-Host "(Empty response)" -ForegroundColor Gray
    }
    
    Write-Host ""
    Write-Host "🎉 Your Logic App webhook is working correctly!" -ForegroundColor Green
    
} catch {
    $statusCode = $_.Exception.Response.StatusCode.value__
    $statusDescription = $_.Exception.Response.StatusDescription
    
    Write-Host "❌ ERROR: Request failed" -ForegroundColor Red
    Write-Host "📊 Status Code: $statusCode - $statusDescription" -ForegroundColor Red
    Write-Host "📄 Error Details: $($_.Exception.Message)" -ForegroundColor Red
    
    # Provide troubleshooting tips based on status code
    Write-Host ""
    Write-Host "🔍 Troubleshooting Tips:" -ForegroundColor Yellow
    
    switch ($statusCode) {
        400 {
            Write-Host "• Check the JSON payload format" -ForegroundColor Yellow
            Write-Host "• Verify the Logic App's JSON schema" -ForegroundColor Yellow
            Write-Host "• Ensure all required fields are present" -ForegroundColor Yellow
        }
        401 {
            Write-Host "• Check if the Logic App requires authentication" -ForegroundColor Yellow
            Write-Host "• Verify the signature parameter in the URL" -ForegroundColor Yellow
        }
        404 {
            Write-Host "• Verify the Logic App URL is correct" -ForegroundColor Yellow
            Write-Host "• Check if the Logic App is deployed and running" -ForegroundColor Yellow
        }
        500 {
            Write-Host "• Check the Logic App's internal logic for errors" -ForegroundColor Yellow
            Write-Host "• Review the Logic App's run history in Azure Portal" -ForegroundColor Yellow
        }
        502 {
            Write-Host "• The Logic App may be temporarily unavailable" -ForegroundColor Yellow
            Write-Host "• Check Azure service status" -ForegroundColor Yellow
        }
        default {
            Write-Host "• Check the Logic App's run history in Azure Portal" -ForegroundColor Yellow
            Write-Host "• Verify the URL includes all required parameters" -ForegroundColor Yellow
            Write-Host "• Test with a simpler payload first" -ForegroundColor Yellow
        }
    }
    
    exit 1
}

Write-Host ""
Write-Host "📋 Next Steps:" -ForegroundColor Cyan
Write-Host "1. Configure this URL in your Supabase webhook" -ForegroundColor White
Write-Host "2. Test by inserting an order in Supabase" -ForegroundColor White
Write-Host "3. Monitor the Logic App run history" -ForegroundColor White
Write-Host "4. Check Supabase webhook logs" -ForegroundColor White