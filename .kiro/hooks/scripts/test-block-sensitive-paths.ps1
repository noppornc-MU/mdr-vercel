# Self-test for block-sensitive-paths.ps1 — expected exit code per sample payload.
$script = Join-Path $PSScriptRoot 'block-sensitive-paths.ps1'
$cases = @(
    @{ Name = 'docs file allowed';        Expect = 0; Json = '{"tool_input":{"path":"d:\\AI\\MdrAI\\docs\\design.md"}}' },
    @{ Name = 'content with .xlsx ok';    Expect = 0; Json = '{"tool_input":{"path":"docs/a.md","text":"read MDR-2026.xlsx and data/ and .env"}}' },
    @{ Name = 'os.environ in path ok';    Expect = 0; Json = '{"tool_input":{"path":"apps/api/settings_environ.py"}}' },
    @{ Name = 'env example allowed';      Expect = 0; Json = '{"tool_input":{"path":"deploy/.env.example"}}' },
    @{ Name = 'synthetic xlsx allowed';   Expect = 0; Json = '{"tool_input":{"path":"tests/fixtures/synthetic/seed.xlsx"}}' },
    @{ Name = 'exclude data allowed';     Expect = 0; Json = '{"tool_input":{"query":"x","excludePattern":"data/**"}}' },
    @{ Name = 'real xlsx blocked';        Expect = 2; Json = '{"tool_input":{"path":"d:\\AI\\MdrAI\\MDR-2026.xlsx"}}' },
    @{ Name = 'data dir blocked';         Expect = 2; Json = '{"tool_input":{"path":"d:\\AI\\MdrAI\\data\\reports\\a.pdf"}}' },
    @{ Name = 'dotenv blocked';           Expect = 2; Json = '{"tool_input":{"path":"deploy/.env"}}' },
    @{ Name = 'dotenv in command blocked'; Expect = 2; Json = '{"tool_input":{"command":"Get-Content deploy/.env"}}' },
    @{ Name = 'privkey blocked';          Expect = 2; Json = '{"tool_input":{"targetFile":"deploy/certs/privkey.pem"}}' },
    @{ Name = 'importer real file blocked'; Expect = 2; Json = '{"tool_input":{"command":"python -m importers.excel_seed --file X.xlsx --dry-run"}}' }
)
$failed = 0
foreach ($c in $cases) {
    $c.Json | pwsh -NoProfile -File $script 2>$null
    $code = $LASTEXITCODE
    $ok = ($code -eq $c.Expect)
    if (-not $ok) { $failed++ }
    '{0,-28} expect={1} got={2} {3}' -f $c.Name, $c.Expect, $code, ($(if ($ok) { 'PASS' } else { 'FAIL' }))
}
"failed: $failed"
exit $failed
