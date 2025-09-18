#!/usr/bin/env bun

import { readFileSync } from 'fs';
import { join } from 'path';

interface FileCoverage {
  file: string;
  totalLines: number;
  coveredLines: number;
  uncoveredLines: number;
  percentage: number;
  uncoveredLineNumbers: number[];
}

function parseLcovFile(lcovPath: string): FileCoverage[] {
  const content = readFileSync(lcovPath, 'utf-8');
  const lines = content.split('\n');
  const files: FileCoverage[] = [];

  let currentFile: FileCoverage | null = null;

  for (const line of lines) {
    if (line.startsWith('SF:')) {
      // Start of a new file
      if (currentFile) {
        files.push(currentFile);
      }
      const filePath = line.substring(3);
      currentFile = {
        file: filePath,
        totalLines: 0,
        coveredLines: 0,
        uncoveredLines: 0,
        percentage: 0,
        uncoveredLineNumbers: []
      };
    } else if (line.startsWith('DA:') && currentFile) {
      // Line coverage data: DA:line_number,execution_count
      const [lineData, count] = line.substring(3).split(',');
      const lineNumber = parseInt(lineData);
      const executionCount = parseInt(count);

      currentFile.totalLines++;
      if (executionCount > 0) {
        currentFile.coveredLines++;
      } else {
        currentFile.uncoveredLines++;
        currentFile.uncoveredLineNumbers.push(lineNumber);
      }
    } else if (line.startsWith('end_of_record')) {
      // End of current file record
      if (currentFile) {
        currentFile.percentage = currentFile.totalLines > 0
          ? (currentFile.coveredLines / currentFile.totalLines) * 100
          : 100;
        files.push(currentFile);
        currentFile = null;
      }
    }
  }

  // Handle last file if no end_of_record
  if (currentFile) {
    currentFile.percentage = currentFile.totalLines > 0
      ? (currentFile.coveredLines / currentFile.totalLines) * 100
      : 100;
    files.push(currentFile);
  }

  return files;
}

function formatOutput(files: FileCoverage[], topN: number = 20): void {
  // Sort by number of uncovered lines (descending)
  const sorted = files
    .filter(f => f.uncoveredLines > 0)
    .sort((a, b) => b.uncoveredLines - a.uncoveredLines);

  console.log('\n📊 Coverage Analysis Report');
  console.log('=' .repeat(100));

  // Summary statistics
  const totalFiles = files.length;
  const filesWithUncoveredLines = sorted.length;
  const totalUncoveredLines = sorted.reduce((sum, f) => sum + f.uncoveredLines, 0);
  const avgCoverage = files.reduce((sum, f) => sum + f.percentage, 0) / files.length;

  console.log('\n📈 Summary Statistics:');
  console.log(`  • Total files analyzed: ${totalFiles}`);
  console.log(`  • Files with uncovered lines: ${filesWithUncoveredLines}`);
  console.log(`  • Total uncovered lines: ${totalUncoveredLines}`);
  console.log(`  • Average coverage: ${avgCoverage.toFixed(2)}%`);

  console.log(`\n🔍 Top ${topN} Files with Most Uncovered Lines:`);
  console.log('-'.repeat(100));
  console.log(
    'Rank'.padEnd(6) +
    'File'.padEnd(60) +
    'Uncovered'.padEnd(12) +
    'Total'.padEnd(10) +
    'Coverage'
  );
  console.log('-'.repeat(100));

  const toShow = sorted.slice(0, topN);

  toShow.forEach((file, index) => {
    const fileName = file.file.length > 57
      ? '...' + file.file.slice(-54)
      : file.file;

    console.log(
      `#${index + 1}`.padEnd(6) +
      fileName.padEnd(60) +
      file.uncoveredLines.toString().padEnd(12) +
      file.totalLines.toString().padEnd(10) +
      `${file.percentage.toFixed(1)}%`
    );
  });

  // Show worst coverage files
  console.log('\n⚠️  Files with Worst Coverage Percentage:');
  console.log('-'.repeat(100));

  const worstCoverage = files
    .filter(f => f.totalLines > 10) // Only files with substantial code
    .sort((a, b) => a.percentage - b.percentage)
    .slice(0, 10);

  worstCoverage.forEach((file, index) => {
    const fileName = file.file.length > 57
      ? '...' + file.file.slice(-54)
      : file.file;

    const coverageBar = '█'.repeat(Math.floor(file.percentage / 5)) +
                       '░'.repeat(20 - Math.floor(file.percentage / 5));

    console.log(
      `#${index + 1}`.padEnd(6) +
      fileName.padEnd(60) +
      `${file.percentage.toFixed(1)}%`.padEnd(8) +
      coverageBar
    );
  });

  // Export detailed report
  console.log('\n💾 Detailed Report Options:');
  console.log('  • Run with --json flag to export JSON report');
  console.log('  • Run with --csv flag to export CSV report');
  console.log('  • Run with --lines flag to show uncovered line numbers');
}

