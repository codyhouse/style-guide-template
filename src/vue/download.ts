export const blobPart = (data: string | Blob | Uint8Array): BlobPart =>
  typeof data === 'string' || data instanceof Blob ? data : new Uint8Array(data);

export function download(name: string, data: string | Uint8Array, type: string) {
  const url = URL.createObjectURL(new Blob([blobPart(data)], { type }));
  const a = Object.assign(document.createElement('a'), { href: url, download: name });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
