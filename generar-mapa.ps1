# generar-mapa.ps1
# Ejecutar desde la raiz del proyecto: D:\dev\dream-team
# Genera MAPA-CODIGO.md que Cline lee antes de cada tarea
# Volver a ejecutar cada vez que agregues archivos o funciones nuevas

$output = @()
$output += "# MAPA DE CODIGO — Dream Team"
$output += "# Auto-generado. No editar a mano. Regenerar con: .\generar-mapa.ps1"
$output += "# Cline: leer este archivo PRIMERO antes de cualquier tarea`n"

$output += "## ESTRUCTURA DE CARPETAS`n"
$folders = Get-ChildItem -Path "src" -Recurse -Directory | 
    Select-Object -ExpandProperty FullName |
    ForEach-Object { $_.Replace((Get-Location).Path + "\", "") }
foreach ($f in $folders) {
    $output += "- $f"
}

$output += "`n## ARCHIVOS Y SUS EXPORTS/FUNCIONES PRINCIPALES`n"

Get-ChildItem -Path "src" -Recurse -Filter "*.js" | Sort-Object FullName | ForEach-Object {
    $relativePath = $_.FullName.Replace((Get-Location).Path + "\", "").Replace("\", "/")
    $output += "### $relativePath"
    
    $matches = Select-String -Path $_.FullName -Pattern `
        "^(export\s+)?(async\s+)?(function\s+\w+|const\s+\w+\s*=\s*(async\s+)?\(|class\s+\w+)" `
        -AllMatches
    
    if ($matches) {
        foreach ($match in $matches) {
            $line = $match.Line.Trim()
            $lineNum = $match.LineNumber
            if ($line.Length -gt 80) { $line = $line.Substring(0, 80) + "..." }
            $output += "  L$lineNum`: $line"
        }
    } else {
        $output += "  (sin exports detectados)"
    }
    $output += ""
}

$output += "## KEYWORDS POR FEATURE (para buscar rapido)`n"
$features = @{
    "decision|evento"     = "Pantalla de decisiones / eventos"
    "transfer|fichaje"    = "Sistema de transferencias"
    "simulat|partido"     = "Simulacion de partidos"
    "temporada|season"    = "Logica de temporada"
    "render|pantalla"     = "Renderizado UI"
    "estado|state"        = "Gestion de estado"
    "tabla|clasificacion" = "Tabla de posiciones"
    "moral|fatiga|presion"= "Stats del plantel"
}

foreach ($keyword in $features.Keys) {
    $label = $features[$keyword]
    $output += "### $label"
    $results = Get-ChildItem -Path "src" -Recurse -Filter "*.js" | 
        ForEach-Object {
            $rel = $_.FullName.Replace((Get-Location).Path + "\", "").Replace("\", "/")
            $hits = Select-String -Path $_.FullName -Pattern $keyword -AllMatches
            if ($hits) { "$rel (L$($hits[0].LineNumber))" }
        }
    foreach ($r in $results) { if ($r) { $output += "  - $r" } }
    $output += ""
}

$output | Out-File -FilePath "MAPA-CODIGO.md" -Encoding utf8
Write-Host "✓ MAPA-CODIGO.md generado en la raiz del proyecto" -ForegroundColor Green
Write-Host "  Archivos escaneados: $((Get-ChildItem -Path 'src' -Recurse -Filter '*.js').Count)" -ForegroundColor Cyan
