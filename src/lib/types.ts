import type * as z from 'zod/mini';
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

// A token tree is user JSON that schema.ts has checked; its values are as varied as DTCG allows
// (colors, dimensions, aliases, composites), so they are read where used instead of typed up front.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Json = any;

export type TokenNode = Record<string, Json>;

export type DtcgColor = z.infer<typeof color>;

export interface Dimension {
  value: number;
  unit: string;
}

export interface FlatToken {
  type?: string;
  value: Json;
  extensions?: Record<string, Json>;
  description?: string;
}

export interface ResolvedToken extends FlatToken {
  resolved: Json;
}

export type Tokens = Map<string, ResolvedToken>;

export type FileData = Blob | Uint8Array;
export type SessionFiles = Map<string, FileData>;

export interface AssetContext {
  session: SessionFiles;
  library: Set<string>;
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
