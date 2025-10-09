#!/usr/bin/env bun

/**
 * Final cleanup of remaining import statement issues
 */

import { readFileSync, writeFileSync } from 'fs';
import { execSync } from 'child_process';

function findProblematicFiles() {
  const output = execSync(
    'find . -type f \\( -name "*.test.ts" -o -name "*.test.tsx" \\) -not -path "./node_modules/*" -not -path "./.git/*" -not -path "./.bun/*" -not -path "./coverage/*" -not -path "./reports/*" -not -path "~/*" | grep -v "~/.bun/"',
    { encoding: 'utf8' }
  );
  return output.trim().split('\n').filter(Boolean);
}

function finalImportCleanup(filePath) {
  try {
    const content = readFileSync(filePath, 'utf8');
    let newContent = content;
    let modified = false;

    // Pattern 1: Malformed namespace imports like "import { * as fs from 'fs';} from 'bun:test';"
    newContent = newContent.replace(
      /import\s*\{\s*\*\s*as\s+(\w+)\s+from\s+['"`]([^'"`]*)['"`];\s*\}\s*from\s+['"`]bun:test['"`];/g,
      "import * as $1 from '$2';"
    );

    // Pattern 2: Mixed imports like "import { existsSync, readFileSync  import { join} from 'path';"
    newContent = newContent.replace(
      /import\s*\{\s*([^}]*)\s+import\s*\{\s*([^}]*)\s*\}\s*from\s+['"`]([^'"`]*)['"`];/g,
      "import { $1$2 } from '$3';"
    );

    // Pattern 3: Incomplete imports like "import { safeEval  describe('conditions', () => {"
    newContent = newContent.replace(
      /import\s*\{\s*([^}]*)\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/g,
      (match, imports, funcName) => {
        return `import { ${imports} } from 'bun:test';\n${funcName}(`;
      }
    );

    // Pattern 4: Mixed imports with function calls
    newContent = newContent.replace(
      /import\s*\{\s*([^}]*)\s+([a-zA-Z_][a-zA-Z0-9_]*)\s+([^}]*?)\s*\}\s*from\s+['"`]([^'"`]*)['"`];/g,
      (match, firstPart, funcName, rest, source) => {
        if (
          funcName === 'describe' ||
          funcName === 'test' ||
          funcName === 'it'
        ) {
          return `import { ${firstPart}${funcName}${rest} } from 'bun:test';`;
        }
        return `import { ${firstPart}${funcName}${rest} } from '${source}';`;
      }
    );

    // Pattern 5: Imports with extra closing braces
    newContent = newContent.replace(
      /import\s*\{\s*([^}]*)\s*\}\s*from\s+['"`]([^'"`]*)['"`];\s*\}/g,
      "import { $1 } from '$2';"
    );

    // Pattern 6: Fix imports with missing semicolons and extra closing braces
    newContent = newContent.replace(
      /\{\s*([^}]*)\s*\}\s*from\s+['"`]([^'"`]*)['"`];\s*\}/g,
      (match, imports, source) => {
        return `{ ${imports} } from '${source}';`;
      }
    );

    // Pattern 7: Fix imports with extra "from" clauses
    newContent = newContent.replace(
      /from\s+['"`]([^'"`]*)['"`]\s+from\s+['"`]([^'"`]*)['"`]/g,
      (match, first, second) => {
        // Choose the more appropriate source
        if (second !== 'bun:test') {
          return `from '${second}'`;
        }
        return `from '${first}'`;
      }
    );

    // Pattern 8: Fix imports with trailing "from" without quotes
    newContent = newContent.replace(
      /from\s+([^;\s]+)\s*;?\s*$/gm,
      (match, source) => {
        if (source.includes('(')) {
          return match; // Don't fix if it looks like a function call
        }
        return `from '${source}';`;
      }
    );

    // Pattern 9: Fix malformed imports in template strings
    newContent = newContent.replace(
      /import\s*\{\s*([^}]*)\s*\}\s*from\s+['"`]bun:test['"`];\s*from\s+['"`]([^'"`]*)['"`"];?/g,
      "import { $1 } from '$2';"
    );

    // Pattern 10: Fix incomplete import statements
    newContent = newContent.replace(
      /import\s*\{\s*([^}]*)\s*$/gm,
      "import { $1 } from 'bun:test';"
    );

    // Pattern 11: Fix imports with missing closing braces
    newContent = newContent.replace(
      /import\s*\{\s*([^}]*)\s*from\s+/g,
      'import { $1 } from '
    );

    // Pattern 12: Fix imports with malformed function calls
    newContent = newContent.replace(
      /\{\s*([^}]*)\s*\}\s*from\s+\);/g,
      "import { $1 } from './';"
    );

    // Pattern 13: Clean up any remaining malformed patterns
    newContent = newContent.replace(/\s+from\s+/g, ' from ');
    newContent = newContent.replace(/\s*\}\s*from/g, '} from');
    newContent = newContent.replace(/from\s*from/g, 'from');
    newContent = newContent.replace(/;\s*;/g, ';');
    newContent = newContent.replace(/\}\s*\}/g, '}');

    // Only write if content changed
    if (newContent !== content) {
      writeFileSync(filePath, newContent);
      modified = true;
    }

    return { file: filePath, modified };
  } catch (error) {
    console.error(
      `Error in final import cleanup for ${filePath}:`,
      error.message
    );
    return { file: filePath, modified: false, error: error.message };
  }
}

// Main function
function main() {
  const testFiles = findProblematicFiles();
  console.log(`Final import cleanup for ${testFiles.length} files...`);

  let fixedCount = 0;
  let errorCount = 0;
  const problematicFiles = [];

  for (const file of testFiles) {
    const result = finalImportCleanup(file);
    if (result.modified) {
      fixedCount++;
      console.log(`✅ Final cleanup: ${file}`);
    }
    if (result.error) {
      errorCount++;
      problematicFiles.push(file);
      console.log(`❌ Error: ${file} - ${result.error}`);
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('FINAL IMPORT CLEANUP COMPLETE');
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
    console.log('\n🎉 Successfully completed final import cleanup!');
  } else {
    console.log('\n✅ All files already have correct import syntax');
  }
}

// Run the cleanup
main();
