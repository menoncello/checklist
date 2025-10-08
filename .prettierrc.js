export default {
  // Basic formatting (MANDATORY)
  semi: true,
  singleQuote: true,
  tabWidth: 2,
  useTabs: false,
  trailingComma: 'es5',

  // Line length for readability (MANDATORY)
  printWidth: 80,

  // Specific overrides - CRITICAL: Set parsers for different file types
  overrides: [
    {
      files: '*.{ts,tsx,js,jsx}',
      options: {
        parser: 'typescript',
      },
    },
    {
      files: '*.md',
      options: {
        parser: 'markdown',
        printWidth: 100,
        proseWrap: 'preserve',
      },
    },
    {
      files: '*.{json,jsonc}',
      options: {
        parser: 'json',
        tabWidth: 2,
      },
    },
    {
      files: '*.{yaml,yml}',
      options: {
        parser: 'yaml',
        tabWidth: 2,
      },
    },
  ],
};
