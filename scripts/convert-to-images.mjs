/**
 * Batch convert PPTX/PPT/PDF files to PNG images.
 * 
 * PPTX: Extracts the first image from ppt/media/ inside the ZIP.
 * PDF: Uses pdfjs-dist with canvas to render page 1.
 * PPT: Cannot be converted (legacy format), skipped.
 * 
 * Usage: node scripts/convert-to-images.mjs
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import JSZip from 'jszip';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const INPUT_DIR = path.join(__dirname, '..', 'public', 'final-files');
const OUTPUT_DIR = path.join(__dirname, '..', 'public', 'final-images');

const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.tiff'];

function isImageFile(filename) {
  const lower = filename.toLowerCase();
  return IMAGE_EXTENSIONS.some(ext => lower.endsWith(ext));
}

async function convertPptx(filePath, outputPath) {
  const data = fs.readFileSync(filePath);
  const zip = await JSZip.loadAsync(data);

  const mediaEntries = [];
  zip.forEach((relativePath, zipEntry) => {
    if (!zipEntry.dir && relativePath.startsWith('ppt/media/') && isImageFile(relativePath)) {
      mediaEntries.push({ name: relativePath, file: zipEntry });
    }
  });

  // Sort by filename to get slides in order
  mediaEntries.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));

  if (mediaEntries.length === 0) {
    return false;
  }

  // Take the first (largest) image — usually the slide background/content
  // For single-slide posters, pick the largest image
  let bestEntry = mediaEntries[0];
  let bestSize = 0;

  for (const entry of mediaEntries) {
    const buf = await entry.file.async('nodebuffer');
    if (buf.length > bestSize) {
      bestSize = buf.length;
      bestEntry = entry;
    }
  }

  const imageBuffer = await bestEntry.file.async('nodebuffer');
  
  // Determine output extension based on source
  const ext = path.extname(bestEntry.name).toLowerCase();
  const finalOutputPath = outputPath.replace(/\.png$/, ext === '.jpg' || ext === '.jpeg' ? '.jpg' : '.png');
  
  fs.writeFileSync(finalOutputPath, imageBuffer);
  return finalOutputPath;
}
