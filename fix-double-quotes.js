#!/usr/bin/env bun

/**
 * Fix double quotes in import statements
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

function fixDoubleQuotes(filePath) {
  try {
    const content = readFileSync(filePath, 'utf8');
    let newContent = content;
    let modified = false;

    // Fix double quotes in import statements
    newContent = newContent.replace(/from\s+''([^']+)''/g, "from '$1'");
    newContent = newContent.replace(/import\s+''([^']+)''/g, "import '$1'");

    // Only write if content changed
    if (newContent !== content) {
      writeFileSync(filePath, newContent);
      modified = true;
    }

    return { file: filePath, modified };
  } catch (error) {
    console.error(`Error fixing double quotes in ${filePath}:`, error.message);
    return { file: filePath, modified: false, error: error.message };
  }
}

// Main function
function main() {
  const testFiles = findProblematicFiles();
  console.log(`Fixing double quotes in ${testFiles.length} files...`);

  let fixedCount = 0;
  let errorCount = 0;

  for (const file of testFiles) {
    const result = fixDoubleQuotes(file);
    if (result.modified) {
      fixedCount++;
      console.log(`✅ Fixed double quotes: ${file}`);
    }
    if (result.error) {
      errorCount++;
      console.log(`❌ Error: ${file} - ${result.error}`);
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('DOUBLE QUOTES FIX COMPLETE');
  console.log('='.repeat(60));
  console.log(`Total files checked: ${testFiles.length}`);
  console.log(`Files fixed: ${fixedCount}`);
  console.log(`Errors encountered: ${errorCount}`);

  if (fixedCount > 0) {
    console.log('\n🎉 Successfully fixed double quotes!');
  } else {
    console.log('\n✅ All files already have correct quotes');
  }
}

// Run the fix
main();
