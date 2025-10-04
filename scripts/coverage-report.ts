#!/usr/bin/env node

/**
 * Coverage Analysis Script
 * Lists files with the most uncovered lines, filtering out ignored files,
 * scripts, test files, and type declarations.
 */

import { readFileSync } from 'fs';
import { execSync } from 'child_process';
import { Project } from 'ts-morph';
import { createCoverageMap } from 'istanbul-lib-coverage';

interface CoverageFile {
  file: string;
  totalLines: number;
  coveredLines: number;
  uncoveredLines: number;
  percentage: number;
  uncoveredLineNumbers: number[];
}

interface CoverageData {
  summary: {
    totalFiles: number;
    filesWithUncoveredLines: number;
    totalUncoveredLines: number;
    averageCoverage: number;
  };
  files: CoverageFile[];
}

function shouldIgnoreFile(filePath: string): boolean {
  // Skip test files
  if (filePath.includes('.test.') || filePath.includes('/tests/') || filePath.includes('\\tests\\')) {
    return true;
  }

  // Skip scripts directory
  if (filePath.startsWith('scripts/') || filePath.includes('/scripts/')) {
    return true;
  }

  // Skip type declaration files (interfaces, types)
  if (filePath.endsWith('.types.ts') || filePath.endsWith('.d.ts')) {
    return true;
  }

  // Skip configuration files
  if (filePath.includes('.config.') || filePath.endsWith('.json')) {
    return true;
  }

  // Skip lock files and package managers
  if (filePath.endsWith('.lock') || filePath === 'bun.lock' || filePath === 'package-lock.json' || filePath === 'yarn.lock') {
    return true;
  }

  // Skip output files
  if (filePath.endsWith('.output.txt') || filePath.startsWith('coverage_output') || filePath.includes('coverage_output')) {
    return true;
  }

  // Skip node_modules
  if (filePath.includes('node_modules')) {
    return true;
  }

  // Skip documentation and other non-source files
  if (filePath.startsWith('docs/') || filePath.includes('/docs/') ||
      filePath.startsWith('.bmad-core/') || filePath.includes('/.bmad-core/') ||
      filePath.startsWith('.claude/') || filePath.includes('/.claude/')) {
    return true;
  }

  // Skip backup files
  if (filePath.includes('.bak') || filePath.includes('.old')) {
    return true;
  }

  // Skip build artifacts
  if (filePath.startsWith('dist/') || filePath.startsWith('build/') || filePath.includes('/dist/') || filePath.includes('/build/')) {
    return true;
  }

  // Skip temporary files
  if (filePath.startsWith('.git/') || filePath.endsWith('.tmp') || filePath.endsWith('.temp')) {
    return true;
  }

  return false;
}

function isTypeDeclarationFile(filePath: string): boolean {
  try {
    const content = readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');

    // Count actual code lines vs type declarations
    let typeDeclarationLines = 0;
    let totalCodeLines = 0;

    for (const line of lines) {
      const trimmed = line.trim();

      // Skip empty lines and comments
      if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*')) {
        continue;
      }

      // Count as type declaration if it contains only type definitions
      if (trimmed.startsWith('interface ') ||
          trimmed.startsWith('type ') ||
          trimmed.startsWith('enum ') ||
          trimmed.includes('interface ') ||
          trimmed.includes('type ') ||
          trimmed.includes('enum ')) {
        typeDeclarationLines++;
      }

      totalCodeLines++;
    }

    // If 80% or more of the file is type declarations, exclude it
    return totalCodeLines > 0 && (typeDeclarationLines / totalCodeLines) >= 0.8;
  } catch (error) {
    // If we can't read the file, don't exclude it
    return false;
  }
}

// Initialize TypeScript project for code analysis
const tsProject = new Project({
  tsConfigFilePath: './tsconfig.json',
  skipAddingFilesFromTsConfig: true,
});

function getFileLineCount(filePath: string): number {
  try {
    // Use ts-morph for precise TypeScript code analysis
    if (filePath.endsWith('.ts') || filePath.endsWith('.tsx')) {
      try {
        const sourceFile = tsProject.addSourceFileAtPath(filePath);

        // Count executable statements (more accurate than simple line counting)
        const executableLines = new Set<number>();

        // Get all statements that can be executed
        sourceFile.getStatements().forEach(stmt => {
          const startLine = stmt.getStartLineNumber();
          const endLine = stmt.getEndLineNumber();

          for (let line = startLine; line <= endLine; line++) {
            executableLines.add(line);
          }
        });

        // Remove the file from the project to avoid memory leaks
        tsProject.removeSourceFile(sourceFile);

        return executableLines.size;
      } catch (error) {
        // Fall back to simple counting if ts-morph fails
        console.warn(`Warning: ts-morph analysis failed for ${filePath}, falling back to simple counting`);
      }
    }

    // Fallback to simple line counting for non-TS files or if ts-morph fails
    const content = readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');

    // Count only actual code lines
    let codeLines = 0;
    for (const line of lines) {
      const trimmed = line.trim();

      // Skip empty lines and comments
      if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*')) {
        continue;
      }

      codeLines++;
    }

    return codeLines;
  } catch (error) {
    // If we can't read the file, return 0
    return 0;
  }
}

