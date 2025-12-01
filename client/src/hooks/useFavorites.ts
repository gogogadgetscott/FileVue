import { useState, useEffect, useCallback } from 'react';

const FAVORITES_KEY = 'filevue_favorites';

export interface Favorite {
  path: string;
  name: string;
  isDirectory: boolean;
  addedAt: number;
}

export function useFavorites() {
  const [favorites, setFavorites] = useState<Favorite[]>([]);

  // Load favorites from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(FAVORITES_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as Favorite[];
        setFavorites(parsed);
      }
    } catch {
      // If parsing fails, start with empty favorites
      setFavorites([]);
    }
  }, []);

  // Save favorites to localStorage whenever they change
  useEffect(() => {
    try {
      localStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites));
    } catch {
      // Ignore storage errors
    }
  }, [favorites]);

  const addFavorite = useCallback((path: string, name: string, isDirectory: boolean) => {
    setFavorites((prev) => {
      // Don't add if already exists
      if (prev.some((f) => f.path === path)) {
        return prev;
      }
      return [...prev, { path, name, isDirectory, addedAt: Date.now() }];
    });
  }, []);

  const removeFavorite = useCallback((path: string) => {
    setFavorites((prev) => prev.filter((f) => f.path !== path));
  }, []);

  const toggleFavorite = useCallback((path: string, name: string, isDirectory: boolean) => {
    setFavorites((prev) => {
      const exists = prev.some((f) => f.path === path);
      if (exists) {
        return prev.filter((f) => f.path !== path);
      }
      return [...prev, { path, name, isDirectory, addedAt: Date.now() }];
    });
  }, []);

  const isFavorite = useCallback((path: string) => {
    return favorites.some((f) => f.path === path);
  }, [favorites]);

  const clearFavorites = useCallback(() => {
    setFavorites([]);
  }, []);

  return {
    favorites,
    addFavorite,
    removeFavorite,
    toggleFavorite,
    isFavorite,
    clearFavorites,
  };
}
