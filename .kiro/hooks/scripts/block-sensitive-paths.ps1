# PreToolUse guard: block agent tool calls that touch real patient data or secrets (R47.1, R47.4).
# Reads the hook JSON from stdin, inspects only path-like / command fields (not file content),
# exits 2 to block. Paths containing "synthetic" are allowed (synthetic fixtures).
$ErrorActionPreference = 'Stop'

$raw = [Console]::In.ReadToEnd()
if ([string]::IsNullOrWhiteSpace($raw)) { exit 0 }
try { $payload = $raw | ConvertFrom-Json -Depth 64 } catch { exit 0 }

# Field names worth inspecting; content fields (text, newStr, oldStr, prompt) are ignored on purpose.
$keyPattern = '(?i)(path|file|command|cwd|directory|pattern)'
$skipKeyPattern = '(?i)^exclude'

$sensitive = @(
    '(?i)\.xlsx?\b',                                  # Excel workbooks (real seed data)
    '(?i)MDR-2026',                                   # name of the real seed workbook
    '(?i)(^|[\\/\s"''])data[\\/]',                    # data/ directory reserved for real data
    '(?i)(^|[\\/\s"''])\.env(?!\.example)(\.[\w-]+)?($|[\s"''])',  # .env files (not .env.example)
    '(?i)privkey\.pem',                               # TLS private key
    '(?i)(^|[\\/\s"''])certs[\\/]'                    # certificate directory
)

function Get-Candidates($node, [string]$key) {
    if ($null -eq $node) { return }
    if ($node -is [string]) {
        if ($key -match $keyPattern -and $key -notmatch $skipKeyPattern) { $node }
        return
    }
    if ($node -is [System.Management.Automation.PSCustomObject]) {
        foreach ($p in $node.PSObject.Properties) { Get-Candidates $p.Value $p.Name }
        return
    }
    if ($node -is [System.Collections.IEnumerable]) {
        foreach ($item in $node) { Get-Candidates $item $key }
    }
}

foreach ($value in (Get-Candidates $payload '')) {
    if ($value -match '(?i)synthetic') { continue }
    foreach ($rx in $sensitive) {
        if ($value -match $rx) {
            [Console]::Error.WriteLine("Blocked by project policy (R47.1/R47.4): '$value' may contain real patient data or secrets. Use synthetic data under a path containing 'synthetic', or ask a human operator.")
            exit 2
        }
    }
}
exit 0
