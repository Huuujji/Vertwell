param([Parameter(Mandatory = $true)][string]$PgBin)
$ErrorActionPreference = 'Stop'
$taskRepo = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..'))
$taskBin = (Resolve-Path -LiteralPath $PgBin).Path
foreach ($taskProgram in @('initdb.exe', 'pg_ctl.exe', 'createdb.exe')) {
    if (-not (Test-Path -LiteralPath (Join-Path $taskBin $taskProgram))) { throw "Missing $taskProgram in the supplied PostgreSQL bin directory." }
}
$taskParent = [IO.Path]::GetFullPath((Join-Path $taskRepo '.review\task-4-performance'))
$taskRun = [IO.Path]::GetFullPath((Join-Path $taskParent ('run-' + [guid]::NewGuid().ToString('N'))))
if (-not $taskRun.StartsWith($taskParent + [IO.Path]::DirectorySeparatorChar)) { throw 'Invalid scratch directory.' }
New-Item -ItemType Directory -Path $taskRun | Out-Null
$taskCluster = Join-Path $taskRun 'cluster'
New-Item -ItemType Directory -Path $taskCluster | Out-Null
$taskListener = [Net.Sockets.TcpListener]::new([Net.IPAddress]::Loopback, 0)
$taskListener.Start(); $taskPort = $taskListener.LocalEndpoint.Port; $taskListener.Stop()
$taskDatabase = 'vertwell_mixed_' + [guid]::NewGuid().ToString('N')
$taskPreviousUrl = $env:VERTWELL_MIXED_DATABASE_URL
$taskPreviousOutput = $env:VERTWELL_MIXED_OUTPUT
$taskStarted = $false; $taskResult = 1
try {
    & (Join-Path $taskBin 'initdb.exe') -D $taskCluster -U postgres --auth-local=trust --auth-host=trust --encoding=UTF8 --no-locale
    if ($LASTEXITCODE -ne 0) { throw 'Could not initialize the isolated cluster.' }
    $taskStart = Start-Process -FilePath (Join-Path $taskBin 'pg_ctl.exe') -ArgumentList @('-D', ('"{0}"' -f $taskCluster), '-l', ('"{0}"' -f (Join-Path $taskCluster 'server.log')), '-o', ('"-h 127.0.0.1 -p {0} -c track_functions=all"' -f $taskPort), '-w', 'start') -WindowStyle Hidden -PassThru
    $taskStart.WaitForExit()
    if ($taskStart.ExitCode -ne 0) { throw 'Could not start the isolated cluster. Inspect its server.log.' }
    $taskStarted = $true
    & (Join-Path $taskBin 'createdb.exe') -h 127.0.0.1 -p $taskPort -U postgres $taskDatabase
    if ($LASTEXITCODE -ne 0) { throw 'Could not create the isolated database.' }
    $env:VERTWELL_MIXED_DATABASE_URL = "postgresql://postgres@127.0.0.1:$taskPort/$taskDatabase"
    $env:VERTWELL_MIXED_OUTPUT = $taskRun
    Push-Location -LiteralPath $taskRepo
    try { npm run profile:mixed --workspace backend -- --confirm-disposable; $taskResult = $LASTEXITCODE }
    finally { Pop-Location }
} finally {
    $env:VERTWELL_MIXED_DATABASE_URL = $taskPreviousUrl; $env:VERTWELL_MIXED_OUTPUT = $taskPreviousOutput
    if ($taskStarted) {
        $taskStop = Start-Process -FilePath (Join-Path $taskBin 'pg_ctl.exe') -ArgumentList @('-D', ('"{0}"' -f $taskCluster), '-m', 'fast', '-w', 'stop') -WindowStyle Hidden -PassThru
        $taskStop.WaitForExit()
        if ($taskStop.ExitCode -ne 0) { Write-Warning "Stop only this scratch cluster with pg_ctl: $taskCluster"; $taskResult = 1 }
    }
    Write-Output "Task 4 evidence and stopped scratch cluster: $taskRun"
}
exit $taskResult
