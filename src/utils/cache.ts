// Simple in-memory cache for images and files
class Cache<T> {
  private cache = new Map<string, T>();
  private maxSize = 100; // Maximum number of items to cache

  set(key: string, value: T): void {
    // If cache is full, remove oldest item
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey !== undefined) {
        this.cache.delete(firstKey);
      }
    }
    this.cache.set(key, value);
  }

  get(key: string): T | undefined {
    return this.cache.get(key);
  }

  has(key: string): boolean {
    return this.cache.has(key);
  }

  clear(): void {
    this.cache.clear();
  }

  size(): number {
    return this.cache.size;
  }
}

// Global cache instance
export const imageCache = new Cache<HTMLImageElement>();
export const fileCache = new Cache<Blob>();

// Preload images for better performance
export async function preloadImage(src: string): Promise<void> {
  if (imageCache.has(src)) {
    return;
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      imageCache.set(src, img);
      resolve();
    };
    img.onerror = reject;
    img.src = src;
  });
}

// Preload multiple images
export async function preloadImages(srcs: string[]): Promise<void> {
  const promises = srcs.map(src => preloadImage(src));
  await Promise.allSettled(promises);
}