function exportJson(files: FileCoverage[]): void {
  const sorted = files
    .filter(f => f.uncoveredLines > 0)
    .sort((a, b) => b.uncoveredLines - a.uncoveredLines)
    .map(f => ({
      ...f,
      uncoveredLineNumbers: f.uncoveredLineNumbers.slice(0, 50) // Limit line numbers for readability
    }));

  const report = {
    timestamp: new Date().toISOString(),
    summary: {
      totalFiles: files.length,
      filesWithUncoveredLines: sorted.length,
      totalUncoveredLines: sorted.reduce((sum, f) => sum + f.uncoveredLines, 0),
      averageCoverage: files.reduce((sum, f) => sum + f.percentage, 0) / files.length
    },
    files: sorted
  };

  const outputPath = join(process.cwd(), 'coverage-analysis.json');
  Bun.write(outputPath, JSON.stringify(report, null, 2));
  console.log(`\n✅ JSON report exported to: ${outputPath}`);
}

function exportCsv(files: FileCoverage[]): void {
  const sorted = files
    .filter(f => f.uncoveredLines > 0)
    .sort((a, b) => b.uncoveredLines - a.uncoveredLines);

  const csv = [
    'File,Uncovered Lines,Total Lines,Coverage %,First 10 Uncovered Line Numbers',
    ...sorted.map(f =>
      `"${f.file}",${f.uncoveredLines},${f.totalLines},${f.percentage.toFixed(2)},"${f.uncoveredLineNumbers.slice(0, 10).join(', ')}"`
    )
  ].join('\n');

  const outputPath = join(process.cwd(), 'coverage-analysis.csv');
  Bun.write(outputPath, csv);
  console.log(`\n✅ CSV report exported to: ${outputPath}`);
}

function showUncoveredLines(files: FileCoverage[], topN: number = 5): void {
  const sorted = files
    .filter(f => f.uncoveredLines > 0)
    .sort((a, b) => b.uncoveredLines - a.uncoveredLines)
    .slice(0, topN);

  console.log(`\n📍 Uncovered Line Numbers for Top ${topN} Files:`);
  console.log('='.repeat(100));

  sorted.forEach((file, index) => {
    console.log(`\n${index + 1}. ${file.file}`);
    console.log(`   Uncovered lines (${file.uncoveredLines} total):`);

    // Group consecutive line numbers for better readability
    const lineGroups: string[] = [];
    let currentGroup: number[] = [];

    file.uncoveredLineNumbers.forEach((lineNum, i) => {
      if (currentGroup.length === 0) {
        currentGroup.push(lineNum);
      } else if (lineNum === currentGroup[currentGroup.length - 1] + 1) {
        currentGroup.push(lineNum);
      } else {
        if (currentGroup.length === 1) {
          lineGroups.push(currentGroup[0].toString());
        } else {
          lineGroups.push(`${currentGroup[0]}-${currentGroup[currentGroup.length - 1]}`);
        }
        currentGroup = [lineNum];
      }
    });

    // Add the last group
    if (currentGroup.length === 1) {
      lineGroups.push(currentGroup[0].toString());
    } else if (currentGroup.length > 1) {
      lineGroups.push(`${currentGroup[0]}-${currentGroup[currentGroup.length - 1]}`);
    }

    // Display in chunks for readability
    const chunks = [];
    for (let i = 0; i < lineGroups.length; i += 10) {
      chunks.push(lineGroups.slice(i, i + 10).join(', '));
    }

    chunks.forEach(chunk => {
      console.log(`   ${chunk}`);
    });
  });
}

// Main execution
function main(): void {
  const args = process.argv.slice(2);
  const lcovPath = join(process.cwd(), 'coverage', 'lcov.info');

  try {
    console.log(`\n🔍 Analyzing coverage from: ${lcovPath}`);
    const files = parseLcovFile(lcovPath);

    if (files.length === 0) {
      console.error('❌ No coverage data found in lcov.info');
      process.exit(1);
    }

    // Default output
    formatOutput(files);

    // Handle additional flags
    if (args.includes('--json')) {
      exportJson(files);
    }

    if (args.includes('--csv')) {
      exportCsv(files);
    }

    if (args.includes('--lines')) {
      const topN = args.includes('--top')
        ? parseInt(args[args.indexOf('--top') + 1]) || 5
        : 5;
      showUncoveredLines(files, topN);
    }

  } catch (error) {
    console.error('❌ Error analyzing coverage:', error);
    process.exit(1);
  }
}

// Run the script
main();