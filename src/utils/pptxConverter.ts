import JSZip from 'jszip';

export interface ConversionResult {
  type: 'pdf' | 'images';
  pdfBlob?: Blob;
  slideImages?: Blob[];
}

const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.tiff', '.emf', '.wmf'];

function isImageFile(filename: string): boolean {
  const lower = filename.toLowerCase();
  return IMAGE_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

/**
 * Converts a PPTX file to a renderable format by extracting slide images
 * from the ppt/media/ directory inside the PPTX (ZIP) archive.
 *
 * Returns slide images sorted by filename to maintain slide order.
 * If no images are found, returns an empty images array.
 */
export async function convertPptxToRenderable(file: File): Promise<ConversionResult> {
  const arrayBuffer = await file.arrayBuffer();
  const zip = await JSZip.loadAsync(arrayBuffer);

  const mediaEntries: { name: string; file: JSZip.JSZipObject }[] = [];

  zip.forEach((relativePath, zipEntry) => {
    if (
      !zipEntry.dir &&
      relativePath.startsWith('ppt/media/') &&
      isImageFile(relativePath)
    ) {
      mediaEntries.push({ name: relativePath, file: zipEntry });
    }
  });

  // Sort by filename to maintain slide order
  mediaEntries.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));

  const slideImages: Blob[] = await Promise.all(
    mediaEntries.map(async (entry) => {
      const data = await entry.file.async('blob');
      return data;
    })
  );

  return {
    type: 'images',
    slideImages,
  };
}
