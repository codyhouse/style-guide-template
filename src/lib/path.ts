export const fileName = (path: string) => path.slice(path.lastIndexOf('/') + 1);

export function extension(path: string) {
  const name = fileName(path);
  const dot = name.lastIndexOf('.');
  return dot < 0 ? '' : name.slice(dot + 1).toLowerCase();
}
