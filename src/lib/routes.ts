export function safeInternalPath(path: string | null, fallback = "/timeline") {
  if (!path || !path.startsWith("/") || path.startsWith("//")) {
    return fallback;
  }

  return path;
}
