import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import InteractionPanel from './InteractionPanel';

beforeEach(() => {
  localStorage.clear();
});

describe('InteractionPanel', () => {
  const testId = 'ABS-0001';

  it('renders reaction emoji buttons with zero counts initially', () => {
    render(<InteractionPanel abstractId={testId} />);
    const emojis = ['👍', '❤️', '🔥', '👏', '🎯'];
    for (const emoji of emojis) {
      expect(screen.getByLabelText(`React with ${emoji}`)).toBeInTheDocument();
    }
  });

  it('increments reaction count on click', () => {
    render(<InteractionPanel abstractId={testId} />);
    const btn = screen.getByLabelText('React with 🔥');
    fireEvent.click(btn);
    expect(btn).toHaveTextContent('🔥1');
    fireEvent.click(btn);
    expect(btn).toHaveTextContent('🔥2');
  });

  it('renders like button with zero count initially', () => {
    render(<InteractionPanel abstractId={testId} />);
    const likeBtn = screen.getByLabelText(/like this poster/i);
    expect(likeBtn).toHaveTextContent('0');
  });

  it('increments like count on click', () => {
    render(<InteractionPanel abstractId={testId} />);
    const likeBtn = screen.getByLabelText(/like this poster/i);
    fireEvent.click(likeBtn);
    expect(likeBtn).toHaveTextContent('1');
  });

  it('renders comment input and post button', () => {
    render(<InteractionPanel abstractId={testId} />);
    expect(screen.getByLabelText('Comment input')).toBeInTheDocument();
    expect(screen.getByText('Post')).toBeInTheDocument();
  });

  it('adds a comment and displays it', () => {
    render(<InteractionPanel abstractId={testId} />);
    const input = screen.getByLabelText('Comment input');
    fireEvent.change(input, { target: { value: 'Great poster!' } });
    fireEvent.click(screen.getByText('Post'));
    expect(screen.getByText('Great poster!')).toBeInTheDocument();
    // Input should be cleared
    expect(input).toHaveValue('');
  });

  it('rejects whitespace-only comments', () => {
    render(<InteractionPanel abstractId={testId} />);
    const input = screen.getByLabelText('Comment input');
    fireEvent.change(input, { target: { value: '   ' } });
    fireEvent.click(screen.getByText('Post'));
    // No comment list should appear
    expect(screen.queryByRole('list', { name: 'Comment list' })).not.toBeInTheDocument();
    // Input should remain unchanged (whitespace kept)
    expect(input).toHaveValue('   ');
  });

  it('displays comments in reverse chronological order', () => {
    render(<InteractionPanel abstractId={testId} />);
    const input = screen.getByLabelText('Comment input');

    fireEvent.change(input, { target: { value: 'First comment' } });
    fireEvent.click(screen.getByText('Post'));

    fireEvent.change(input, { target: { value: 'Second comment' } });
    fireEvent.click(screen.getByText('Post'));

    const items = screen.getAllByRole('listitem');
    expect(items[0]).toHaveTextContent('Second comment');
    expect(items[1]).toHaveTextContent('First comment');
  });

  it('submits comment on Enter key', () => {
    render(<InteractionPanel abstractId={testId} />);
    const input = screen.getByLabelText('Comment input');
    fireEvent.change(input, { target: { value: 'Enter comment' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(screen.getByText('Enter comment')).toBeInTheDocument();
  });

  it('isolates interactions per abstractId', () => {
    const { unmount } = render(<InteractionPanel abstractId="ABS-001" />);
    fireEvent.click(screen.getByLabelText('React with 👍'));
    unmount();

    render(<InteractionPanel abstractId="ABS-002" />);
    const btn = screen.getByLabelText('React with 👍');
    expect(btn).toHaveTextContent('👍0');
  });
});
