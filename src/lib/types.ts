import type * as z from 'zod/mini';
import type { FontProvider } from '../ports.js';
import type { color } from './schema.js';

export type {
  AssetGroup,
  AssetItem,
  BrandMeta,
  FontDetail,
  FontFile,
  FontListing,
  Manifest,
  ResolverDoc,
} from './schema.js';

export type VendorData = Record<string, unknown>;

export interface TokenNode {
  $value?: unknown;
  $type?: string;
  $description?: string;
  $extensions?: Record<string, VendorData>;
  [key: string]: unknown;
}

export type DtcgColor = z.infer<typeof color>;

export interface Dimension {
  value: number;
  unit: string;
}

export interface FlatToken {
  type?: string;
  value: unknown;
  extensions?: Record<string, unknown>;
  description?: string;
}

export interface ResolvedToken extends FlatToken {
  resolved: unknown;
}

export type Tokens = Map<string, ResolvedToken>;

export type FileData = Blob | Uint8Array;
export type SessionFiles = Map<string, FileData>;

export interface AssetContext {
  session: SessionFiles;
  library: Set<string>;
  fonts: FontProvider;
}

export interface Problem {
  path?: string;
  message: string;
}

export interface ContrastResult {
  context: string;
  fg: string;
  bg: string;
  min: number;
  label: string;
  ratio: number;
  pass: boolean;
}
