param([Parameter(Mandatory = $true)][string]$PgBin)
$ErrorActionPreference = 'Stop'
$taskRepo = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..'))
$taskBin = (Resolve-Path -LiteralPath $PgBin).Path
foreach ($taskProgram in @('initdb.exe', 'pg_ctl.exe', 'createdb.exe')) {
    if (-not (Test-Path -LiteralPath (Join-Path $taskBin $taskProgram))) { throw "Missing $taskProgram in the supplied PostgreSQL bin directory." }
}
$taskParent = [IO.Path]::GetFullPath((Join-Path $taskRepo '.review\adjustment7-native'))
$taskCluster = [IO.Path]::GetFullPath((Join-Path $taskParent ('cluster-' + [guid]::NewGuid().ToString('N'))))
if (-not $taskCluster.StartsWith($taskParent + [IO.Path]::DirectorySeparatorChar)) { throw 'Invalid scratch directory.' }
New-Item -ItemType Directory -Path $taskCluster | Out-Null
$taskListener = [Net.Sockets.TcpListener]::new([Net.IPAddress]::Loopback, 0)
$taskListener.Start()
$taskPort = $taskListener.LocalEndpoint.Port
$taskListener.Stop()
$taskDatabase = 'vertwell_adjustments_' + [guid]::NewGuid().ToString('N')
$taskPreviousUrl = $env:VERTWELL_ADJUSTMENTS_DATABASE_URL
$taskStarted = $false
$taskResult = 1
try {
    & (Join-Path $taskBin 'initdb.exe') -D $taskCluster -U postgres --auth-local=trust --auth-host=trust --encoding=UTF8 --no-locale
    if ($LASTEXITCODE -ne 0) { throw 'Could not initialize the isolated cluster.' }
    $taskStart = Start-Process -FilePath (Join-Path $taskBin 'pg_ctl.exe') -ArgumentList @('-D', ('"{0}"' -f $taskCluster), '-l', ('"{0}"' -f (Join-Path $taskCluster 'server.log')), '-o', ('"-h 127.0.0.1 -p {0}"' -f $taskPort), '-w', 'start') -WindowStyle Hidden -PassThru
    $taskStart.WaitForExit()
    if ($taskStart.ExitCode -ne 0) { throw 'Could not start the isolated cluster. Inspect its server.log.' }
    $taskStarted = $true
    & (Join-Path $taskBin 'createdb.exe') -h 127.0.0.1 -p $taskPort -U postgres $taskDatabase
    if ($LASTEXITCODE -ne 0) { throw 'Could not create the isolated database.' }
    $env:VERTWELL_ADJUSTMENTS_DATABASE_URL = "postgresql://postgres@127.0.0.1:$taskPort/$taskDatabase"
    Push-Location -LiteralPath $taskRepo
    try { node --import tsx backend/scripts/verify-adjustments-local.ts --confirm-disposable; $taskResult = $LASTEXITCODE }
    finally { Pop-Location }
} finally {
    $env:VERTWELL_ADJUSTMENTS_DATABASE_URL = $taskPreviousUrl
    if ($taskStarted) {
        $taskStop = Start-Process -FilePath (Join-Path $taskBin 'pg_ctl.exe') -ArgumentList @('-D', ('"{0}"' -f $taskCluster), '-m', 'fast', '-w', 'stop') -WindowStyle Hidden -PassThru
        $taskStop.WaitForExit()
        if ($taskStop.ExitCode -ne 0) { Write-Warning "Stop only this scratch cluster with pg_ctl: $taskCluster"; $taskResult = 1 }
    }
    Write-Output "Scratch cluster retained for inspection: $taskCluster"
}
exit $taskResult
