export function appBaseUrl(base: string, currentUrl: string): URL {
  return new URL(base, currentUrl);
}
