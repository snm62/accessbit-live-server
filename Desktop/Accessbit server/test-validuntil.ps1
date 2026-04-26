# Test customer-data-by-domain API to verify validUntil is returned after enrichment
# Usage: .\test-validuntil.ps1 [domain]
# Example: .\test-validuntil.ps1 team-snm.com
# Uses .NET WebClient to avoid PowerShell Invoke-WebRequest security prompt.

param(
    [string]$Domain = "team-snm.com",
    [string]$BaseUrl = "https://app.accessbit.io"
)

$url = "$BaseUrl/api/stripe/customer-data-by-domain?domain=$([uri]::EscapeDataString($Domain))&_t=$([DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds())"
Write-Host "GET $url" -ForegroundColor Cyan
Write-Host ""

try {
    $wc = New-Object System.Net.WebClient
    $wc.Headers.Add("User-Agent", "Test-validUntil/1.0")
    $rawJson = $wc.DownloadString($url)
    $response = $rawJson | ConvertFrom-Json
    $json = $response | ConvertTo-Json -Depth 10
    Write-Host "Response:" -ForegroundColor Green
    Write-Host $json
    Write-Host ""
    if ($response.validUntil) {
        Write-Host "validUntil: $($response.validUntil)" -ForegroundColor Green
        Write-Host "OK - Worker is returning validUntil." -ForegroundColor Green
    } else {
        Write-Host "validUntil: (empty or missing)" -ForegroundColor Yellow
        Write-Host "Check: Stripe subscription fetch may have failed, or subscription has no current_period_end." -ForegroundColor Yellow
    }
} catch {
    Write-Host "Error: $_" -ForegroundColor Red
    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $reader.BaseStream.Position = 0
        Write-Host $reader.ReadToEnd()
    }
}
