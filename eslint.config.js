import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import lit from 'eslint-plugin-lit';
import prettier from 'eslint-config-prettier';
import globals from 'globals';

export default tseslint.config(
  { ignores: ['dist'] },
  js.configs.recommended,
  ...tseslint.configs.strict,
  lit.configs['flat/recommended'],
  prettier,
  { languageOptions: { globals: { ...globals.browser, ...globals.node } } },
);