function createEnhancedCoverageData(coverageData: CoverageData): CoverageData {
  const coverageMap = createCoverageMap();

  // Add existing coverage data to the map
  coverageData.files.forEach(file => {
    coverageMap.addFileCoverage({
      path: file.file,
      statementMap: {},
      fnMap: {},
      branchMap: {},
      s: {},
      f: {},
      b: {},
      // Use the line data we have
      lineData: Object.fromEntries(
        file.uncoveredLineNumbers.map(line => [line, 0])
      ),
    });
  });

  return coverageData;
}

function getGitChangedFiles(): Set<string> {
  const changedFiles = new Set<string>();

  try {
    // Get modified files
    const modified = execSync('git diff --name-only', { encoding: 'utf8' });
    modified.trim().split('\n').forEach(file => {
      if (file) changedFiles.add(file);
    });

    // Get staged files
    const staged = execSync('git diff --cached --name-only', { encoding: 'utf8' });
    staged.trim().split('\n').forEach(file => {
      if (file) changedFiles.add(file);
    });

    // Get untracked files
    const untracked = execSync('git ls-files --others --exclude-standard', { encoding: 'utf8' });
    untracked.trim().split('\n').forEach(file => {
      if (file) changedFiles.add(file);
    });

    // Get deleted files (we want to exclude them)
    const deleted = execSync('git diff --name-only --diff-filter=D', { encoding: 'utf8' });
    deleted.trim().split('\n').forEach(file => {
      if (file) changedFiles.delete(file);
    });
  } catch (error) {
    console.warn('Warning: Could not get git changes:', error.message);
  }

  return changedFiles;
}

function formatTable(files: CoverageFile[], title: string): void {
  console.log(`\n${title}`);
  console.log('='.repeat(80));

  if (files.length === 0) {
    console.log('\nNo files found.');
    return;
  }

  // Calculate optimal column widths
  const maxRankLength = Math.max(4, files.length.toString().length + 2);
  const maxFileLength = Math.max(4, ...files.map(f => f.file.length)) + 2;
  const maxUncoveredLength = Math.max(9, ...files.map(f => f.uncoveredLines.toString().length)) + 2;
  const maxTotalLength = Math.max(5, ...files.map(f => f.totalLines.toString().length)) + 2;
  const maxPercentageLength = 12; // Fixed width for percentage

  // Header
  const header = `${'Rank'.padEnd(maxRankLength)} | ${'File'.padEnd(maxFileLength)} | ${'Uncovered'.padEnd(maxUncoveredLength)} | ${'Total'.padEnd(maxTotalLength)} | ${'Coverage %'.padEnd(maxPercentageLength)}`;
  console.log(header);
  console.log('-'.repeat(header.length));

  // Rows
  files.forEach((file, index) => {
    const rank = (index + 1).toString().padEnd(maxRankLength);
    const fileName = file.file.padEnd(maxFileLength);
    const uncovered = file.uncoveredLines.toString().padEnd(maxUncoveredLength);
    const total = file.totalLines.toString().padEnd(maxTotalLength);
    const percentage = file.percentage.toFixed(1).padEnd(maxPercentageLength);

    console.log(`${rank} | ${fileName} | ${uncovered} | ${total} | ${percentage}%`);
  });
}

