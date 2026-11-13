import type { FileData, FontDetail, FontFile, FontListing, ResolverDoc } from './lib/types.js';

export type KeyValueStore = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export interface FileStore {
  put(path: string, data: FileData): Promise<unknown>;
  delete(path: string): Promise<unknown>;
  clear(): Promise<unknown>;
  getAll(): Promise<Map<string, FileData>>;
}

export interface FontPicks {
  weights: number[];
  styles: string[];
  subsets: string[];
}

export interface FontProvider {
  readonly id: string;
  readonly name: string;
  list(): Promise<FontListing[]>;
  font(id: string): Promise<FontDetail>;
  files(font: FontDetail, picks: FontPicks): FontFile[];
  fileUrl(file: FontFile): string;
  licenseUrl(file: FontFile): string;
}

export interface ExportFormat {
  readonly key: string;
  readonly label: string;
  render(doc: ResolverDoc, vendor: string): string;
}
