import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';

// Mock usePresentationSync
let capturedOnPresentationChange: ((data: PresentationData | null) => void) | undefined;

interface PresentationData {
  id: string;
  title: string;
  author: string;
  fileUrl: string;
  fileType: string;
  localFileName?: string;
  isLocalFile?: boolean;
  localFileData?: string;
}

vi.mock('@/hooks/usePresentationSync', () => ({
  usePresentationSync: ({ onPresentationChange }: { onPresentationChange?: (data: PresentationData | null) => void }) => {
    capturedOnPresentationChange = onPresentationChange;
    return {
      isConnected: true,
      error: null,
      lastSync: Date.now(),
      presentAbstract: vi.fn(),
      closePresentation: vi.fn(),
      refresh: vi.fn(),
    };
  },
}));

// Mock FileRenderer
vi.mock('@/components/FileRenderer', () => ({
  default: (props: { fileType: string; orientation: string; fileObjectUrl: string; onClose: () => void; onOrientationChange: (o: string) => void }) => (
    <div data-testid="file-renderer">
      <span data-testid="fr-file-type">{props.fileType}</span>
      <span data-testid="fr-orientation">{props.orientation}</span>
      <span data-testid="fr-url">{props.fileObjectUrl}</span>
      <button data-testid="fr-close" onClick={props.onClose}>Close</button>
      <button data-testid="fr-orient" onClick={() => props.onOrientationChange('portrait')}>Orient</button>
    </div>
  ),
}));

// Mock OrientationToggle
vi.mock('@/components/OrientationToggle', () => ({
  default: (props: { orientation: string; onToggle: (o: string) => void }) => (
    <button data-testid="orientation-toggle" onClick={() => props.onToggle('portrait')}>
      {props.orientation}
    </button>
  ),
  useOrientation: () => ({
    orientation: 'landscape' as const,
    toggle: vi.fn(),
  }),
}));

// Mock fullscreen API
beforeEach(() => {
  vi.clearAllMocks();
  capturedOnPresentationChange = undefined;
  Object.defineProperty(document, 'fullscreenElement', { value: null, writable: true, configurable: true });
  document.exitFullscreen = vi.fn().mockResolvedValue(undefined);
  document.documentElement.requestFullscreen = vi.fn().mockResolvedValue(undefined);
});

import BigScreenPage from './page';

describe('BigScreenPage', () => {
  it('renders waiting screen when no abstract is presented', () => {
    render(<BigScreenPage />);
    expect(screen.getByText('E-Poster Big Screen')).toBeInTheDocument();
    expect(screen.getByText('Ready to receive presentations')).toBeInTheDocument();
  });

  it('renders non-local image with existing inline rendering', () => {
    render(<BigScreenPage />);
    act(() => {
      capturedOnPresentationChange?.({
        id: '1',
        title: 'Test Poster',
        author: 'Author',
        fileUrl: '/posters/test.jpg',
        fileType: 'image',
      });
    });
    const img = screen.getByAltText('Test Poster');
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute('src', '/posters/test.jpg');
    // Should NOT use FileRenderer
    expect(screen.queryByTestId('file-renderer')).not.toBeInTheDocument();
  });

  it('renders local file with FileRenderer', () => {
    render(<BigScreenPage />);
    act(() => {
      capturedOnPresentationChange?.({
        id: '2',
        title: 'Local Poster',
        author: 'Author',
        fileUrl: 'data:image/png;base64,abc123',
        fileType: 'image',
        localFileName: 'poster.png',
        isLocalFile: true,
        localFileData: 'data:image/png;base64,abc123',
      });
    });
    expect(screen.getByTestId('file-renderer')).toBeInTheDocument();
    expect(screen.getByTestId('fr-file-type')).toHaveTextContent('image');
    expect(screen.getByTestId('fr-url')).toHaveTextContent('data:image/png;base64,abc123');
  });

  it('renders local PDF with FileRenderer', () => {
    render(<BigScreenPage />);
    act(() => {
      capturedOnPresentationChange?.({
        id: '3',
        title: 'Local PDF',
        author: 'Author',
        fileUrl: 'data:application/pdf;base64,xyz',
        fileType: 'pdf',
        localFileName: 'doc.pdf',
        isLocalFile: true,
        localFileData: 'data:application/pdf;base64,xyz',
      });
    });
    expect(screen.getByTestId('file-renderer')).toBeInTheDocument();
    expect(screen.getByTestId('fr-file-type')).toHaveTextContent('pdf');
  });

  it('clears local file state on null presentation (close)', () => {
    render(<BigScreenPage />);
    act(() => {
      capturedOnPresentationChange?.({
        id: '2',
        title: 'Local Poster',
        author: 'Author',
        fileUrl: 'data:image/png;base64,abc',
        fileType: 'image',
        isLocalFile: true,
        localFileData: 'data:image/png;base64,abc',
      });
    });
    expect(screen.getByTestId('file-renderer')).toBeInTheDocument();

    act(() => {
      capturedOnPresentationChange?.(null);
    });
    expect(screen.queryByTestId('file-renderer')).not.toBeInTheDocument();
    expect(screen.getByText('E-Poster Big Screen')).toBeInTheDocument();
  });

  it('FileRenderer onClose clears the presentation', () => {
    render(<BigScreenPage />);
    act(() => {
      capturedOnPresentationChange?.({
        id: '2',
        title: 'Local Poster',
        author: 'Author',
        fileUrl: 'data:image/png;base64,abc',
        fileType: 'image',
        isLocalFile: true,
        localFileData: 'data:image/png;base64,abc',
      });
    });
    fireEvent.click(screen.getByTestId('fr-close'));
    expect(screen.queryByTestId('file-renderer')).not.toBeInTheDocument();
  });

  it('shows orientation toggle for non-local files', () => {
    render(<BigScreenPage />);
    act(() => {
      capturedOnPresentationChange?.({
        id: '1',
        title: 'Test',
        author: 'Author',
        fileUrl: '/test.jpg',
        fileType: 'image',
      });
    });
    expect(screen.getByTestId('orientation-toggle')).toBeInTheDocument();
  });

  it('passes orientation to FileRenderer for local files', () => {
    render(<BigScreenPage />);
    act(() => {
      capturedOnPresentationChange?.({
        id: '2',
        title: 'Local',
        author: 'Author',
        fileUrl: 'data:image/png;base64,abc',
        fileType: 'image',
        isLocalFile: true,
        localFileData: 'data:image/png;base64,abc',
      });
    });
    expect(screen.getByTestId('fr-orientation')).toHaveTextContent('landscape');
  });

  it('ESC key clears local file presentation', () => {
    render(<BigScreenPage />);
    act(() => {
      capturedOnPresentationChange?.({
        id: '2',
        title: 'Local',
        author: 'Author',
        fileUrl: 'data:image/png;base64,abc',
        fileType: 'image',
        isLocalFile: true,
        localFileData: 'data:image/png;base64,abc',
      });
    });
    expect(screen.getByTestId('file-renderer')).toBeInTheDocument();

    // Note: ESC is handled by FileRenderer's onClose in local mode,
    // but the page also has its own ESC handler
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByTestId('file-renderer')).not.toBeInTheDocument();
  });
});
