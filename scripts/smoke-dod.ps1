<#
  smoke-dod.ps1 — Definition-of-Done smoke test (requirements.md DoD 1–6) over HTTP.
  Run against a running server (npm run start / npm run dev) in cached mode:
    pwsh -NoProfile -File scripts/smoke-dod.ps1 [-BaseUrl http://localhost:3000]
  Prints PASS/FAIL per check, exits 1 if any check fails.
  NOTE: it calls POST /api/seed first (resets demo data) and then creates + approves one isolate.
  When the site access gate is on (SITE_ACCESS_USER / SITE_ACCESS_PASSWORD), pass -User and -Password
  (HTTP Basic Auth). The password is never printed.
#>
param(
  [string]$BaseUrl = 'http://localhost:3200',
  [switch]$SkipSeed,     # do not reset demo data (POST /api/seed)
  [switch]$KeepIsolate,  # keep the isolate created for DoD 2 (default: delete it at the end)
  [string]$User,         # optional Basic Auth user (site access gate)
  [string]$Password      # optional Basic Auth password
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Net.Http
$handler = [System.Net.Http.HttpClientHandler]::new()
$handler.UseCookies = $false
$client = [System.Net.Http.HttpClient]::new($handler)
$client.Timeout = [TimeSpan]::FromSeconds(180)
if ($User -or $Password) {
  $basic = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes("${User}:${Password}"))
  $client.DefaultRequestHeaders.Authorization = [System.Net.Http.Headers.AuthenticationHeaderValue]::new('Basic', $basic)
  Remove-Variable basic
}

$script:results = [System.Collections.Generic.List[object]]::new()

function Invoke-Api {
  param([string]$Method = 'GET', [string]$Path, [object]$Body = $null, [string]$Role = 'ICN')
  $req = [System.Net.Http.HttpRequestMessage]::new([System.Net.Http.HttpMethod]::new($Method), "$BaseUrl$Path")
  $req.Headers.Add('Cookie', "demo_role=$Role")
  if ($null -ne $Body) {
    $json = if ($Body -is [string]) { $Body } else { $Body | ConvertTo-Json -Depth 50 -Compress }
    $req.Content = [System.Net.Http.StringContent]::new($json, [Text.Encoding]::UTF8, 'application/json')
  }
  $sw = [Diagnostics.Stopwatch]::StartNew()
  $resp = $client.SendAsync($req).GetAwaiter().GetResult()
  $bytes = $resp.Content.ReadAsByteArrayAsync().GetAwaiter().GetResult()
  $sw.Stop()
  $text = [Text.Encoding]::UTF8.GetString($bytes)
  $data = $null
  try { $data = $text | ConvertFrom-Json -Depth 100 -DateKind String } catch { }
  [pscustomobject]@{ Status = [int]$resp.StatusCode; Text = $text; Data = $data; Ms = $sw.ElapsedMilliseconds }
}

function Add-Check {
  param([string]$Name, [bool]$Ok, [string]$Detail = '')
  $script:results.Add([pscustomobject]@{ Check = $Name; Result = $(if ($Ok) { 'PASS' } else { 'FAIL' }); Detail = $Detail })
  $color = if ($Ok) { 'Green' } else { 'Red' }
  Write-Host ("[{0}] {1} :: {2}" -f $(if ($Ok) { 'PASS' } else { 'FAIL' }), $Name, $Detail) -ForegroundColor $color
}

function Write-Info([string]$msg) { Write-Host "  info: $msg" -ForegroundColor DarkGray }

function Short([string]$s, [int]$n = 300) { if ($null -eq $s) { return '' }; if ($s.Length -le $n) { return $s }; return $s.Substring(0, $n) + '…' }

function As-Array($x) { if ($null -eq $x) { return @() }; return @($x) }

# Normalised drug key: lowercase letters only
function DrugKey([string]$name) { if (-not $name) { return '' }; return ($name.ToLowerInvariant() -replace '[^a-z]', '') }

# Golden 15 pairs (design §5) as normalised-prefix → expected result
$golden = [ordered]@{
  'amikacin' = 'S'; 'amoxicillin' = 'R'; 'ampicillin' = 'R'; 'cefepime' = 'S'; 'cefoxitin' = 'R'
  'ceftriaxone' = 'R'; 'cefuroxime' = 'R'; 'ciprofloxacin' = 'R'; 'ertapenem' = 'S'; 'gentamicin' = 'S'
  'imipenem' = 'S'; 'meropenem' = 'S'; 'piperacillin' = 'D'; 'tetracycline' = 'R'; 'tmp' = 'S'
}
function GoldenKeyFor([string]$drugName) {
  $k = DrugKey $drugName
  if ($k -match '^(trimethoprim|tmp|sxt|cotrimoxazole|cotrim)') { return 'tmp' }
  foreach ($g in $golden.Keys) { if ($g -ne 'tmp' -and $k.StartsWith($g)) { return $g } }
  return $null
}

function Find-Cell($cells, [string]$orgPattern, [string]$drugName) {
  $dk = DrugKey $drugName
  foreach ($c in (As-Array $cells)) {
    if ($c.organism -match $orgPattern -and (DrugKey $c.drug) -eq $dk) { return $c }
  }
  return $null
}

function Near($a, $b, [double]$tol = 0.1) {
  if ($null -eq $a -or $null -eq $b) { return $false }
  return [math]::Abs([double]$a - [double]$b) -le $tol
}

$KP = 'Klebsiella pneumoniae'
$KPpat = '(?i)klebsiella\s+pneumoniae'
$wide = 'from=2023-01-01&to=2026-10-16'

Write-Host "MDR MVP — DoD smoke test against $BaseUrl$(if ($User) { ' (Basic Auth on)' })" -ForegroundColor Cyan

# ---------------------------------------------------------------- pages
foreach ($p in '/dashboard', '/antibiogram', '/entry', '/isolates', '/consult') {
  try {
    $r = Invoke-Api -Path $p
    Add-Check "PAGE $p" ($r.Status -eq 200) "HTTP $($r.Status) in $($r.Ms) ms"
  } catch { Add-Check "PAGE $p" $false $_.Exception.Message }
}

# ---------------------------------------------------------------- seed
if (-not $SkipSeed) {
  try {
    $r = Invoke-Api -Method POST -Path '/api/seed'
    Add-Check 'SEED POST /api/seed (<10 s)' (($r.Status -eq 200) -and ($r.Ms -lt 10000)) "HTTP $($r.Status) in $($r.Ms) ms :: $(Short $r.Text 200)"
  } catch { Add-Check 'SEED POST /api/seed (<10 s)' $false $_.Exception.Message }
}

# ---------------------------------------------------------------- master data
$master = $null; $wards = @(); $organisms = @(); $drugs = @()
try {
  $r = Invoke-Api -Path '/api/master'
  $master = $r.Data
  $root = if ($master.PSObject.Properties.Name -contains 'data') { $master.data } else { $master }
  $wards = As-Array $root.wards
  $organisms = As-Array $root.organisms
  $drugs = As-Array $root.drugs
  Add-Check 'MASTER GET /api/master' (($r.Status -eq 200) -and $wards.Count -gt 0 -and $organisms.Count -gt 0 -and $drugs.Count -gt 0) "wards=$($wards.Count) organisms=$($organisms.Count) drugs=$($drugs.Count)"
} catch { Add-Check 'MASTER GET /api/master' $false $_.Exception.Message }

$drugById = @{}; foreach ($d in $drugs) { $drugById[[string]$d.id] = $d.name }
$orgById = @{}; foreach ($o in $organisms) { $orgById[[string]$o.id] = $o }
$icuB = $wards | Where-Object { $_.name -match '(?i)^ICU\s*B$' -or $_.code -match '(?i)ICU.?B' } | Select-Object -First 1
if (-not $icuB) { $icuB = $wards | Where-Object { $_.name -match '(?i)ICU\s*B' } | Select-Object -First 1 }
$icuBId = if ($icuB) { [int]$icuB.id } else { $null }
Write-Info "ICU B wardId=$icuBId"

# ---------------------------------------------------------------- DoD 1 — extract sample
$extract = $null
try {
  $r = Invoke-Api -Method POST -Path '/api/extract' -Body @{ useSample = $true }
  $extract = $r.Data
  if ($r.Status -ne 200 -or -not $extract.input) { throw "HTTP $($r.Status): $(Short $r.Text)" }
  $ast = As-Array $extract.input.ast
  $matched = 0; $problems = @()
  $seen = @{}
  foreach ($a in $ast) {
    $name = if ($null -ne $a.drugId -and $drugById.ContainsKey([string]$a.drugId)) { $drugById[[string]$a.drugId] } else { $null }
    if (-not $name) { $problems += "unmapped drug '$($a.drugRaw)'"; continue }
    $gk = GoldenKeyFor $name
    if (-not $gk) { $problems += "unexpected drug '$name'"; continue }
    if ($seen.ContainsKey($gk)) { $problems += "duplicate '$name'"; continue }
    $seen[$gk] = $true
    if ($a.result -eq $golden[$gk]) { $matched++ } else { $problems += "$name=$($a.result) (expected $($golden[$gk]))" }
  }
  Add-Check 'DoD1 extract 15/15 drug-result pairs' (($ast.Count -eq 15) -and ($matched -eq 15)) "mode=$($extract.mode) pairs=$($ast.Count) matched=$matched $(($problems -join '; '))"
  $flags = As-Array $extract.flags
  $wardFlag = $flags | Where-Object { $_.path -match '(?i)ward' }
  Add-Check 'DoD1 ward flagged (wardId null + flag)' (($null -eq $extract.input.wardId) -and ($null -ne $wardFlag)) "wardId=$($extract.input.wardId) flags=$(($flags | ForEach-Object { $_.path }) -join ',')"
  $org = if ($null -ne $extract.input.organismId) { $orgById[[string]$extract.input.organismId] } else { $null }
  Add-Check 'DoD1 organism = K. pneumoniae, BLOOD, FINAL, 2026-10-12' (($org.name -match $KPpat) -and ($extract.input.specimenType -eq 'BLOOD') -and ($extract.input.reportStatus -eq 'FINAL') -and ($extract.input.specimenDate -eq '2026-10-12')) "organism=$($org.name) specimen=$($extract.input.specimenType) status=$($extract.input.reportStatus) date=$($extract.input.specimenDate) hn=$($extract.input.hn)"
} catch { Add-Check 'DoD1 extract 15/15 drug-result pairs' $false $_.Exception.Message }

# ---------------------------------------------------------------- DoD 2 — create + approve → dashboard +1, antibiogram changes
function Get-IsolateCount([string]$qs) {
  $r = Invoke-Api -Path "/api/dashboard?$qs"
  if ($r.Status -ne 200) { throw "dashboard HTTP $($r.Status): $(Short $r.Text)" }
  return [int]$r.Data.kpis.isolates.value
}
function Get-KpAbg([string]$qs) {
  $r = Invoke-Api -Path "/api/antibiogram?$qs"
  if ($r.Status -ne 200) { throw "antibiogram HTTP $($r.Status): $(Short $r.Text)" }
  $o = As-Array $r.Data.organisms | Where-Object { $_.name -match $KPpat } | Select-Object -First 1
  $mero = Find-Cell $r.Data.cells $KPpat 'Meropenem'
  return [pscustomobject]@{ n = $(if ($o) { [int]$o.n } else { 0 }); meroN = $(if ($mero) { [int]$mero.nTested } else { 0 }); meroPct = $(if ($mero) { $mero.pctS } else { $null }) }
}
$newIsolateId = $null
try {
  if (-not $extract) { throw 'no extract result (DoD1 failed)' }
  if (-not $icuBId) { throw 'ICU B ward not found in /api/master' }
  # Default periods (Dashboard = last 90 days of data, Antibiogram = last 12 months) — the sample is dated 2026-10-12
  $beforeDefault = Get-IsolateCount ''
  $abgBefore = Get-KpAbg ''

  $inputObj = $extract.input
  $inputObj | Add-Member -NotePropertyName wardId -NotePropertyValue $icuBId -Force
  $inputObj | Add-Member -NotePropertyName patientType -NotePropertyValue 'IPD' -Force
  $rd = Invoke-Api -Method POST -Path '/api/isolates' -Role 'DOCTOR' -Body (@{ input = $inputObj; confirmDuplicate = $false } | ConvertTo-Json -Depth 50 -Compress)
  Add-Check 'DoD2 create blocked for DOCTOR' ($rd.Status -eq 403) "HTTP $($rd.Status)"
  $r = Invoke-Api -Method POST -Path '/api/isolates' -Body (@{ input = $inputObj; confirmDuplicate = $false } | ConvertTo-Json -Depth 50 -Compress)
  if ($r.Status -eq 409 -or ($r.Data -and $r.Data.duplicate)) {
    Write-Info 'duplicate warning returned (MR2.5) — re-posting with confirmDuplicate=true'
    $r = Invoke-Api -Method POST -Path '/api/isolates' -Body (@{ input = $inputObj; confirmDuplicate = $true } | ConvertTo-Json -Depth 50 -Compress)
  }
  $newIsolateId = $r.Data.id
  Add-Check 'DoD2 create isolate (DRAFT)' (($r.Status -lt 400) -and $newIsolateId -and ($r.Data.status -eq 'DRAFT')) "HTTP $($r.Status) id=$newIsolateId code=$($r.Data.code) status=$($r.Data.status) flags=$(Short (($r.Data.flags | ConvertTo-Json -Compress -Depth 5)) 200)"

  $countAfterDraft = Get-IsolateCount ''
  Add-Check 'DoD2 DRAFT not counted' ($countAfterDraft -eq $beforeDefault) "before=$beforeDefault afterDraft=$countAfterDraft"

  $ra = Invoke-Api -Method POST -Path "/api/isolates/$newIsolateId/approve" -Role 'DOCTOR'
  Add-Check 'DoD2 approve blocked for DOCTOR' ($ra.Status -ge 400) "HTTP $($ra.Status)"
  $ra = Invoke-Api -Method POST -Path "/api/isolates/$newIsolateId/approve" -Role 'ICN'
  Add-Check 'DoD2 approve as ICN' ($ra.Status -lt 400) "HTTP $($ra.Status) :: $(Short $ra.Text 200)"

  $afterDefault = Get-IsolateCount ''
  $abgAfter = Get-KpAbg ''
  Add-Check 'DoD2 dashboard isolates +1 (default period)' (($afterDefault - $beforeDefault) -eq 1) "before=$beforeDefault after=$afterDefault (sample specimenDate=$($extract.input.specimenDate))"
  Add-Check 'DoD2 K. pneumoniae antibiogram changes' (($abgAfter.n -ne $abgBefore.n) -or ($abgAfter.meroN -ne $abgBefore.meroN)) "n $($abgBefore.n)→$($abgAfter.n); Meropenem nTested $($abgBefore.meroN)→$($abgAfter.meroN), %S $($abgBefore.meroPct)→$($abgAfter.meroPct)"
} catch { Add-Check 'DoD2 create/approve flow' $false $_.Exception.Message }

# ---------------------------------------------------------------- DoD 3 — antibiogram formulas, SDD, phenotype breakdown, tiers
$validTiers = 'SUPPORTED', 'CONSIDER', 'NOT_SUPPORTED', 'LOW_DATA', 'INTRINSIC'
try {
  $rS = Invoke-Api -Path '/api/antibiogram?formula=S_ONLY'
  $rD = Invoke-Api -Path '/api/antibiogram?formula=S_PLUS_SDD'
  if ($rS.Status -ne 200 -or $rD.Status -ne 200) { throw "HTTP $($rS.Status)/$($rD.Status): $(Short $rS.Text)" }
  $cellsS = As-Array $rS.Data.cells; $cellsD = As-Array $rD.Data.cells
  $hasFields = ($cellsS.Count -gt 0) -and ($null -ne ($cellsS[0].PSObject.Properties.Name | Where-Object { $_ -eq 'nTested' })) -and ($null -ne ($cellsS[0].PSObject.Properties.Name | Where-Object { $_ -eq 'pctSDD' }))
  Add-Check 'DoD3 cells have %S/%SDD/n' $hasFields "cells=$($cellsS.Count) organisms=$((As-Array $rS.Data.organisms).Count) drugs=$((As-Array $rS.Data.drugs).Count) meta.formula=$($rS.Data.meta.formula)/$($rD.Data.meta.formula) dataAsOf=$($rS.Data.meta.dataAsOf) pending=$($rS.Data.meta.pendingCount)"

  $diff = $null
  foreach ($c in $cellsS) {
    if ($c.sddApplicable -and $c.d -gt 0 -and -not $c.insufficient) {
      $c2 = $cellsD | Where-Object { $_.organism -eq $c.organism -and $_.drug -eq $c.drug } | Select-Object -First 1
      if ($c2 -and $null -ne $c2.pctS -and $null -ne $c.pctS -and [double]$c2.pctS -gt [double]$c.pctS) { $diff = @($c, $c2); break }
    }
  }
  if ($diff) {
    $okSum = Near ([double]$diff[1].pctS) ([double]$diff[0].pctS + [double]$diff[0].pctSDD) 0.2
    Add-Check 'DoD3 formula switch S_ONLY vs S_PLUS_SDD' (($rS.Data.meta.formula -eq 'S_ONLY') -and ($rD.Data.meta.formula -eq 'S_PLUS_SDD') -and $okSum) "$($diff[0].organism) × $($diff[0].drug): S-only $($diff[0].pctS)% · S+SDD $($diff[1].pctS)% · %SDD $($diff[0].pctSDD)% (n=$($diff[0].nTested))"
  } else { Add-Check 'DoD3 formula switch S_ONLY vs S_PLUS_SDD' $false 'no SDD-applicable cell with d>0 whose %S differs between formulas' }

  $lowCell = $cellsS | Where-Object { $_.insufficient } | Select-Object -First 1
  Add-Check 'DoD3 n<30 label' (($null -ne $lowCell) -and ($lowCell.label -match 'n<') -and ($lowCell.tier -eq 'LOW_DATA')) "$($lowCell.organism) × $($lowCell.drug): label=$($lowCell.label) n=$($lowCell.nTested) tier=$($lowCell.tier)"

  $tiers = $cellsS | ForEach-Object { $_.tier } | Sort-Object -Unique
  $core = @($tiers | Where-Object { $_ -in 'SUPPORTED', 'CONSIDER', 'NOT_SUPPORTED', 'LOW_DATA' })
  $badTier = @($tiers | Where-Object { $_ -notin $validTiers })
  Add-Check 'DoD3 4-tier labels present' (($core.Count -ge 3) -and ($badTier.Count -eq 0)) "tiers=$($tiers -join ',')"

  $orgQ = [uri]::EscapeDataString($KP)
  $rp = Invoke-Api -Path "/api/antibiogram?view=phenotype&organism=$orgQ&phenotype=CRE"
  if ($rp.Status -ne 200) { throw "phenotype view HTTP $($rp.Status): $(Short $rp.Text)" }
  $cre = As-Array $rp.Data.counts | Where-Object { $_.code -eq 'CRE' } | Select-Object -First 1
  $pdrugs = As-Array $rp.Data.drugs
  $sorted = $true; $prev = [double]::MaxValue; $seenInsufficient = $false
  foreach ($c in $pdrugs) {
    if ($c.insufficient -or $null -eq $c.pctS) { $seenInsufficient = $true; continue }
    if ($seenInsufficient) { $sorted = $false }
    if ([double]$c.pctS -gt $prev + 0.0001) { $sorted = $false }
    $prev = [double]$c.pctS
  }
  $ptiers = ($pdrugs | ForEach-Object { $_.tier } | Sort-Object -Unique) -join ','
  Add-Check 'DoD3 phenotype view K. pneumoniae – CRE' (($null -ne $cre) -and ([int]$cre.positive -gt 0) -and ($pdrugs.Count -gt 0) -and $sorted) "CRE positive=$($cre.positive) negative=$($cre.negative) unclassifiable=$($cre.unclassifiable); drugs=$($pdrugs.Count) sorted=$sorted tiers=$ptiers; top=$(($pdrugs | Select-Object -First 3 | ForEach-Object { "$($_.drug) $($_.label)" }) -join ' | ')"
} catch { Add-Check 'DoD3 antibiogram' $false $_.Exception.Message }

# ---------------------------------------------------------------- DoD 4 — consult K. pneumoniae BLOOD ICU B
$dosePattern = '(?i)\d+(\.\d+)?\s*(mg|mcg|µg|g/kg|mg/kg|gram|กรัม|มิลลิกรัม)\b|q\d+h|วันละ\s*\d|ทุก\s*\d+\s*ชั่วโมง'
try {
  if (-not $icuBId) { throw 'ICU B ward not found' }
  $q4 = 'K. pneumoniae จาก blood culture ใน ICU B ยาตัวไหนข้อมูลท้องถิ่นสนับสนุน'
  $r = Invoke-Api -Method POST -Path '/api/consult' -Body @{ organism = $KP; wardId = $icuBId; specimenType = 'BLOOD'; question = $q4 } -Role 'DOCTOR'
  $c = $r.Data
  if ($r.Status -ne 200 -or -not $c) { throw "HTTP $($r.Status): $(Short $r.Text)" }
  $ans = $c.answer
  $facts = As-Array $ans.facts
  $sections = ($facts.Count -gt 0) -and ($null -ne $ans.reasoning) -and ((As-Array $ans.needs_clinician_judgment).Count -gt 0)
  Add-Check 'DoD4 consult ok + 3 sections' (($c.ok -eq $true) -and $sections -and ((As-Array $ans.abstentions).Count -eq 0)) "ok=$($c.ok) facts=$($facts.Count) reasoning=$((As-Array $ans.reasoning).Count) judgment=$((As-Array $ans.needs_clinician_judgment).Count) abstentions=$((As-Array $ans.abstentions).Count) disclaimer=$($ans.disclaimer_shown) retried=$($c.retried)"
  Add-Check 'DoD4 verify passed' ($c.verify.passed -eq $true) "errors=$(Short (($c.verify.errors | ConvertTo-Json -Compress -Depth 5)) 200)"

  $ra = Invoke-Api -Path "/api/antibiogram?wardId=$icuBId&specimenType=BLOOD"
  $cells = As-Array $ra.Data.cells
  $ok = 0; $bad = @()
  foreach ($f in $facts) {
    $cell = Find-Cell $cells $KPpat $f.drug
    if (-not $cell) { $bad += "$($f.drug): no antibiogram cell"; continue }
    $pctOk = (Near $f.pct_s $cell.pctS 0.1) -or (($null -ne $f.pct_s) -and (Near ([double]$f.pct_s * 100) $cell.pctS 0.1))
    if ($pctOk -and ([int]$f.n_tested -eq [int]$cell.nTested)) { $ok++ } else { $bad += "$($f.drug): fact $($f.pct_s)%/n=$($f.n_tested) vs abg $($cell.pctS)%/n=$($cell.nTested)" }
  }
  $sample = ($facts | Select-Object -First 3 | ForEach-Object { "$($_.drug) $($_.pct_s)% n=$($_.n_tested)" }) -join ' | '
  Add-Check 'DoD4 facts equal /api/antibiogram numbers' (($facts.Count -gt 0) -and ($ok -eq $facts.Count)) "matched $ok/$($facts.Count) [$sample] $(($bad -join '; '))"
  $ansText = $ans | ConvertTo-Json -Depth 20 -Compress
  Add-Check 'DoD4 no dose / no first-line wording' (-not ($ansText -match $dosePattern) -and -not ($ansText -match '(?i)first-line|drug of choice|แนะนำให้ใช้')) 'checked answer JSON'
} catch { Add-Check 'DoD4 consult' $false $_.Exception.Message }

# ---------------------------------------------------------------- DoD 5 — low-n → abstention
try {
  $peds = $wards | Where-Object { $_.name -match 'เด็ก' -and $_.wardType -ne 'ICU' } | Select-Object -First 1
  if (-not $peds) { $peds = $wards | Where-Object { $_.wardType -ne 'ICU' } | Select-Object -Last 1 }
  $entero = $organisms | Where-Object { $_.group -eq 'ENTEROCOCCUS' } | Select-Object -First 1
  if (-not $entero) { $entero = $organisms | Where-Object { $_.name -match '(?i)enterococcus' } | Select-Object -First 1 }
  $ra = Invoke-Api -Path "/api/antibiogram?wardId=$($peds.id)"
  $eo = As-Array $ra.Data.organisms | Where-Object { $_.name -eq $entero.name } | Select-Object -First 1
  Write-Info "low-n context: $($entero.name) @ $($peds.name) (wardId=$($peds.id)) first-isolate n=$(if ($eo) { $eo.n } else { 0 })"
  $r = Invoke-Api -Method POST -Path '/api/consult' -Body @{ organism = $entero.name; wardId = [int]$peds.id; question = "$($entero.name) ใน $($peds.name) ยาตัวไหนข้อมูลท้องถิ่นสนับสนุน" } -Role 'DOCTOR'
  $c = $r.Data
  $abs = As-Array $c.answer.abstentions
  $reasons = ($abs | ForEach-Object { $_.reason }) -join ','
  Add-Check 'DoD5 low-n → abstention with reason' (($r.Status -eq 200) -and ($abs | Where-Object { $_.reason -in 'n_below_minimum', 'no_data' })) "HTTP $($r.Status) ok=$($c.ok) verify=$($c.verify.passed) reasons=$reasons detail=$(Short (($abs | Select-Object -First 1).detail) 160)"
} catch { Add-Check 'DoD5 low-n abstention' $false $_.Exception.Message }

# ---------------------------------------------------------------- DoD 6 — dose question → refusal
try {
  $q6 = 'ขนาดยา Meropenem สำหรับ K. pneumoniae ในเลือด ควรให้กี่ mg และทุกกี่ชั่วโมง'
  $r = Invoke-Api -Method POST -Path '/api/consult' -Body @{ organism = $KP; wardId = $icuBId; specimenType = 'BLOOD'; question = $q6 } -Role 'DOCTOR'
  $c = $r.Data
  $abs = As-Array $c.answer.abstentions
  $dose = $abs | Where-Object { $_.reason -eq 'dose_requested' } | Select-Object -First 1
  $ansText = $c.answer | ConvertTo-Json -Depth 20 -Compress
  $guideline = $ansText -match '(?i)แนวทาง|guideline'
  Add-Check 'DoD6 dose question → dose_requested refusal' (($r.Status -eq 200) -and ($null -ne $dose) -and $guideline -and -not ($ansText -match $dosePattern)) "HTTP $($r.Status) ok=$($c.ok) verify=$($c.verify.passed) guideline=$guideline detail=$(Short $dose.detail 160)"
} catch { Add-Check 'DoD6 dose refusal' $false $_.Exception.Message }

# ---------------------------------------------------------------- EXECUTIVE — no HN in API
try {
  $r = Invoke-Api -Path '/api/dashboard' -Role 'EXECUTIVE'
  $hasHn = $r.Text -match '"hn"\s*:' -or $r.Text -match '"patients"\s*:\s*\['
  Add-Check 'EXEC /api/dashboard has no hn/patients' (($r.Status -eq 200) -and -not $hasHn) "HTTP $($r.Status) recentResistant=$((As-Array $r.Data.recentResistant).Count) clusters=$((As-Array $r.Data.clusters).Count)"
  $ri = Invoke-Api -Path '/api/dashboard' -Role 'ICN'
  Write-Info "ICN dashboard contains hn: $($ri.Text -match '"hn"\s*:') ; clusters=$((As-Array $ri.Data.clusters).Count) $(((As-Array $ri.Data.clusters) | Select-Object -First 1 | ForEach-Object { "$($_.organism)/$($_.phenotype) @ $($_.wardName) patients=$($_.patientCount)" }))"
  $rl = Invoke-Api -Path '/api/isolates' -Role 'EXECUTIVE'
  if ($rl.Status -eq 200) {
    Add-Check 'EXEC /api/isolates has no hn values' (-not ($rl.Text -match '"hn"\s*:\s*"\d')) "HTTP $($rl.Status)"
  } else { Write-Info "EXECUTIVE /api/isolates HTTP $($rl.Status) (blocked)" }
} catch { Add-Check 'EXEC no HN' $false $_.Exception.Message }

# ---------------------------------------------------------------- cleanup (remove the smoke isolate so the demo upload is not a duplicate)
if ($newIsolateId -and -not $KeepIsolate) {
  try {
    $r = Invoke-Api -Method DELETE -Path "/api/isolates/$newIsolateId"
    Add-Check 'CLEANUP delete smoke isolate (ICN)' ($r.Status -lt 400) "HTTP $($r.Status)"
  } catch { Add-Check 'CLEANUP delete smoke isolate (ICN)' $false $_.Exception.Message }
}

# ---------------------------------------------------------------- summary
Write-Host ''
Write-Host '==================== SUMMARY ====================' -ForegroundColor Cyan
$script:results | Format-Table -AutoSize Check, Result | Out-String -Width 200 | Write-Host
$fails = @($script:results | Where-Object { $_.Result -eq 'FAIL' })
Write-Host ("{0} checks, {1} passed, {2} failed" -f $script:results.Count, ($script:results.Count - $fails.Count), $fails.Count) -ForegroundColor $(if ($fails.Count) { 'Red' } else { 'Green' })
$client.Dispose()
if ($fails.Count -gt 0) { exit 1 } else { exit 0 }
