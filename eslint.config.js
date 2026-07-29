import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  // `.claude` holds agent worktrees — full copies of this repo, tsconfig and all.
  // Left unignored they are linted twice and their tsconfig confuses the parser's
  // root-directory detection.
  { ignores: ['dist', '.claude'] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      // Pin the root explicitly: auto-detection picks up worktree copies of
      // tsconfig.json and errors out with "multiple candidate TSConfigRootDirs".
      parserOptions: { tsconfigRootDir: import.meta.dirname },
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    },
  },
  // Module boundary: src/modules/** may only reach tenant data through TenantDb /
  // useTenant — never raw Firestore path builders, @/shared/lib/firestore, or the legacy
  // useBusiness monolith. Query operators (query/where/getDocs/…) stay allowed.
  {
    files: ['src/modules/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': ['error', {
        paths: [
          { name: '@/shared/lib/firestore', message: 'Modules must use TenantDb (col/doc), not raw collection builders.' },
          { name: '@/features/business/hooks/useBusiness', message: 'Modules must use useTenant() from BusinessContext, not the legacy monolith.' },
          {
            name: 'firebase/firestore',
            importNames: ['collection', 'doc', 'collectionGroup'],
            message: 'Build refs via TenantDb, not raw Firestore path builders.',
          },
        ],
      }],
    },
  },
);
