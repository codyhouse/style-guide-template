// Shapes of the brand file (a DTCG 2025.10 resolver document) and of what the app derives from it.
// Token trees come from users' files: the schema check (schema.ts) validates them before anything
// reads them, so the raw tree is typed loosely and the derived values precisely.

/** A node of a raw token tree: a group or a token, as loaded. */
export type TokenNode = Record<string, any>;

export interface DtcgColor {
  colorSpace: string;
  components: Array<number | 'none'>;
  alpha?: number;
  hex?: string;
}

export interface Dimension {
  value: number;
  unit: string;
}

export interface ResolverDoc {
  $schema?: string;
  version?: string;
  name?: string;
  description?: string;
  sets: Record<string, { sources: TokenNode[]; $extensions?: Record<string, any> }>;
  modifiers?: Record<string, { contexts: Record<string, TokenNode[]>; default?: string }>;
  resolutionOrder: Array<{ $ref: string }>;
}

export interface FlatToken {
  type?: string;
  value: any;
  extensions?: Record<string, any>;
  description?: string;
}

export interface ResolvedToken extends FlatToken {
  resolved: any;
}

export type Tokens = Map<string, ResolvedToken>;

export interface AssetItem {
  src: string;
  label?: string;
  description?: string;
  provider?: string;
}

export interface AssetGroup {
  id: string;
  label?: string;
  items: AssetItem[];
}

export interface FontFile extends AssetItem {
  family: string;
  weight: number;
  style: string;
  subset?: string;
  unicodeRange?: string;
  fontsourceId?: string;
  version?: string;
}

export interface BrandMeta {
  assetGroups: AssetGroup[];
  fontFiles: FontFile[];
  [key: string]: unknown;
}

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

export interface Manifest {
  files: string[];
  brands: Array<{ name: string; path: string }>;
}
