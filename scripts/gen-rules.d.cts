// Type declarations for the plain-CommonJS rules generator, so the drift guard
// in src/lib/rules/generate.test.ts can import it without falling back to `any`.
// Kept alongside gen-rules.cjs so TypeScript picks it up by module resolution.

export interface DataModel {
  collection: string;
  module: string;
  custom?: boolean;
  legacyCaps?: string[];
}

export declare const MARKER_START: string;
export declare const MARKER_END: string;

/** Data models contributed by module manifests. */
export declare const MODULE_DATA_MODELS: DataModel[];
/** Data models that exist regardless of the unlock set. */
export declare const CORE_DATA_MODELS: DataModel[];
/** MODULE_DATA_MODELS + CORE_DATA_MODELS, in emit order. */
export declare const DATA_MODELS: DataModel[];

/** The generated rule block for one non-custom collection. */
export declare function standardBlock(dm: DataModel): string;

/** The full generated block for every data model, snippets substituted in. */
export declare function generateModuleRules(
  dataModels: DataModel[],
  snippets: Record<string, string>,
): string;

/** Replace the marked region of a rules file with a freshly generated block. */
export declare function spliceGeneratedRules(rules: string, generated: string): string;

/** Read back the marked region of a rules file. */
export declare function extractGeneratedRules(rules: string): string;

/** Hand-written rule snippets for collections flagged `custom`, by collection. */
export declare function loadSnippets(): Record<string, string>;
