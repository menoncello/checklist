module.exports = {
  // Basic formatting (MANDATORY)
  semi: true,
  singleQuote: true,
  tabWidth: 2,
  useTabs: false,
  trailingComma: 'es5',

  // Line length for readability (MANDATORY)
  printWidth: 80,

  // TypeScript specific (MANDATORY)
  parser: 'typescript',

  // Specific overrides
  overrides: [
    {
      files: '*.md',
      options: {
        printWidth: 100,
        proseWrap: 'preserve'
      }
    }
  ]
};