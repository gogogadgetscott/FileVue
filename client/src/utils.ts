const numberFormatter = new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 });

export function formatSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const index = Math.floor(Math.log(bytes) / Math.log(1024));
  const value = bytes / 1024 ** index;
  return `${numberFormatter.format(value)} ${units[index]}`;
}

export function deriveBreadcrumbs(currentPath: string): string[] {
  if (!currentPath || currentPath === '.') {
    return [];
  }
  return currentPath.split('/').filter(Boolean);
}
