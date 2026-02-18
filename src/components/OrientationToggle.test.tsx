import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import OrientationToggle, {
  toggleOrientation,
  readOrientationFromStorage,
  writeOrientationToStorage,
  useOrientation,
} from './OrientationToggle';
import { renderHook, act } from '@testing-library/react';

const STORAGE_KEY = 'eposter-orientation';

beforeEach(() => {
  localStorage.clear();
});

describe('toggleOrientation', () => {
  it('toggles landscape to portrait', () => {
    expect(toggleOrientation('landscape')).toBe('portrait');
  });

  it('toggles portrait to landscape', () => {
    expect(toggleOrientation('portrait')).toBe('landscape');
  });
});

describe('readOrientationFromStorage', () => {
  it('returns landscape when nothing stored', () => {
    expect(readOrientationFromStorage()).toBe('landscape');
  });

  it('returns stored landscape value', () => {
    localStorage.setItem(STORAGE_KEY, 'landscape');
    expect(readOrientationFromStorage()).toBe('landscape');
  });

  it('returns stored portrait value', () => {
    localStorage.setItem(STORAGE_KEY, 'portrait');
    expect(readOrientationFromStorage()).toBe('portrait');
  });

  it('returns landscape for invalid stored value', () => {
    localStorage.setItem(STORAGE_KEY, 'invalid');
    expect(readOrientationFromStorage()).toBe('landscape');
  });
});

describe('writeOrientationToStorage', () => {
  it('persists landscape', () => {
    writeOrientationToStorage('landscape');
    expect(localStorage.getItem(STORAGE_KEY)).toBe('landscape');
  });

  it('persists portrait', () => {
    writeOrientationToStorage('portrait');
    expect(localStorage.getItem(STORAGE_KEY)).toBe('portrait');
  });
});

describe('useOrientation hook', () => {
  it('defaults to landscape', () => {
    const { result } = renderHook(() => useOrientation());
    expect(result.current.orientation).toBe('landscape');
  });

  it('reads initial value from localStorage', () => {
    localStorage.setItem(STORAGE_KEY, 'portrait');
    const { result } = renderHook(() => useOrientation());
    // After effect runs
    expect(result.current.orientation).toBe('portrait');
  });

  it('toggle updates state and persists', () => {
    const { result } = renderHook(() => useOrientation());
    act(() => {
      result.current.toggle('portrait');
    });
    expect(result.current.orientation).toBe('portrait');
    expect(localStorage.getItem(STORAGE_KEY)).toBe('portrait');
  });
});

describe('OrientationToggle component', () => {
  it('renders with landscape orientation', () => {
    const onToggle = vi.fn();
    render(<OrientationToggle orientation="landscape" onToggle={onToggle} />);
    const button = screen.getByRole('button', { name: /switch to portrait/i });
    expect(button).toBeInTheDocument();
  });

  it('renders with portrait orientation', () => {
    const onToggle = vi.fn();
    render(<OrientationToggle orientation="portrait" onToggle={onToggle} />);
    const button = screen.getByRole('button', { name: /switch to landscape/i });
    expect(button).toBeInTheDocument();
  });

  it('calls onToggle with portrait when clicking in landscape mode', () => {
    const onToggle = vi.fn();
    render(<OrientationToggle orientation="landscape" onToggle={onToggle} />);
    fireEvent.click(screen.getByRole('button'));
    expect(onToggle).toHaveBeenCalledWith('portrait');
  });

  it('calls onToggle with landscape when clicking in portrait mode', () => {
    const onToggle = vi.fn();
    render(<OrientationToggle orientation="portrait" onToggle={onToggle} />);
    fireEvent.click(screen.getByRole('button'));
    expect(onToggle).toHaveBeenCalledWith('landscape');
  });

  it('persists to localStorage on click', () => {
    const onToggle = vi.fn();
    render(<OrientationToggle orientation="landscape" onToggle={onToggle} />);
    fireEvent.click(screen.getByRole('button'));
    expect(localStorage.getItem(STORAGE_KEY)).toBe('portrait');
  });
});
