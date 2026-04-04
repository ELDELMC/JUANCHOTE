# Script de Generación de Backup/Zip para Juanchote
# Asegura compatibilidad con servidores Linux (BoxMineWorld)

Add-Type -AssemblyName System.IO.Compression.FileSystem

$sourceFiles = @(
    "index.js",
    "package.json",
    "package-lock.json",
    ".env",
    ".gitignore",
    "README.md"
)

$sourceDirs = @(
    "comandos",
    "utils",
    "db",
    "data"
)

$destinationDir = "box-pull"
$destinationZip = Join-Path $destinationDir "bot.zip"

if (-not (Test-Path $destinationDir)) {
    New-Item -ItemType Directory -Path $destinationDir | Out-Null
}

if (Test-Path $destinationZip) {
    Remove-Item $destinationZip -Force
}

$zip = [System.IO.Compression.ZipFile]::Open($destinationZip, 'Create')

try {
    # 📝 Agregar archivos individuales
    foreach ($file in $sourceFiles) {
        if (Test-Path $file) {
            $entry = $zip.CreateEntry($file)
            $fileStream = [System.IO.File]::OpenRead($file)
            $entryStream = $entry.Open()
            $fileStream.CopyTo($entryStream)
            $entryStream.Close()
            $fileStream.Close()
            Write-Host "✅ Agregado: $file" -ForegroundColor Green
        }
    }

    # 📁 Agregar carpetas recursivamente
    foreach ($dir in $sourceDirs) {
        if (Test-Path $dir) {
            $files = Get-ChildItem -Path $dir -Recurse | Where-Object { -not $_.PSIsContainer }
            foreach ($f in $files) {
                # Obtener ruta relativa y REEMPLAZAR \ por / para compatibilidad Linux
                $relativePath = $f.FullName.Substring((Get-Item .).FullName.Length + 1).Replace("\", "/")
                
                $entry = $zip.CreateEntry($relativePath)
                $fileStream = [System.IO.File]::OpenRead($f.FullName)
                $entryStream = $entry.Open()
                $fileStream.CopyTo($entryStream)
                $entryStream.Close()
                $fileStream.Close()
                Write-Host "✅ Agregado: $relativePath" -ForegroundColor Cyan
            }
        }
    }
}
finally {
    $zip.Dispose()
}

Write-Host "`n🚀 bot.zip generado correctamente en $destinationZip" -ForegroundColor Yellow
Write-Host "Ya puedes subirlo a tu panel de BoxMineWorld." -ForegroundColor Yellow
