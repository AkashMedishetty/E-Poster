import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

// Mock hooks and contexts before importing the component
const mockGetFileUrl = vi.fn();
const mockRevokeFileUrl = vi.fn();
const mockSendMessage = vi.fn();

vi.mock('@/contexts/LocalFilesContext', () => ({
  useLocalFiles: () => ({
    isLoaded: false,
    abstracts: [],
    getFileUrl: mockGetFileUrl,
    revokeFileUrl: mockRevokeFileUrl,
    loadDirectory: vi.fn(),
    loadSpreadsheet: vi.fn(),
  }),
}));

vi.mock('@/hooks/usePresentationSync', () => ({
  usePresentationSync: () => ({
    isConnected: false,
    error: null,
    lastSync: null,
    presentAbstract: mockSendMessage,
    closePresentation: vi.fn(),
    refresh: vi.fn(),
  }),
}));

vi.mock('@/hooks/useAutoPresentation', () => ({
  useAutoPresentation: () => ({
    isSecondScreenDetected: false,
  }),
}));

vi.mock('@/utils/cache', () => ({
  preloadImage: vi.fn(),
}));

// Mock next/image to render a plain img
vi.mock('next/image', () => ({
  default: (props: Record<string, unknown>) => {
    const { fill, ...rest } = props;
    return <img {...rest} data-fill={fill ? 'true' : undefined} />;
  },
}));

// Mock next/link
vi.mock('next/link', () => ({
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string; [key: string]: unknown }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

// Mock FileRenderer to avoid pdfjs-dist DOMMatrix issue in jsdom
vi.mock('./FileRenderer', () => ({
  default: ({ onClose }: { onClose: () => void }) => (
    <div data-testid="file-renderer">
      <button onClick={onClose}>Close FileRenderer</button>
    </div>
  ),
}));

// Mock PresentationMode and ManualPresentationMode
vi.mock('./PresentationMode', () => ({
  default: ({ onClose }: { onClose: () => void }) => (
    <div data-testid="presentation-mode">
      <button onClick={onClose}>Close Presentation</button>
    </div>
  ),
}));

vi.mock('./ManualPresentationMode', () => ({
  default: ({ onClose }: { onClose: () => void }) => (
    <div data-testid="manual-presentation-mode">
      <button onClick={onClose}>Close Manual</button>
    </div>
  ),
}));

// Mock ThemeToggle to avoid ThemeProvider dependency
vi.mock('./ThemeToggle', () => ({
  default: () => <div data-testid="theme-toggle">Theme</div>,
}));

import PosterDetail from './PosterDetail';
import type { Abstract } from '@/types/abstract';

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
});

const hardcodedAbstract: Abstract = {
  id: 'abs-1',
  title: 'Test Poster',
  author: 'Test Author',
  description: 'A test description',
  thumbnail: '/thumb.jpg',
  fileUrl: '/poster.pdf',
  fileType: 'pdf',
  source: 'hardcoded',
};

const localAbstract: Abstract = {
  id: 'local-1',
  title: 'Local Poster',
  author: 'Local Author',
  description: 'A local poster',
  thumbnail: '',
  fileUrl: '',
  fileType: 'image',
  source: 'local',
  localFileName: 'poster.jpg',
  hasFile: true,
};

describe('PosterDetail', () => {
  it('renders InteractionPanel for hardcoded abstracts', () => {
    render(<PosterDetail abstract={hardcodedAbstract} />);
    // InteractionPanel renders a "Reactions" heading
    expect(screen.getByText('Reactions')).toBeInTheDocument();
    // And a like button
    expect(screen.getByLabelText(/like this poster/i)).toBeInTheDocument();
  });

  it('renders InteractionPanel for local abstracts', () => {
    render(<PosterDetail abstract={localAbstract} />);
    expect(screen.getByText('Reactions')).toBeInTheDocument();
    expect(screen.getByLabelText(/like this poster/i)).toBeInTheDocument();
  });

  it('shows Present button for hardcoded abstracts', () => {
    render(<PosterDetail abstract={hardcodedAbstract} />);
    expect(screen.getByText('Present')).toBeInTheDocument();
    expect(screen.queryByText('Full Screen')).not.toBeInTheDocument();
  });

  it('shows Full Screen button for local abstracts', () => {
    render(<PosterDetail abstract={localAbstract} />);
    expect(screen.getByText('Full Screen')).toBeInTheDocument();
    expect(screen.queryByText('Present')).not.toBeInTheDocument();
  });

  it('shows orientation toggle for local abstracts', () => {
    render(<PosterDetail abstract={localAbstract} />);
    expect(
      screen.getByLabelText(/switch to portrait mode/i)
    ).toBeInTheDocument();
  });

  it('does not show orientation toggle for hardcoded abstracts', () => {
    render(<PosterDetail abstract={hardcodedAbstract} />);
    expect(
      screen.queryByLabelText(/switch to/i)
    ).not.toBeInTheDocument();
  });

  it('calls getFileUrl for local abstracts on mount', () => {
    render(<PosterDetail abstract={localAbstract} />);
    expect(mockGetFileUrl).toHaveBeenCalledWith('poster.jpg');
  });

  it('does not call getFileUrl for hardcoded abstracts', () => {
    render(<PosterDetail abstract={hardcodedAbstract} />);
    expect(mockGetFileUrl).not.toHaveBeenCalled();
  });

  it('renders abstract info (title, author, description)', () => {
    render(<PosterDetail abstract={hardcodedAbstract} />);
    // Title appears in both header and content section
    expect(screen.getAllByText('Test Poster').length).toBeGreaterThanOrEqual(1);
    // Author appears in both header ("by Author") and content ("Author: Author")
    expect(screen.getAllByText(/Test Author/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('A test description')).toBeInTheDocument();
  });

  it('shows loading spinner while local file URL is not yet loaded', () => {
    // getFileUrl returns a pending promise (never resolves during this test)
    mockGetFileUrl.mockReturnValue(new Promise(() => {}));
    render(<PosterDetail abstract={localAbstract} />);
    // The file content area should show a spinner (animate-spin class)
    const spinners = document.querySelectorAll('.animate-spin');
    expect(spinners.length).toBeGreaterThan(0);
  });

  it('revokes file URL on unmount for local abstracts', async () => {
    const objectUrl = 'blob:http://localhost/test-url';
    mockGetFileUrl.mockResolvedValue(objectUrl);

    const { unmount } = render(<PosterDetail abstract={localAbstract} />);

    // Wait for the effect to resolve
    await vi.waitFor(() => {
      expect(mockGetFileUrl).toHaveBeenCalled();
    });

    unmount();

    expect(mockRevokeFileUrl).toHaveBeenCalledWith(objectUrl);
  });
});
