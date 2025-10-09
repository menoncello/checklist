#!/usr/bin/env bun

/**
 * Fix remaining import statement issues
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

function fixRemainingImports(filePath) {
  try {
    const content = readFileSync(filePath, 'utf8');
    let newContent = content;
    let modified = false;

    // Pattern 1: Missing opening for import lists
    newContent = newContent.replace(
      /import\s+([^{}]*?)\s+import\s+/g,
      "import { $1 } from 'bun:test';\nimport "
    );

    // Pattern 2: Mixed imports like "import { safeEval  describe('conditions'"
    newContent = newContent.replace(
      /import\s*\{\s*([^}]*?)\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/g,
      "import { $1 } from 'bun:test';\n$2("
    );

    // Pattern 3: Missing 'from' clause with imports
    newContent = newContent.replace(
      /import\s*\{\s*([^}]*?)\s*\}\s*([a-zA-Z_])/g,
      (match, imports, nextWord) => {
        // Check if nextWord starts a new statement
        if (
          nextWord === 'import' ||
          nextWord === 'describe' ||
          nextWord === 'test'
        ) {
          return `import { ${imports} } from 'bun:test';\n`;
        }
        return `import { ${imports} } from 'bun:test';\n${nextWord}`;
      }
    );

    // Pattern 4: Broken import chains
    newContent = newContent.replace(
      /import\s*\{\s*([^}]*?)\s*\}\s*import\s*\{\s*([^}]*?)\s*\}\s*(?:from\s+)?['"`]([^'"`]*)['"`]?/g,
      "import { $1$2 } from '$3';\n"
    );

    // Pattern 5: Fix trailing imports without from
    newContent = newContent.replace(
      /import\s*\{\s*([^}]*?)\s*\}\s*$/gm,
      "import { $1 } from 'bun:test';\n"
    );

    // Pattern 6: Fix specific patterns found in the errors
    newContent = newContent.replace(
      /test,\s*expect,\s*beforeEach,\s*afterEach\s*\}\s*import\s*\{\s*([^}]*)\s*\}/g,
      "test, expect, beforeEach, afterEach } from 'bun:test';\nimport { $1 }"
    );

    // Pattern 7: Fix import patterns with extra spaces
    newContent = newContent.replace(
      /import\s*\{\s*([^}]*)\s*\}\s*import\s*\{\s*([^}]*)\s*\}[^;]*?from\s+['"`]([^'"`]*)['"`]/g,
      "import { $1$2 } from '$3';"
    );

    // Pattern 8: Fix completely malformed imports
    newContent = newContent.replace(
      /import\s*\{[^}]*\}\s*import\s*\{[^}]*\}\s*import\s*\{[^}]*\}\s*[^;]*from\s+['"`][^'"`]*['"`]/g,
      (match) => {
        // Extract all import contents
        const imports = match.match(/\{[^}]*\}/g);
        if (imports && imports.length > 0) {
          const allImports = imports
            .map((imp) => {
              const content = imp.match(/\{([^}]*)\}/);
              return content ? content[1] : '';
            })
            .join(', ');
          return `import { ${allImports} } from 'bun:test';`;
        }
        return match;
      }
    );

    // Pattern 9: Fix imports with "existsSync, readFileSync" pattern
    newContent = newContent.replace(
      /import\s*\{\s*([^}]*)\s*(existsSync|readFileSync|writeFileSync)\s*([^}]*)\s*\}\s*import\s*\{\s*([^}]*)\s*\}/g,
      (match, before, func, after, second) => {
        return `import { ${before}${func}${after}${second} } from 'fs';`;
      }
    );

    // Pattern 10: Fix mixed imports at beginning of files
    if (
      newContent.includes('import {') &&
      newContent.match(/^[^{]*import\s*{[^}]*}\s+import/)
    ) {
      newContent = newContent.replace(
        /^([^`]*?)import\s*\{([^}]*)\}\s+import\s*\{([^}]*)\}/,
        (match, prefix, first, second) => {
          return `${prefix}import { ${first}${second} } from 'bun:test';`;
        }
      );
    }

    // Clean up any remaining malformed patterns
    newContent = newContent.replace(/\s+from\s+/g, ' from ');
    newContent = newContent.replace(/\s*\}\s*from/g, '} from');
    newContent = newContent.replace(/from\s*from/g, 'from');
    newContent = newContent.replace(/import\s+import/g, 'import');

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
  const testFiles = findProblematicFiles();
  console.log(`Fixing remaining import issues in ${testFiles.length} files...`);

  let fixedCount = 0;
  let errorCount = 0;
  const problematicFiles = [];

  for (const file of testFiles) {
    const result = fixRemainingImports(file);
    if (result.modified) {
      fixedCount++;
      console.log(`✅ Fixed remaining imports: ${file}`);
    }
    if (result.error) {
      errorCount++;
      problematicFiles.push(file);
      console.log(`❌ Error: ${file} - ${result.error}`);
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('REMAINING IMPORT FIX COMPLETE');
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
    console.log('\n🎉 Successfully fixed remaining import statements!');
  } else {
    console.log('\n✅ All files already have correct import syntax');
  }
}

// Run the fix
main();
