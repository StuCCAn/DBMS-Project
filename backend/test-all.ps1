param(
    [string]$AdminEmail = $(if ($env:CUECLUB_ADMIN_EMAIL) { $env:CUECLUB_ADMIN_EMAIL } else { "rohan@example.com" }),
    [string]$AdminPassword = $(if ($env:CUECLUB_ADMIN_PASSWORD) { $env:CUECLUB_ADMIN_PASSWORD } else { "cueclub_default" }),
    [string]$MemberEmail = $(if ($env:CUECLUB_MEMBER_EMAIL) { $env:CUECLUB_MEMBER_EMAIL } else { "aarav@example.com" }),
    [string]$MemberPassword = $(if ($env:CUECLUB_MEMBER_PASSWORD) { $env:CUECLUB_MEMBER_PASSWORD } else { "cueclub_default" })
)

$base = "http://localhost:3000"
$passed = 0
$failed = 0

function Invoke-ApiRequest {
    param(
        [string]$Method,
        [string]$Url,
        [hashtable]$Headers = @{},
        [string]$Body = $null
    )

    try {
        $params = @{
            Method          = $Method
            Uri             = $Url
            ErrorAction     = "Stop"
            UseBasicParsing = $true
        }
        if ($Headers.Count -gt 0) { $params.Headers = $Headers }
        if ($null -ne $Body -and $Method -ne "GET") {
            $params.ContentType = "application/json"
            $params.Body = $Body
        }

        $response = Invoke-WebRequest @params
        return @{ Code = [int]$response.StatusCode; Content = $response.Content }
    }
    catch {
        if ($_.Exception.Response) {
            return @{ Code = [int]$_.Exception.Response.StatusCode; Content = "" }
        }
        return @{ Code = -1; Content = $_.Exception.Message }
    }
}

function Test-Endpoint {
    param(
        [string]$Name,
        [string]$Method,
        [string]$Url,
        [hashtable]$Headers = @{},
        [string]$Body = $null,
        [int[]]$Expected = @(200)
    )

    $res = Invoke-ApiRequest -Method $Method -Url $Url -Headers $Headers -Body $Body
    if ($res.Code -eq -1) {
        Write-Host "FAIL  $Name  [NO RESPONSE]"
        Write-Host "      $($res.Content)"
        $script:failed++
        return
    }

    if ($Expected -contains $res.Code) {
        Write-Host "PASS  $Name  [$($res.Code)]"
        $script:passed++
    }
    else {
        Write-Host "FAIL  $Name  [$($res.Code)] (Expected: $($Expected -join ', '))"
        $script:failed++
    }
}

Write-Host ""
Write-Host "===== CUECLUB BACKEND TEST ====="
Write-Host ""

# 1. Public & Unauthenticated Guard Checks
Test-Endpoint -Name "Health" -Method "GET" -Url "$base/api/health" -Expected @(200)
Test-Endpoint -Name "Login without credentials" -Method "POST" -Url "$base/api/auth/login" -Body '{"email":"","password":""}' -Expected @(400)
Test-Endpoint -Name "Me without authentication" -Method "GET" -Url "$base/api/auth/me" -Expected @(401)
Test-Endpoint -Name "Tables without authentication" -Method "GET" -Url "$base/api/tables" -Expected @(401)
Test-Endpoint -Name "Reservations without authentication" -Method "GET" -Url "$base/api/reservations" -Expected @(401)
Test-Endpoint -Name "Member balance without authentication" -Method "GET" -Url "$base/api/members/1/balance" -Expected @(401)
Test-Endpoint -Name "Register member without authentication" -Method "POST" -Url "$base/api/members" -Body '{"name":"Test"}' -Expected @(401)
Test-Endpoint -Name "Register casual without authentication" -Method "POST" -Url "$base/api/casuals" -Body '{"name":"Test"}' -Expected @(401)
Test-Endpoint -Name "Leaderboard without authentication" -Method "GET" -Url "$base/api/leaderboard" -Expected @(401)
Test-Endpoint -Name "Tournaments without authentication" -Method "GET" -Url "$base/api/tournaments" -Expected @(401)
Test-Endpoint -Name "Create match without authentication" -Method "POST" -Url "$base/api/tournaments/1/matches" -Body '{"roundNumber":1}' -Expected @(401)
Test-Endpoint -Name "Inventory without authentication" -Method "GET" -Url "$base/api/inventory" -Expected @(401)
Test-Endpoint -Name "Coaching assessment without authentication" -Method "POST" -Url "$base/api/coaching/assessments" -Body '{"playerId":1}' -Expected @(401)
Test-Endpoint -Name "Password route without authentication" -Method "PUT" -Url "$base/api/users/1/password" -Body '{"newPassword":"test123"}' -Expected @(401)
Test-Endpoint -Name "Deactivate user without authentication" -Method "PATCH" -Url "$base/api/users/999/deactivate" -Expected @(401)
Test-Endpoint -Name "Match completion without authentication" -Method "POST" -Url "$base/api/matches/999999/complete" -Body '{"frames":[],"winPoints":1,"lossPoints":0}' -Expected @(401)
Test-Endpoint -Name "Inventory stock without authentication" -Method "PATCH" -Url "$base/api/inventory/1/stock" -Body '{"delta":1}' -Expected @(401)
Test-Endpoint -Name "Inventory condition without authentication" -Method "PATCH" -Url "$base/api/inventory/1/condition" -Body '{"status":"Good"}' -Expected @(401)

