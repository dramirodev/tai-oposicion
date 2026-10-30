import eslintConfigPrettier from 'eslint-config-prettier/flat';
import importPlugin from 'eslint-plugin-import';
import reactHooks from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: [
    'dist/**', 'node_modules/**', 'tests/**', 'public/**', 'scripts/**',
    'src/core/application/legacy-*.ts',
    'src/legacy/**', 'src/features/**/legacy.ts',
    'src/app/legacy-router.ts',
  ] },
  ...tseslint.configs.recommended,
  {
    files: ['src/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-syntax': ['error',
        { selector: "JSXAttribute[name.name='dangerouslySetInnerHTML']", message: 'Usa shared/ui/CodeText para insertar HTML escapado.' },
        { selector: "Property[key.name='dangerouslySetInnerHTML']", message: 'Usa shared/ui/CodeText para insertar HTML escapado.' },
      ],
    },
  },
  {
    files: ['src/core/domain/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-globals': ['error', 'window', 'document', 'navigator', 'localStorage', 'indexedDB', 'fetch'],
      'no-restricted-properties': ['error',
        { object: 'Date', property: 'now', message: 'Inyecta el reloj como parámetro.' },
        { object: 'Math', property: 'random', message: 'Inyecta el generador aleatorio como parámetro.' },
      ],
      'no-restricted-syntax': ['error', { selector: "NewExpression[callee.name='Date'][arguments.length=0]", message: 'Pasa el instante como parámetro.' }],
    },
  },
  {
    files: ['src/core/{domain,application,ports}/**/*.{ts,tsx}'],
    rules: { 'no-restricted-imports': ['error', { patterns: [
      { group: ['**/adapters/**', '**/app/**', '**/features/**', '**/shared/**'], message: 'core solo puede depender de core/domain, core/application y core/ports.' },
      { group: ['**/dto/**', '**/view-models/**'], message: 'Los DTO y view models no cruzan al core.' },
      { group: ['react', 'react/**', 'firebase', 'firebase/**', 'zustand', 'zustand/**', 'idb', 'idb/**', 'zod', 'zod/**'], message: 'core no depende de frameworks ni SDK externos.' },
    ] }] },
  },
  {
    files: ['src/adapters/**/*.{ts,tsx}'],
    rules: { 'no-restricted-imports': ['error', { patterns: [
      { group: ['**/app/**', '**/features/**', '**/shared/**', '**/core/application/**', '**/view-models/**'], message: 'Un adaptador solo depende de core/domain, core/ports y de otro adaptador.' },
    ] }] },
  },
  {
    files: ['src/features/**/*.{ts,tsx}'],
    rules: { 'no-restricted-imports': ['error', { patterns: [
      { group: ['**/adapters/**', '**/app/**', '**/dto/**'], message: 'Una feature no importa adaptadores ni DTO.' },
    ] }] },
  },
  {
    files: ['src/shared/**/*.{ts,tsx}'],
    rules: { 'no-restricted-imports': ['error', { patterns: [
      { group: ['**/adapters/**', '**/app/**', '**/dto/**'], message: 'shared no depende de infraestructura ni de DTO.' },
    ] }] },
  },
  {
    files: ['src/app/**/*.{ts,tsx}'],
    rules: { 'no-restricted-imports': ['error', { patterns: [
      { group: ['**/dto/**', '**/view-models/**'], message: 'app compone adaptadores, no sus DTO ni view models.' },
    ] }] },
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    plugins: { import: importPlugin, 'react-hooks': reactHooks },
    settings: { 'import/resolver': { typescript: { project: './tsconfig.json' } } },
    rules: {
      'import/no-cycle': ['error', { ignoreExternal: true }],
      'import/no-restricted-paths': ['error', { zones: [
        ...['./src/core/**'].flatMap(target => ['adapters', 'app', 'features', 'shared'].map(layer => ({ target, from: `./src/${layer}/**`, message: 'core solo depende hacia dentro.' }))),
        ...['./src/adapters/**'].flatMap(target => ['app', 'features', 'shared'].map(layer => ({ target, from: `./src/${layer}/**`, message: 'Los adaptadores no dependen de capas exteriores.' }))),
        { target: './src/features/**', from: './src/adapters/**', message: 'Las features usan casos de uso, no adaptadores.' },
        { target: './src/features/**', from: './src/app/**', message: 'Las features no dependen de la composición app.' },
        { target: './src/core/**', from: './src/adapters/*/dto/**', message: 'Los DTO solo se importan dentro de adapters.' },
        { target: './src/core/**', from: './src/features/*/view-models/**', message: 'El core no importa view models.' },
        { target: './src/adapters/**', from: './src/core/application/**', message: 'Los adaptadores implementan puertos, no orquestan casos de uso.' },
        { target: './src/adapters/**', from: './src/features/*/view-models/**', message: 'Los adaptadores no importan view models.' },
        { target: './src/features/**', from: './src/adapters/*/dto/**', message: 'Las features solo consumen entidades del dominio.' },
        { target: './src/shared/**', from: './src/adapters/*/dto/**', message: 'shared no importa DTO.' },
        { target: './src/shared/{hooks,presentation}/**', from: './src/features/**', message: 'shared/hooks y shared/presentation no dependen de features.' },
        ...['./src/shared/**'].flatMap(target => ['adapters', 'app'].map(layer => ({ target, from: `./src/${layer}/**`, message: 'shared no depende de infraestructura ni app.' }))),
        { target: './src/app/**', from: './src/adapters/*/dto/**', message: 'app usa puertos; DTO solo circulan dentro de adapters.' },
        { target: './src/app/**', from: './src/features/*/view-models/**', message: 'app no consume view models de pantalla.' },
        { target: './src/shared/presentation/**', from: './src/features/*/view-models/**', message: 'shared/presentation no depende de view models.' },
        { target: './src/shared/hooks/**', from: './src/features/*/view-models/**', message: 'shared/hooks no depende de view models.' },
      ] }],
      ...reactHooks.configs.flat.recommended.rules,
    },
  },
  eslintConfigPrettier,
);
