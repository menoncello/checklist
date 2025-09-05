#!/usr/bin/env bun

import { readdir } from 'node:fs/promises';
import path from 'node:path';

async function fixTestImports() {
  const packages = ['core', 'cli', 'tui', 'shared'];

  for (const pkg of packages) {
    const testsDir = `packages/${pkg}/tests`;
    await fixImportsInDir(testsDir, pkg);
  }

  console.log('✅ Fixed all test imports');
}

async function fixImportsInDir(dir: string, packageName: string, depth = 0) {
  try {
    const entries = await readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        await fixImportsInDir(fullPath, packageName, depth + 1);
      } else if (entry.name.endsWith('.test.ts')) {
        await fixTestFile(fullPath, packageName, depth);
      }
    }
  } catch (error) {
    // Directory might not exist
  }
}

async function fixTestFile(filePath: string, packageName: string, depth: number) {
  let content = await Bun.file(filePath).text();

  // Calculate relative path prefix based on depth
  const prefix = depth === 0 ? '../src' : '../../src';

  // Fix imports that were incorrectly migrated
  content = content.replace(/from ['"]\.\.\/src\//g, `from '${prefix}/`);

  // Fix imports for nested test directories (state, workflow, etc)
  if (depth > 0) {
    // For files in subdirectories like tests/state/
    content = content.replace(/from ['"]\.\.\/src\/([^'"]+)/g, `from '../../src/state/$1`);

    // Fix types imports
    content = content.replace(/from ['"]\.\.\/src\/types['"]/g, `from '../../src/types'`);

    // Fix errors imports
    content = content.replace(/from ['"]\.\.\/src\/errors['"]/g, `from '../../src/errors'`);
  }

  // Special handling for @checklist/* imports
  content = content.replace(/from ['"]\@checklist\//g, `from '@checklist/`);

  console.log(`  Fixed: ${filePath}`);
  await Bun.write(filePath, content);
}

fixTestImports().catch(console.error);