# 2. Authenticated Role & View/Procedure Checks (run when credentials are supplied)
if ($AdminEmail -and $AdminPassword) {
    Write-Host ""
    Write-Host "--- Authenticated Admin Checks ---"
    $loginRes = Invoke-ApiRequest -Method "POST" -Url "$base/api/auth/login" -Body (@{ email = $AdminEmail; password = $AdminPassword } | ConvertTo-Json)
    if ($loginRes.Code -eq 200) {
        $loginJson = $loginRes.Content | ConvertFrom-Json
        $adminHeaders = @{ Authorization = "Bearer $($loginJson.token)" }
        $adminId = $loginJson.user.user_id

        Test-Endpoint -Name "Admin /me" -Method "GET" -Url "$base/api/auth/me" -Headers $adminHeaders -Expected @(200)
        Test-Endpoint -Name "Admin /tables" -Method "GET" -Url "$base/api/tables" -Headers $adminHeaders -Expected @(200)
        Test-Endpoint -Name "Admin /leaderboard" -Method "GET" -Url "$base/api/leaderboard" -Headers $adminHeaders -Expected @(200)
        Test-Endpoint -Name "Admin /tournaments" -Method "GET" -Url "$base/api/tournaments" -Headers $adminHeaders -Expected @(200)
        Test-Endpoint -Name "Admin /inventory" -Method "GET" -Url "$base/api/inventory" -Headers $adminHeaders -Expected @(200)
        Test-Endpoint -Name "Admin /reports/win-streaks" -Method "GET" -Url "$base/api/reports/win-streaks" -Headers $adminHeaders -Expected @(200)
        Test-Endpoint -Name "Admin /reports/head-to-head" -Method "GET" -Url "$base/api/reports/head-to-head" -Headers $adminHeaders -Expected @(200)
        Test-Endpoint -Name "Admin /reports/table-utilisation" -Method "GET" -Url "$base/api/reports/table-utilisation" -Headers $adminHeaders -Expected @(200)
        Test-Endpoint -Name "Admin /admin/diagnostics" -Method "GET" -Url "$base/api/admin/diagnostics" -Headers $adminHeaders -Expected @(200)
        Test-Endpoint -Name "Admin self-deactivate blocked (400)" -Method "PATCH" -Url "$base/api/users/$adminId/deactivate" -Headers $adminHeaders -Expected @(400)
        Test-Endpoint -Name "Admin invalid tournament match rejected (404)" -Method "POST" -Url "$base/api/tournaments/999999/matches" -Headers $adminHeaders -Body '{"roundNumber":1}' -Expected @(404)
    }
    else {
        Write-Host "FAIL  Admin login [$($loginRes.Code)]"
        $script:failed++
    }
}

if ($MemberEmail -and $MemberPassword) {
    Write-Host ""
    Write-Host "--- Authenticated Member RBAC Checks ---"
    $mLoginRes = Invoke-ApiRequest -Method "POST" -Url "$base/api/auth/login" -Body (@{ email = $MemberEmail; password = $MemberPassword } | ConvertTo-Json)
    if ($mLoginRes.Code -eq 200) {
        $mLoginJson = $mLoginRes.Content | ConvertFrom-Json
        $memberHeaders = @{ Authorization = "Bearer $($mLoginJson.token)" }
        $memberId = $mLoginJson.user.user_id

        Test-Endpoint -Name "Member own balance (200)" -Method "GET" -Url "$base/api/members/$memberId/balance" -Headers $memberHeaders -Expected @(200)
        Test-Endpoint -Name "Member inventory forbidden (403)" -Method "GET" -Url "$base/api/inventory" -Headers $memberHeaders -Expected @(403)
        Test-Endpoint -Name "Member diagnostics forbidden (403)" -Method "GET" -Url "$base/api/admin/diagnostics" -Headers $memberHeaders -Expected @(403)
        Test-Endpoint -Name "Member register member forbidden (403)" -Method "POST" -Url "$base/api/members" -Headers $memberHeaders -Body '{"name":"X"}' -Expected @(403)
    }
    else {
        Write-Host "FAIL  Member login [$($mLoginRes.Code)]"
        $script:failed++
    }
}

Write-Host ""
Write-Host "===== RESULT ====="
Write-Host "PASSED: $passed"
Write-Host "FAILED: $failed"
Write-Host "TOTAL : $($passed + $failed)"
Write-Host ""

if ($failed -eq 0) {
    Write-Host "ALL TESTS PASSED"
}
else {
    Write-Host "SOME TESTS FAILED"
}