#!/usr/bin/env bun

/**
 * Fix duplicate import statements created by previous fixes
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

function fixDuplicateImports(filePath) {
  try {
    const content = readFileSync(filePath, 'utf8');
    let newContent = content;
    let modified = false;

    // Pattern 1: Duplicate imports like "import { ... } from 'bun:test'; from 'bun:test';"
    newContent = newContent.replace(
      /from\s+['"`]([^'"`]*)['"`];\s+from\s+['"`]\1['"`];/g,
      "from '$1';"
    );

    // Pattern 2: Duplicate imports with different sources like "import { ... } from 'bun:test'; from 'path';"
    newContent = newContent.replace(
      /from\s+['"`]([^'"`]*)['"`];\s+from\s+['"`]([^'"`]*)['"`];/g,
      (match, first, second) => {
        // If the second source looks like the correct one, use it
        if (second !== 'bun:test' && second !== 'bun') {
          return `from '${second}';`;
        }
        return `from '${first}';`;
      }
    );

    // Pattern 3: Multiple duplicate from clauses
    newContent = newContent.replace(
      /from\s+['"`][^'"`]*['"`](;\s*from\s+['"`][^'"`]*['"`"])+/g,
      (match) => {
        // Find all the sources
        const sources = match.match(/from\s+['"`]([^'"`]*?)['"`]/g);
        if (sources) {
          // Choose the most appropriate source (not bun:test unless it's the only one)
          const validSource =
            sources.find((src) => !src.includes('bun:test')) || sources[0];
          return validSource + ';';
        }
        return match;
      }
    );

    // Pattern 4: Fix malformed imports with multiple "from" clauses
    newContent = newContent.replace(
      /import\s*\{[^}]*\}\s*from\s+['"`][^'"`]*['"`](\s+from\s+['"`][^'"`]*['"`"])+/g,
      (match) => {
        const sources = match.match(/from\s+['"`]([^'"`]*?)['"`]/g);
        if (sources) {
          // Choose the most appropriate source
          const validSource =
            sources.find((src) => !src.includes('bun:test')) || sources[0];
          const imports = match.match(/import\s*\{([^}]*)\}/);
          if (imports) {
            return `import { ${imports[1]} } ${validSource};`;
          }
        }
        return match;
      }
    );

    // Pattern 5: Fix specific patterns in file content (template strings)
    newContent = newContent.replace(
      /from\s+['"`]bun:test['"`];\s+from\s+['"`]([^'"`]*)['"`"];/g,
      (match, path) => {
        return `from '${path}';`;
      }
    );

    // Pattern 6: Clean up any remaining malformed patterns
    newContent = newContent.replace(/\s+from\s+/g, ' from ');
    newContent = newContent.replace(/\s*\}\s*from/g, '} from');
    newContent = newContent.replace(/from\s*from/g, 'from');
    newContent = newContent.replace(/;\s*;/g, ';');

    // Only write if content changed
    if (newContent !== content) {
      writeFileSync(filePath, newContent);
      modified = true;
    }

    return { file: filePath, modified };
  } catch (error) {
    console.error(
      `Error fixing duplicate imports in ${filePath}:`,
      error.message
    );
    return { file: filePath, modified: false, error: error.message };
  }
}

// Main function
function main() {
  const testFiles = findProblematicFiles();
  console.log(`Fixing duplicate import issues in ${testFiles.length} files...`);

  let fixedCount = 0;
  let errorCount = 0;
  const problematicFiles = [];

  for (const file of testFiles) {
    const result = fixDuplicateImports(file);
    if (result.modified) {
      fixedCount++;
      console.log(`✅ Fixed duplicate imports: ${file}`);
    }
    if (result.error) {
      errorCount++;
      problematicFiles.push(file);
      console.log(`❌ Error: ${file} - ${result.error}`);
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('DUPLICATE IMPORT FIX COMPLETE');
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
    console.log('\n🎉 Successfully fixed duplicate import statements!');
  } else {
    console.log('\n✅ All files already have correct import syntax');
  }
}

// Run the fix
main();
