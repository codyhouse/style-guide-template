export const fileName = (path: string) => path.slice(path.lastIndexOf('/') + 1);

export function extension(path: string) {
  const name = fileName(path);
  const dot = name.lastIndexOf('.');
  return dot < 0 ? '' : name.slice(dot + 1).toLowerCase();
}

export function uniquePath(path: string, taken: Set<string>): string {
  const dot = path.lastIndexOf('.');
  const hasExtension = dot > path.lastIndexOf('/') + 1;
  const stem = hasExtension ? path.slice(0, dot) : path;
  const ext = hasExtension ? path.slice(dot) : '';
  let candidate = path;
  let n = 2;
  while (taken.has(candidate)) {
    candidate = `${stem}-${n}${ext}`;
    n++;
  }
  return candidate;
}
