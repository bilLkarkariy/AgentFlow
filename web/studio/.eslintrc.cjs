module.exports = {
  root: true,
  extends: '../../.eslintrc.cjs',
  parserOptions: {
    project: ['./tsconfig.json'],
    tsconfigRootDir: __dirname,
  },
  ignorePatterns: ['src/**/*.stories.tsx', 'src/**/*.test.tsx'],
  rules: {
    '@typescript-eslint/no-empty-object-type': 'off',
  },
};
