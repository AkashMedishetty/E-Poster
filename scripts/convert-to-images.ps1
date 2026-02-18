# Convert all PPTX/PPT/PDF files in final-files to PNG images
# Output goes to public/final-images/ with the same base name

$inputDir = Join-Path $PSScriptRoot "..\public\final-files"
$outputDir = Join-Path $PSScriptRoot "..\public\final-images"

# Create output directory
if (-not (Test-Path $outputDir)) {
    New-Item -ItemType Directory -Path $outputDir -Force | Out-Null
}

Write-Host "Input: $inputDir"
Write-Host "Output: $outputDir"

# --- PPTX/PPT conversion using PowerPoint COM ---
$pptFiles = Get-ChildItem -Path $inputDir -Include "*.pptx","*.ppt" -Recurse
Write-Host "`nFound $($pptFiles.Count) PowerPoint files to convert..."

if ($pptFiles.Count -gt 0) {
    $ppt = $null
    try {
        $ppt = New-Object -ComObject PowerPoint.Application
        # Don't show PowerPoint window
        # $ppt.Visible = $false  # Some versions require visible

        $converted = 0
        $failed = 0

        foreach ($file in $pptFiles) {
            $baseName = [System.IO.Path]::GetFileNameWithoutExtension($file.Name)
            $outPath = Join-Path $outputDir "$baseName.png"

            if (Test-Path $outPath) {
                Write-Host "  SKIP (exists): $baseName"
                $converted++
                continue
            }

            try {
                Write-Host "  Converting: $($file.Name)..."
                $presentation = $ppt.Presentations.Open($file.FullName, $true, $false, $false)
                
                # Export first slide as PNG (ppShapeFormatPNG = 2)
                # Create a temp folder for the export
                $tempExportDir = Join-Path $outputDir "_temp_$baseName"
                if (Test-Path $tempExportDir) {
                    Remove-Item -Recurse -Force $tempExportDir
                }

                # Export slides as images - SaveAs with ppSaveAsPNG = 18
                $presentation.SaveAs($tempExportDir, 18)  # 18 = ppSaveAsPNG
                $presentation.Close()

                # PowerPoint creates a folder with Slide1.PNG, Slide2.PNG etc.
                $slideImage = Get-ChildItem -Path $tempExportDir -Filter "Slide1.PNG" -Recurse | Select-Object -First 1
                if ($slideImage) {
                    Copy-Item $slideImage.FullName $outPath
                    Write-Host "    OK: $baseName.png"
                    $converted++
                } else {
                    # Try any image file
                    $anyImage = Get-ChildItem -Path $tempExportDir -Include "*.png","*.PNG" -Recurse | Select-Object -First 1
                    if ($anyImage) {
                        Copy-Item $anyImage.FullName $outPath
                        Write-Host "    OK (alt): $baseName.png"
                        $converted++
                    } else {
                        Write-Host "    FAIL: No slide image found for $baseName"
                        $failed++
                    }
                }

                # Cleanup temp folder
                if (Test-Path $tempExportDir) {
                    Remove-Item -Recurse -Force $tempExportDir
                }
            } catch {
                Write-Host "    FAIL: $baseName - $_"
                $failed++
                try { $presentation.Close() } catch {}
            }
        }

        Write-Host "`nPowerPoint conversion done: $converted converted, $failed failed"
    } catch {
        Write-Host "ERROR starting PowerPoint: $_"
    } finally {
        if ($ppt) {
            try { $ppt.Quit() } catch {}
            try { [System.Runtime.Interopservices.Marshal]::ReleaseComObject($ppt) | Out-Null } catch {}
        }
        [System.GC]::Collect()
        [System.GC]::WaitForPendingFinalizers()
    }
}

Write-Host "`n--- PDF Conversion ---"
Write-Host "PDF files cannot be auto-converted without additional tools."
Write-Host "Please install one of these to convert PDFs:"
Write-Host "  - Ghostscript: gswin64c -dNOPAUSE -dBATCH -sDEVICE=png16m -r300 -sOutputFile=out.png input.pdf"
Write-Host "  - Or use an online converter"

$pdfFiles = Get-ChildItem -Path $inputDir -Filter "*.pdf"
Write-Host "Found $($pdfFiles.Count) PDF files that need manual conversion:"
foreach ($file in $pdfFiles) {
    $baseName = [System.IO.Path]::GetFileNameWithoutExtension($file.Name)
    Write-Host "  - $($file.Name)"
}

Write-Host "`nDone!"
