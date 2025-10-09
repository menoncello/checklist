#!/usr/bin/env bun

/**
 * Comprehensive fix for all import statement issues
 */

import { readFileSync, writeFileSync } from 'fs';
import { execSync } from 'child_process';

function findTestFiles() {
  const output = execSync(
    'find . -type f \\( -name "*.test.ts" -o -name "*.test.tsx" \\) -not -path "./node_modules/*" -not -path "./.git/*" -not -path "./.bun/*" -not -path "./coverage/*" -not -path "./reports/*" -not -path "~/*" | grep -v "~/.bun/"',
    { encoding: 'utf8' }
  );
  return output.trim().split('\n').filter(Boolean);
}

function fixImports(filePath) {
  try {
    const content = readFileSync(filePath, 'utf8');
    let modified = false;

    // Fix various broken import patterns
    let newContent = content;

    // Pattern 1: import { ... } import { ... } from 'bun:test';
    newContent = newContent.replace(
      /import\s*\{\s*([^}]*)\s*\}\s*import\s*\{\s*([^}]*)\s*\}\s*from\s+['"`]bun:test['"`];\s*/g,
      "import { $1$2 } from 'bun:test';\n"
    );

    // Pattern 2: import { ... } import { ... } from 'path';
    newContent = newContent.replace(
      /import\s*\{\s*([^}]*)\s*\}\s*import\s*\{\s*([^}]*)\s*\}\s*from\s+['"`]([^'"`]+)['"`];\s*/g,
      "import { $1$2 } from '$3';\n"
    );

    // Pattern 3: import { ... } import { ... } from 'bun:test';import { ... }
    newContent = newContent.replace(
      /import\s*\{\s*([^}]*)\s*\}\s*import\s*\{\s*([^}]*)\s*\}\s*from\s+['"`]bun:test['"`];\s*import\s*\{\s*([^}]*)\s*\}/g,
      (match, first, second, third) => {
        return `import { ${first}${second}${third} } from 'bun:test';\n`;
      }
    );

    // Pattern 4: import { ... } import { ... } from 'path';import { ... }
    newContent = newContent.replace(
      /import\s*\{\s*([^}]*)\s*\}\s*import\s*\{\s*([^}]*)\s*\}\s*from\s+['"`]([^'"`]+)['"`];\s*import\s*\{\s*([^}]*)\s*\}/g,
      (match, first, second, path, third) => {
        return `import { ${first}${second}${third} } from '${path}';\n`;
      }
    );

    // Pattern 5: import { ... } import { ... } (missing from clause)
    newContent = newContent.replace(
      /import\s*\{\s*([^}]*)\s*\}\s*import\s*\{\s*([^}]*)\s*\}\s*$/gm,
      "import { $1$2 } from './';\n"
    );

    // Pattern 6: import { describe, test, expect } import { safeEval } describe
    newContent = newContent.replace(
      /import\s*\{\s*([^}]*)\s*\}\s*import\s*\{\s*([^}]*)\s*}\s*(describe|test|expect)/g,
      "import { $1$2 } from 'bun:test';\nimport { $3 } from './';\n"
    );

    // Pattern 7: import { describe, test, expect   } (extra spaces)
    newContent = newContent.replace(
      /import\s*\{\s*([^}]*)\s*\}\s*from\s+['"`]bun:test['"`];\s*/g,
      "import { $1 } from 'bun:test';\n"
    );

    // Pattern 8: import { $  /** ... */ from 'bun:test';
    newContent = newContent.replace(
      /import\s*\{\s*\$([^}]*)\s*\}\s*\/\*\*\s*[^/]*\*\/\s*from\s+['"`]bun:test['"`];\s*/g,
      "import { } from 'bun:test';\n"
    );

    // Pattern 9: import { describe, test, expect  } import { MigrationError,
    newContent = newContent.replace(
      /import\s*\{\s*([^}]*)\s*\}\s*import\s*\{\s*([^}]*?)\s*\}\s*from\s+['"`][^'"`]*['"`];\s*/g,
      (match, first, second) => {
        return `import { ${first}${second} } from 'bun:test';\n`;
      }
    );

    // Pattern 10: import { describe, test, expect  } import { safeEval
    newContent = newContent.replace(
      /import\s*\{\s*([^}]*)\s*\}\s*import\s*\{\s*([^}]*)\s*\}\s*(?=describe|test|expect|$)/g,
      (match, first, second) => {
        return `import { ${first}${second} } from 'bun:test';\n`;
      }
    );

    // Pattern 11: import { ... } from  from
    newContent = newContent.replace(
      /import\s*\{\s*([^}]*)\s*\}\s*from\s+from\s+/g,
      'import { $1 } from '
    );

    // Pattern 12: import { ... } import { ... } describe
    newContent = newContent.replace(
      /import\s*\{\s*([^}]*)\s*\}\s*import\s*\{\s*([^}]*)\s*\}\s*(describe|test|expect)/g,
      "import { $1$2 } from 'bun:test';\n"
    );

    // Pattern 13: import { ... }  describe (missing from clause)
    newContent = newContent.replace(
      /import\s*\{\s*([^}]*)\s*\}\s*(describe|test|expect)\s*{/g,
      "import { $1 } from 'bun:test';\n$2 {"
    );

    // Pattern 14: Multiple import issues in one line
    newContent = newContent.replace(
      /import\s*\{\s*[^}]*\s*\}\s*import\s*\{\s*[^}]*\s*\}\s*import\s*\{\s*[^}]*\s*\}\s*/g,
      (match) => {
        // Extract all import contents between curly braces
        const imports = match.match(/\{\s*([^}]*?)\s*\}/g);
        if (imports) {
          const allImports = imports
            .map((imp) => {
              const content = imp.match(/\{\s*([^}]*?)\s*\}/);
              return content ? content[1] : '';
            })
            .filter(Boolean)
            .join(', ');
          return `import { ${allImports} } from 'bun:test';`;
        }
        return match;
      }
    );

    // Clean up any remaining malformed patterns
    newContent = newContent.replace(/\s+from\s+/g, ' from ');
    newContent = newContent.replace(/\s*\}\s*from/g, '} from');
    newContent = newContent.replace(/from\s*from/g, 'from');

    // Only write if content changed
    if (newContent !== content) {
      writeFileSync(filePath, newContent);
      modified = true;
    }

    return { file: filePath, modified };
  } catch (error) {
    console.error(`Error fixing imports in ${filePath}:`, error.message);
    return { file: filePath, modified: false, error: error.message };
  }
}

// Main function
function main() {
  const testFiles = findTestFiles();
  console.log(`Fixing imports in ${testFiles.length} test files...`);

  let fixedCount = 0;
  let errorCount = 0;
  const problematicFiles = [];

  for (const file of testFiles) {
    const result = fixImports(file);
    if (result.modified) {
      fixedCount++;
      console.log(`✅ Fixed imports: ${file}`);
    }
    if (result.error) {
      errorCount++;
      problematicFiles.push(file);
      console.log(`❌ Error: ${file} - ${result.error}`);
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('IMPORT FIX COMPLETE');
  console.log('='.repeat(60));
  console.log(`Total files checked: ${testFiles.length}`);
  console.log(`Files fixed: ${fixedCount}`);
  console.log(`Errors encountered: ${errorCount}`);

  if (problematicFiles.length > 0) {
    console.log('\nFiles with remaining issues:');
    problematicFiles.forEach((file) => {
      console.log(`  - ${file}`);
    });
  }

  if (fixedCount > 0) {
    console.log('\n🎉 Successfully fixed import statements!');
  } else {
    console.log('\n✅ All files already have correct import syntax');
  }
}

// Run the fix
main();