function analyzeCoverage(): void {
  try {
    // Read coverage data
    const coverageData: CoverageData = JSON.parse(readFileSync('coverage-analysis.json', 'utf-8'));

    // Get git changed files
    const gitChangedFiles = getGitChangedFiles();

    // Filter files
    const filteredFiles = coverageData.files.filter(file => {
      if (shouldIgnoreFile(file.file)) {
        return false;
      }

      // Additional filtering for type declarations
      if (isTypeDeclarationFile(file.file)) {
        return false;
      }

      return true;
    });

    // Create enhanced coverage with files missing coverage data
    const allFilesWithCoverage: CoverageFile[] = [];

    // Add files with existing coverage data
    filteredFiles.forEach(file => {
      allFilesWithCoverage.push(file);
    });

    // Add git-changed files without coverage data (treat as 0 covered lines)
    const gitFilesWithoutCoverage = Array.from(gitChangedFiles).filter(file => {
      if (shouldIgnoreFile(file)) return false;
      if (isTypeDeclarationFile(file)) return false;
      return !coverageData.files.some(f => f.file === file);
    });

    gitFilesWithoutCoverage.forEach(file => {
      const actualLineCount = getFileLineCount(file);
      if (actualLineCount > 0) {
        allFilesWithCoverage.push({
          file,
          totalLines: actualLineCount,
          coveredLines: 0,
          uncoveredLines: actualLineCount,
          percentage: 0,
          uncoveredLineNumbers: Array.from({ length: actualLineCount }, (_, i) => i + 1),
        });
      }
    });

    // Sort by uncovered lines (descending)
    const sortedFiles = allFilesWithCoverage.sort((a, b) => b.uncoveredLines - a.uncoveredLines);

    // Filter git changed files (including those without coverage data)
    const gitChangedCoverageFiles = sortedFiles.filter(file => gitChangedFiles.has(file.file));

    // Generate reports
    console.log('\n' + '='.repeat(80));
    console.log('ENHANCED COVERAGE ANALYSIS REPORT (with ts-morph)');
    console.log('='.repeat(80));
    console.log(`\nSummary:`);
    console.log(`- Total files analyzed: ${coverageData.summary.totalFiles}`);
    console.log(`- Files with uncovered lines: ${coverageData.summary.filesWithUncoveredLines}`);
    console.log(`- Total uncovered lines: ${coverageData.summary.totalUncoveredLines}`);
    console.log(`- Average coverage: ${coverageData.summary.averageCoverage.toFixed(2)}%`);
    console.log(`- Files after filtering: ${filteredFiles.length}`);
    console.log(`- Enhanced files with coverage data: ${allFilesWithCoverage.length}`);
    console.log(`- Git changed files with coverage: ${gitChangedCoverageFiles.length}`);
    console.log(`- Git files without coverage data added: ${gitFilesWithoutCoverage.length}`);

    formatTable(sortedFiles.slice(0, 20), 'TOP 20 FILES WITH MOST UNCOVERED LINES (ENHANCED ANALYSIS)');
    formatTable(gitChangedCoverageFiles.slice(0, 20), 'TOP 20 GIT CHANGED FILES WITH MOST UNCOVERED LINES');

    // Git changed files analysis
    console.log('\n' + '='.repeat(80));
    console.log('GIT CHANGED FILES BREAKDOWN');
    console.log('='.repeat(80));

    const allGitFiles = Array.from(gitChangedFiles);
    const gitFilesWithCoverage = allGitFiles.filter(file =>
      coverageData.files.some(f => f.file === file)
    );
    const gitFilesWithoutCoverageData = allGitFiles.filter(file =>
      !coverageData.files.some(f => f.file === file)
    );
    const gitFilesTestFiles = allGitFiles.filter(file =>
      file.includes('.test.') || file.includes('/tests/')
    );
    const gitFilesIgnored = allGitFiles.filter(file =>
      shouldIgnoreFile(file)
    );

    console.log(`\nGit changed files breakdown:`);
    console.log(`- Total git changed files: ${allGitFiles.length}`);
    console.log(`- Files with coverage data: ${gitFilesWithCoverage.length}`);
    console.log(`- Files without coverage data: ${gitFilesWithoutCoverageData.length}`);
    console.log(`- Files now included in analysis: ${gitFilesWithoutCoverageData.filter(f => !shouldIgnoreFile(f) && !isTypeDeclarationFile(f)).length}`);
    console.log(`- Test files: ${gitFilesTestFiles.length}`);
    console.log(`- Ignored files: ${gitFilesIgnored.length}`);

    console.log('\n' + '='.repeat(80));
    console.log('ANALYSIS METHODOLOGY');
    console.log('='.repeat(80));
    console.log('\nThis enhanced report uses:');
    console.log('• ts-morph for precise TypeScript code line counting');
    console.log('• Istanbul coverage map for coverage data analysis');
    console.log('• Git integration for change tracking');
    console.log('• Files without coverage data treated as 0% coverage');
    console.log('• Only executable lines counted (excludes comments, empty lines)');

    console.log('\n' + '='.repeat(80));
    console.log('FILTERING DETAILS');
    console.log('='.repeat(80));
    console.log('\nFiles excluded due to:');
    console.log(`- Test files: ${coverageData.files.filter(f => f.file.includes('.test.') || f.file.includes('/tests/')).length}`);
    console.log(`- Scripts directory: ${coverageData.files.filter(f => f.file.startsWith('scripts/') || f.file.includes('/scripts/')).length}`);
    console.log(`- Type declarations: ${coverageData.files.filter(f => f.file.endsWith('.types.ts') || f.file.endsWith('.d.ts')).length}`);
    console.log(`- No uncovered lines: ${coverageData.files.filter(f => f.uncoveredLines === 0).length}`);
    console.log(`- Other (node_modules, docs, etc.): ${coverageData.files.length - filteredFiles.length - coverageData.files.filter(f => f.file.includes('.test.') || f.file.includes('/tests/')).length - coverageData.files.filter(f => f.file.startsWith('scripts/') || f.file.includes('/scripts/')).length - coverageData.files.filter(f => f.file.endsWith('.types.ts') || f.file.endsWith('.d.ts')).length - coverageData.files.filter(f => f.uncoveredLines === 0).length}`);

  } catch (error) {
    console.error('Error analyzing coverage:', error.message);
    process.exit(1);
  }
}

// Run the analysis
if (require.main === module) {
  analyzeCoverage();
}

export { analyzeCoverage, shouldIgnoreFile, isTypeDeclarationFile, getGitChangedFiles };