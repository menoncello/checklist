#!/usr/bin/env bun

import { readdir, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

interface TestFile {
  originalPath: string;
  newPath: string;
  content: string;
}

async function findTestFiles(dir: string): Promise<string[]> {
  const testFiles: string[] = [];

  async function walk(currentDir: string) {
    const entries = await readdir(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);

      // Skip node_modules and dist
      if (entry.name === 'node_modules' || entry.name === 'dist') continue;

      if (entry.isDirectory()) {
        await walk(fullPath);
      } else if (entry.name.match(/\.(test|spec)\.(ts|tsx|js|jsx)$/)) {
        testFiles.push(fullPath);
      }
    }
  }

  await walk(dir);
  return testFiles;
}

function migrateTestContent(content: string, filePath: string): string {
  let migrated = content;

  // Replace Vitest imports with Bun test imports
  migrated = migrated.replace(
    /import\s*{\s*([^}]+)\s*}\s*from\s*['"]vitest['"]/g,
    "import { $1 } from 'bun:test'"
  );

  // Replace vi.fn() with mock()
  migrated = migrated.replace(/\bvi\.fn\(\)/g, 'mock()');

  // Replace vi.mock with mock.module
  migrated = migrated.replace(/\bvi\.mock\(/g, 'mock.module(');

  // Replace vi.spyOn with spyOn
  migrated = migrated.replace(/\bvi\.spyOn\(/g, 'spyOn(');

  // Replace vi.clearAllMocks with clearAllMocks
  migrated = migrated.replace(/\bvi\.clearAllMocks\(\)/g, 'clearAllMocks()');

  // Replace vi.resetAllMocks with resetAllMocks
  migrated = migrated.replace(/\bvi\.resetAllMocks\(\)/g, 'resetAllMocks()');

  // Add mock import if needed
  if (migrated.includes('mock()') && !migrated.includes('import { mock }')) {
    migrated = migrated.replace(
      /import\s*{\s*([^}]+)\s*}\s*from\s*['"]bun:test['"]/,
      "import { $1, mock } from 'bun:test'"
    );
  }

  // Fix import paths for moved test location
  // If test is moving from src/ to tests/, update relative imports
  const isInSrc = filePath.includes('/src/');
  if (isInSrc) {
    // Add ../ to relative imports that start with ./
    migrated = migrated.replace(/from\s+['"]\.\//g, "from '../src/");
    // Update index imports
    migrated = migrated.replace(/from\s+['"]\.\/index['"]/g, "from '../src/index'");
  }

  return migrated;
}

function determineNewTestPath(originalPath: string): string {
  // Extract package name and file path
  const match = originalPath.match(/packages\/([^\/]+)\/(.*)/);

  if (!match) return originalPath;

  const [, packageName, filePath] = match;

  // Remove src/ from path if present
  const cleanPath = filePath.replace(/^src\//, '');

  // Build new path in tests folder
  return path.join('packages', packageName, 'tests', cleanPath);
}

async function migrateTestFiles() {
  console.log('🔍 Finding test files...');

  // Find all test files in packages
  const testFiles = await findTestFiles('./packages');

  // Filter only test files in src folders (not already in tests folders)
  const testsToMigrate = testFiles.filter((f) => f.includes('/src/'));

  console.log(`📦 Found ${testsToMigrate.length} test files to migrate\n`);

  const migrations: TestFile[] = [];

  for (const testFile of testsToMigrate) {
    const content = await Bun.file(testFile).text();
    const migratedContent = migrateTestContent(content, testFile);
    const newPath = determineNewTestPath(testFile);

    migrations.push({
      originalPath: testFile,
      newPath,
      content: migratedContent,
    });

    console.log(`  ✓ ${testFile}`);
    console.log(`    → ${newPath}`);
  }

  console.log('\n📝 Writing migrated test files...');

  for (const migration of migrations) {
    // Create directory if it doesn't exist
    const dir = path.dirname(migration.newPath);
    if (!existsSync(dir)) {
      await mkdir(dir, { recursive: true });
    }

    // Write migrated content
    await Bun.write(migration.newPath, migration.content);
    console.log(`  ✓ Created ${migration.newPath}`);
  }

  console.log('\n🗑️  Removing original test files from src...');

  for (const migration of migrations) {
    const { unlink } = await import('node:fs/promises');
    await unlink(migration.originalPath);
    console.log(`  ✓ Removed ${migration.originalPath}`);
  }

  console.log('\n✅ Migration complete!');
  console.log(`   Migrated ${migrations.length} test files`);
  console.log('\n📋 Next steps:');
  console.log('   1. Review the migrated test files');
  console.log('   2. Run: bun test');
  console.log('   3. Update any failing tests manually');
}

// Run migration
migrateTestFiles().catch(console.error);
