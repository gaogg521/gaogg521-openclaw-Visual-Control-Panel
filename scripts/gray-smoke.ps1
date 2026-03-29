$ErrorActionPreference = "Stop"

$base = "http://127.0.0.1:3003"
$failed = 0

function Assert-Status {
  param(
    [string]$Name,
    [string]$Url,
    [string]$Method = "GET",
    [hashtable]$Headers = @{},
    [string]$Body = $null,
    [int]$Expected = 200
  )
  $code = -1
  $lastErr = ""
  for ($i = 0; $i -lt 3; $i++) {
    try {
      $params = @{
        Uri = $Url
        Method = $Method
        Headers = $Headers
        TimeoutSec = 20
      }
      if ($PSBoundParameters.ContainsKey("Body") -and $Body -ne $null -and $Body -ne "") {
        $params["Body"] = $Body
        $params["ContentType"] = "application/json"
      }
      $resp = Invoke-WebRequest @params -UseBasicParsing
      $code = [int]$resp.StatusCode
    } catch {
      if ($_.Exception.Response) {
        $code = [int]$_.Exception.Response.StatusCode
      } else {
        $code = -1
        $lastErr = $_.Exception.Message
      }
    }
    if ($code -eq $Expected) { break }
    if ($i -lt 2) { Start-Sleep -Seconds 1 }
  }

  if ($code -eq $Expected) {
    Write-Output ("[PASS] {0} => {1}" -f $Name, $code)
  } else {
    $script:failed += 1
    if ($lastErr) {
      Write-Output ("[FAIL] {0} => got {1}, expect {2}; err={3}" -f $Name, $code, $Expected, $lastErr)
    } else {
      Write-Output ("[FAIL] {0} => got {1}, expect {2}" -f $Name, $code, $Expected)
    }
  }
}

Write-Output "== Gray Smoke Start =="
Assert-Status -Name "dashboard-page" -Url "$base/oneone-dashboard" -Expected 200
Assert-Status -Name "config-local" -Url "$base/api/config" -Expected 200
Assert-Status -Name "config-blocked-host" -Url "$base/api/config" -Headers @{ Host = "evil.example" } -Expected 403
Assert-Status -Name "restart-blocked-host" -Url "$base/api/openclaw/restart" -Method POST -Headers @{ Host = "evil.example" } -Expected 403
Assert-Status -Name "doctor-blocked-host" -Url "$base/api/openclaw/doctor" -Method POST -Headers @{ Host = "evil.example" } -Expected 403
Assert-Status -Name "gateway-status-blocked-host" -Url "$base/api/openclaw/gateway-status" -Method POST -Headers @{ Host = "evil.example" } -Expected 403
Assert-Status -Name "test-agents-blocked-host" -Url "$base/api/test-agents" -Method POST -Headers @{ Host = "evil.example" } -Expected 403
Assert-Status -Name "setup-precheck-local" -Url "$base/api/setup/precheck" -Expected 200

$unsafeBody = '{"targetPath":"C:\\Windows\\System32"}'
Assert-Status -Name "open-path-block-unsafe" -Url "$base/api/setup/open-path" -Method POST -Body $unsafeBody -Expected 403

if ($failed -gt 0) {
  Write-Output ("== Gray Smoke Failed: {0} ==" -f $failed)
  exit 1
}

Write-Output "== Gray Smoke Passed =="
exit 0
