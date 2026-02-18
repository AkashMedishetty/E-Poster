'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Abstract } from '@/types/abstract';
import { convertPptxToRenderable } from '@/utils/pptxConverter';
import type * as PdfjsLibType from 'pdfjs-dist';

// Lazy-loaded pdfjs-dist to avoid SSR DOMMatrix error
let pdfjsLib: typeof PdfjsLibType | null = null;
const getPdfjsLib = async () => {
  if (!pdfjsLib) {
    pdfjsLib = await import('pdfjs-dist');
    pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;
  }
  return pdfjsLib;
};

export interface FileRendererProps {
  abstractEntry: Abstract;
  fileObjectUrl: string | null;
  fileType: 'image' | 'pdf' | 'document';
  orientation: 'landscape' | 'portrait';
  onClose: () => void;
  onOrientationChange: (orientation: 'landscape' | 'portrait') => void;
}

export default function FileRenderer({
  abstractEntry,
  fileObjectUrl,
  fileType,
  orientation,
  onClose,
  onOrientationChange,
}: FileRendererProps) {
  // PDF state
  const [pdfDoc, setPdfDoc] = useState<PdfjsLibType.PDFDocumentProxy | null>(null);
  const [pdfPage, setPdfPage] = useState(1);
  const [pdfTotalPages, setPdfTotalPages] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // PPTX slideshow state
  const [slideImages, setSlideImages] = useState<string[]>([]);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [pptxLoading, setPptxLoading] = useState(false);
  const [pptxError, setPptxError] = useState<string | null>(null);

  // Determine if this is a legacy PPT or PPTX file
  // Check localFileName first, then fall back to fileUrl for non-local files
  const fileName = abstractEntry.localFileName || abstractEntry.fileUrl || '';
  const fileNameLower = fileName.toLowerCase();
  const isLegacyPpt = fileNameLower.endsWith('.ppt');
  const isPptx = fileNameLower.endsWith('.pptx') || (fileType === 'document' && !fileNameLower.endsWith('.ppt'));

  // ESC key handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Load PDF document when fileObjectUrl changes
  useEffect(() => {
    if (fileType !== 'pdf' || !fileObjectUrl) return;

    let cancelled = false;
    const loadPdf = async () => {
      try {
        const pdfjs = await getPdfjsLib();
        const doc = await pdfjs.getDocument(fileObjectUrl).promise;
        if (!cancelled) {
          setPdfDoc(doc);
          setPdfTotalPages(doc.numPages);
          setPdfPage(1);
        }
      } catch (err) {
        console.error('Failed to load PDF:', err);
      }
    };
    loadPdf();

    return () => {
      cancelled = true;
    };
  }, [fileType, fileObjectUrl]);

  // Render current PDF page to canvas
  const renderPdfPage = useCallback(async () => {
    if (!pdfDoc || !canvasRef.current) return;

    try {
      const page = await pdfDoc.getPage(pdfPage);
      const canvas = canvasRef.current;

      // Calculate scale to fit viewport
      const viewport = page.getViewport({ scale: 1 });
      const containerWidth = window.innerWidth;
      const containerHeight = window.innerHeight;
      const scaleX = containerWidth / viewport.width;
      const scaleY = containerHeight / viewport.height;
      const scale = Math.min(scaleX, scaleY);

      const scaledViewport = page.getViewport({ scale });
      canvas.width = scaledViewport.width;
      canvas.height = scaledViewport.height;

      await page.render({
        canvas,
        viewport: scaledViewport,
      }).promise;
    } catch (err) {
      console.error('Failed to render PDF page:', err);
    }
  }, [pdfDoc, pdfPage]);

  useEffect(() => {
    renderPdfPage();
  }, [renderPdfPage]);

  // Load PPTX slide images
  useEffect(() => {
    if (!isPptx || !fileObjectUrl) return;

    let cancelled = false;
    const loadPptx = async () => {
      setPptxLoading(true);
      setPptxError(null);
      try {
        const response = await fetch(fileObjectUrl);
        const blob = await response.blob();
        const file = new File([blob], fileName, { type: blob.type });
        const result = await convertPptxToRenderable(file);

        if (cancelled) return;

        if (result.slideImages && result.slideImages.length > 0) {
          const urls = result.slideImages.map((img) => URL.createObjectURL(img));
          setSlideImages(urls);
          setCurrentSlide(0);
        } else {
          setPptxError('No slide images found in this PPTX file.');
        }
      } catch (err) {
        if (!cancelled) {
          console.error('Failed to convert PPTX:', err);
          setPptxError('Could not render this PPTX file.');
        }
      } finally {
        if (!cancelled) setPptxLoading(false);
      }
    };
    loadPptx();

    return () => {
      cancelled = true;
      // Revoke slide image URLs on cleanup
      slideImages.forEach((url) => URL.revokeObjectURL(url));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPptx, fileObjectUrl, fileName]);

  // Orientation CSS transform
  const orientationStyle: React.CSSProperties =
    orientation === 'portrait'
      ? { transform: 'rotate(90deg)', transformOrigin: 'center center' }
      : {};

  // --- Render functions ---

  const renderImage = () => (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#000',
      }}
    >
      {fileObjectUrl && (
        <img
          src={fileObjectUrl}
          alt={abstractEntry.title}
          style={{
            maxWidth: '100%',
            maxHeight: '100%',
            objectFit: 'contain',
            ...orientationStyle,
          }}
        />
      )}
    </div>
  );

  const renderPdf = () => (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#000',
        position: 'relative',
      }}
    >
      <canvas
        ref={canvasRef}
        style={{
          maxWidth: '100%',
          maxHeight: '100%',
          ...orientationStyle,
        }}
      />
      {pdfTotalPages > 1 && (
        <div
          style={{
            position: 'absolute',
            bottom: 24,
            left: '50%',
            transform: 'translateX(-50%)',
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            backgroundColor: 'rgba(0,0,0,0.7)',
            padding: '8px 20px',
            borderRadius: 8,
          }}
        >
          <button
            onClick={() => setPdfPage((p) => Math.max(1, p - 1))}
            disabled={pdfPage <= 1}
            style={{
              color: pdfPage <= 1 ? '#666' : '#fff',
              background: 'none',
              border: 'none',
              fontSize: 20,
              cursor: pdfPage <= 1 ? 'default' : 'pointer',
              padding: '4px 12px',
            }}
            aria-label="Previous page"
          >
            ◀
          </button>
          <span style={{ color: '#fff', fontSize: 14 }}>
            {pdfPage} / {pdfTotalPages}
          </span>
          <button
            onClick={() => setPdfPage((p) => Math.min(pdfTotalPages, p + 1))}
            disabled={pdfPage >= pdfTotalPages}
            style={{
              color: pdfPage >= pdfTotalPages ? '#666' : '#fff',
              background: 'none',
              border: 'none',
              fontSize: 20,
              cursor: pdfPage >= pdfTotalPages ? 'default' : 'pointer',
              padding: '4px 12px',
            }}
            aria-label="Next page"
          >
            ▶
          </button>
        </div>
      )}
    </div>
  );

  const renderPptxSlideshow = () => {
    if (pptxLoading) {
      return (
        <div
          style={{
            width: '100vw',
            height: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#000',
            color: '#fff',
            fontSize: 18,
          }}
        >
          Loading slides...
        </div>
      );
    }

    if (pptxError) {
      return (
        <div
          style={{
            width: '100vw',
            height: '100vh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#000',
            color: '#fff',
          }}
        >
          <p style={{ fontSize: 20, marginBottom: 16 }}>{pptxError}</p>
          {fileObjectUrl && (
            <a
              href={fileObjectUrl}
              download={fileName}
              style={{
                padding: '10px 24px',
                backgroundColor: '#3b82f6',
                color: '#fff',
                borderRadius: 8,
                textDecoration: 'none',
                fontSize: 16,
              }}
            >
              Download File
            </a>
          )}
        </div>
      );
    }

    if (slideImages.length === 0) return null;

    return (
      <div
        style={{
          width: '100vw',
          height: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#000',
          position: 'relative',
        }}
      >
        <img
          src={slideImages[currentSlide]}
          alt={`Slide ${currentSlide + 1}`}
          style={{
            maxWidth: '100%',
            maxHeight: '100%',
            objectFit: 'contain',
            ...orientationStyle,
          }}
        />
        {slideImages.length > 1 && (
          <div
            style={{
              position: 'absolute',
              bottom: 24,
              left: '50%',
              transform: 'translateX(-50%)',
              display: 'flex',
              alignItems: 'center',
              gap: 16,
              backgroundColor: 'rgba(0,0,0,0.7)',
              padding: '8px 20px',
              borderRadius: 8,
            }}
          >
            <button
              onClick={() => setCurrentSlide((s) => Math.max(0, s - 1))}
              disabled={currentSlide <= 0}
              style={{
                color: currentSlide <= 0 ? '#666' : '#fff',
                background: 'none',
                border: 'none',
                fontSize: 20,
                cursor: currentSlide <= 0 ? 'default' : 'pointer',
                padding: '4px 12px',
              }}
              aria-label="Previous slide"
            >
              ◀
            </button>
            <span style={{ color: '#fff', fontSize: 14 }}>
              {currentSlide + 1} / {slideImages.length}
            </span>
            <button
              onClick={() => setCurrentSlide((s) => Math.min(slideImages.length - 1, s + 1))}
              disabled={currentSlide >= slideImages.length - 1}
              style={{
                color: currentSlide >= slideImages.length - 1 ? '#666' : '#fff',
                background: 'none',
                border: 'none',
                fontSize: 20,
                cursor: currentSlide >= slideImages.length - 1 ? 'default' : 'pointer',
                padding: '4px 12px',
              }}
              aria-label="Next slide"
            >
              ▶
            </button>
          </div>
        )}
      </div>
    );
  };

  const renderLegacyPpt = () => (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#000',
        color: '#fff',
      }}
    >
      <p style={{ fontSize: 22, marginBottom: 8 }}>Unsupported Format</p>
      <p style={{ fontSize: 16, color: '#aaa', marginBottom: 24 }}>
        Only PPTX format is supported for in-app rendering. This file is a legacy PPT file.
      </p>
      {fileObjectUrl && (
        <a
          href={fileObjectUrl}
          download={fileName}
          style={{
            padding: '10px 24px',
            backgroundColor: '#3b82f6',
            color: '#fff',
            borderRadius: 8,
            textDecoration: 'none',
            fontSize: 16,
          }}
        >
          Download File
        </a>
      )}
    </div>
  );

  const renderContent = () => {
    if (!fileObjectUrl) {
      return (
        <div
          style={{
            width: '100vw',
            height: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#000',
            color: '#fff',
            fontSize: 18,
          }}
        >
          No file available to display.
        </div>
      );
    }

    if (fileType === 'image') return renderImage();
    if (fileType === 'pdf') return renderPdf();

    // Document type — distinguish PPTX vs legacy PPT
    if (fileType === 'document') {
      if (isLegacyPpt) return renderLegacyPpt();
      if (isPptx) return renderPptxSlideshow();
      // Fallback for unknown document types
      return renderLegacyPpt();
    }

    return null;
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        zIndex: 9999,
        backgroundColor: '#000',
        overflow: 'hidden',
      }}
    >
      {renderContent()}
    </div>
  );
}
