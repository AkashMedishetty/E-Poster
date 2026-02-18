import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import AbstractCard from './AbstractCard';
import { Abstract } from '@/types/abstract';

// Mock next/image
vi.mock('next/image', () => ({
  default: (props: Record<string, unknown>) => <img {...props} />,
}));

// Mock next/link
vi.mock('next/link', () => ({
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string; [key: string]: unknown }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

// Mock interactionStore
vi.mock('@/utils/interactionStore', () => ({
  getInteractions: vi.fn(),
}));

import { getInteractions } from '@/utils/interactionStore';

const mockGetInteractions = vi.mocked(getInteractions);

const baseAbstract: Abstract = {
  id: 'abs-001',
  title: 'Test Poster',
  author: 'Test Author',
  description: 'A test description',
  thumbnail: '/test-thumb.jpg',
  fileUrl: '/test.pdf',
  fileType: 'pdf',
};

describe('AbstractCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('displays like count badge when likes > 0', () => {
    mockGetInteractions.mockReturnValue({
      abstractId: 'abs-001',
      reactions: {},
      comments: [],
      likes: 5,
    });

    render(<AbstractCard abstract={baseAbstract} />);

    expect(screen.getByText('5')).toBeDefined();
  });

  it('does not display like count badge when likes is 0', () => {
    mockGetInteractions.mockReturnValue({
      abstractId: 'abs-001',
      reactions: {},
      comments: [],
      likes: 0,
    });

    render(<AbstractCard abstract={baseAbstract} />);

    expect(screen.queryByText('0')).toBeNull();
  });

  it('calls getInteractions with the abstract id', () => {
    mockGetInteractions.mockReturnValue({
      abstractId: 'abs-001',
      reactions: {},
      comments: [],
      likes: 3,
    });

    render(<AbstractCard abstract={baseAbstract} />);

    expect(mockGetInteractions).toHaveBeenCalledWith('abs-001');
  });

  it('still renders title, author, and description', () => {
    mockGetInteractions.mockReturnValue({
      abstractId: 'abs-001',
      reactions: {},
      comments: [],
      likes: 0,
    });

    render(<AbstractCard abstract={baseAbstract} />);

    expect(screen.getByText('Test Poster')).toBeDefined();
    expect(screen.getByText('Test Author')).toBeDefined();
    expect(screen.getByText('A test description')).toBeDefined();
  });
});
