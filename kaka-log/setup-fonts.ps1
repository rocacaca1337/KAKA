$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
$dest = Join-Path $PSScriptRoot 'src\fonts'
New-Item -ItemType Directory -Force -Path $dest | Out-Null
$tmp = Join-Path ([System.IO.Path]::GetTempPath()) ([guid]::NewGuid().ToString())
New-Item -ItemType Directory -Path $tmp | Out-Null
try {
  [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
  $url = 'https://www.gg.go.kr/uploads/CONTENTS/site/gg/%EA%B2%BD%EA%B8%B0%EC%84%9C%EC%B2%B4%EC%9B%B9%ED%8F%B0%ED%8A%B8.zip'
  $zip = Join-Path $tmp 'fonts.zip'
  Invoke-WebRequest -UseBasicParsing -Uri $url -OutFile $zip
  Expand-Archive -LiteralPath $zip -DestinationPath (Join-Path $tmp 'files')
  $files = @(Get-ChildItem (Join-Path $tmp 'files') -Recurse -File | Where-Object { $_.Extension -match '^\.woff2?$' })
  foreach ($weight in @('medium','bold')) {
    $pattern = if ($weight -eq 'medium') {'(?i)(medium|title[ _-]?m$|title[ _-]?medium|제목.*(미디움|중간|중간체|M$))'} else {'(?i)(bold|title[ _-]?b$|제목.*(볼드|굵은|B$))'}
    $matches = @($files | Where-Object { $_.BaseName -match '(?i)(title|제목)' -and $_.BaseName -match $pattern })
    if (!$matches.Count) { $files | Select-Object -ExpandProperty Name | Write-Host; throw "Could not identify $weight title font in official archive." }
    foreach ($f in $matches) { Copy-Item -LiteralPath $f.FullName -Destination (Join-Path $dest ('title-'+$weight+$f.Extension.ToLower())) -Force }
  }
  Write-Host 'KAKA local fonts are ready.' -ForegroundColor Green
} finally { Remove-Item -LiteralPath $tmp -Recurse -Force }
