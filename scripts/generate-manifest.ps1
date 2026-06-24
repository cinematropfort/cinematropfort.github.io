# Usage: Open PowerShell in project root and run: .\scripts\generate-manifest.ps1
$projectRoot = Get-Location
$assets = Join-Path $projectRoot "assets"
$outDir = Join-Path $projectRoot "js"
$outFile = Join-Path $outDir "films.generated.js"

if (-Not (Test-Path $assets)) {
  Write-Error "Le dossier 'assets' est introuvable dans : $projectRoot"
  exit 1
}

function Is-Image($name) { return $name -match '\.(jpe?g|png|webp|gif|svg)$' }
function Is-Audio($name) { return $name -match '\.(mp3|ogg|wav|m4a|aac)$' }
function Humanize($s) { return $s -replace '[-_]', ' ' }

$folders = Get-ChildItem -Path $assets -Directory | Select-Object -ExpandProperty Name
$films = @()

foreach ($f in $folders) {
  $base = Join-Path $assets $f
  $images = @()
  $candidates = @("images","Images","img","imgs")
  foreach ($c in $candidates) {
    $d = Join-Path $base $c
    if (Test-Path $d) {
      $imgs = Get-ChildItem -Path $d -File | Where-Object { Is-Image($_.Name) } | Sort-Object Name
      if ($imgs) {
        foreach ($i in $imgs) { $images += ("assets/$f/$c/$($i.Name)") }
        break
      }
    }
  }
  if (-Not $images) {
    $imgs = Get-ChildItem -Path $base -File | Where-Object { Is-Image($_.Name) } | Sort-Object Name
    foreach ($i in $imgs) { $images += ("assets/$f/$($i.Name)") }
  }

  # poster
  $poster = ""
  $posterCandidates = @("poster.jpg","poster.png","poster.jpeg","poster.webp")
  foreach ($p in $posterCandidates) {
    $pp = Join-Path $base $p
    if (Test-Path $pp) { $poster = "assets/$f/$p"; break }
    $p2 = Join-Path (Join-Path $base "images") $p
    if (Test-Path $p2) { $poster = "assets/$f/images/$p"; break }
  }
  if (-not $poster -and $images) { $poster = $images[0] }

  # audio
  $audio = ""
  $audioDir = Join-Path $base "audio"
  if (Test-Path $audioDir) {
    $aud = Get-ChildItem -Path $audioDir -File | Where-Object { Is-Audio($_.Name) } | Sort-Object Name
    if ($aud) { $audio = "assets/$f/audio/$($aud[0].Name)" }
  }
  if (-not $audio) {
    $audRoot = Get-ChildItem -Path $base -File | Where-Object { Is-Audio($_.Name) } | Sort-Object Name
    if ($audRoot) { $audio = "assets/$f/$($audRoot[0].Name)" }
  }

  $obj = @{
    id = $f
    title = Humanize $f
    poster = $poster
    description = ""
    images = $images
    audio = $audio
  }
  $films += $obj
}

if (-Not (Test-Path $outDir)) { New-Item -Path $outDir -ItemType Directory | Out-Null }
$json = "window.filmsData = " + (ConvertTo-Json $films -Depth 5) + ";"
Set-Content -Path $outFile -Value $json -Encoding UTF8
Write-Host "Généré :" $outFile
Write-Host "Films trouvés : " ($films | ForEach-Object { "$($_.id) ($($_.images.Count) images)" } )