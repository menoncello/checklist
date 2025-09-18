#!/usr/bin/env node

/**
 * Lint Report Generator
 * Analyzes ESLint output and generates a detailed report of files with quality issues
 */

import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

/**
 * Run ESLint and capture JSON output
 */
async function runEslint() {
  return new Promise((resolve, reject) => {
    const eslint = spawn('bun', ['x', 'eslint', '.', '--format', 'json'], {
      cwd: process.cwd(),
      shell: true,
    });

    let output = '';
    let errorOutput = '';

    eslint.stdout.on('data', (data) => {
      output += data.toString();
    });

    eslint.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });

    eslint.on('close', (code) => {
      // ESLint returns non-zero when there are errors, but we still get the JSON output
      try {
        const results = JSON.parse(output);
        resolve(results);
      } catch (error) {
        reject(new Error(`Failed to parse ESLint output: ${error.message}\n${errorOutput}`));
      }
    });

    eslint.on('error', (error) => {
      reject(error);
    });
  });
}

/**
 * Process ESLint results and generate statistics
 */
function processResults(results) {
  const stats = {
    totalFiles: 0,
    totalErrors: 0,
    totalWarnings: 0,
    filesByErrorCount: [],
    ruleViolations: {},
    packageStats: {},
  };

  results.forEach((file) => {
    if (file.errorCount > 0 || file.warningCount > 0) {
      stats.totalFiles++;
      stats.totalErrors += file.errorCount;
      stats.totalWarnings += file.warningCount;

      // Extract package name from file path
      const packageMatch = file.filePath.match(/packages\/([^/]+)/);
      const packageName = packageMatch ? packageMatch[1] : 'root';

      // Initialize package stats
      if (!stats.packageStats[packageName]) {
        stats.packageStats[packageName] = {
          files: 0,
          errors: 0,
          warnings: 0,
          topViolations: {},
        };
      }

      stats.packageStats[packageName].files++;
      stats.packageStats[packageName].errors += file.errorCount;
      stats.packageStats[packageName].warnings += file.warningCount;

      // Process each message
      const fileViolations = {};
      file.messages.forEach((msg) => {
        const ruleId = msg.ruleId || 'unknown';

        // Track global rule violations
        if (!stats.ruleViolations[ruleId]) {
          stats.ruleViolations[ruleId] = {
            count: 0,
            severity: msg.severity === 2 ? 'error' : 'warning',
            files: new Set(),
          };
        }
        stats.ruleViolations[ruleId].count++;
        stats.ruleViolations[ruleId].files.add(file.filePath);

        // Track file-level violations
        fileViolations[ruleId] = (fileViolations[ruleId] || 0) + 1;

        // Track package-level violations
        if (!stats.packageStats[packageName].topViolations[ruleId]) {
          stats.packageStats[packageName].topViolations[ruleId] = 0;
        }
        stats.packageStats[packageName].topViolations[ruleId]++;
      });

      // Store file info with violations
      stats.filesByErrorCount.push({
        path: file.filePath,
        errors: file.errorCount,
        warnings: file.warningCount,
        total: file.errorCount + file.warningCount,
        violations: fileViolations,
        package: packageName,
      });
    }
  });

  // Sort files by total violations
  stats.filesByErrorCount.sort((a, b) => b.total - a.total);

  return stats;
}

/**
 * Generate formatted report
 */
function generateReport(stats) {
  const report = [];

  // Header
  report.push(`${colors.bright}${colors.cyan}════════════════════════════════════════════════════════════════════════════`);
  report.push(`                          LINT QUALITY REPORT`);
  report.push(`════════════════════════════════════════════════════════════════════════════${colors.reset}\n`);

  // Summary
  report.push(`${colors.bright}📊 SUMMARY${colors.reset}`);
  report.push(`├─ Total Files with Issues: ${colors.yellow}${stats.totalFiles}${colors.reset}`);
  report.push(`├─ Total Errors: ${colors.red}${stats.totalErrors}${colors.reset}`);
  report.push(`└─ Total Warnings: ${colors.yellow}${stats.totalWarnings}${colors.reset}\n`);

  // Top violations by rule
  report.push(`${colors.bright}🚫 TOP VIOLATIONS BY RULE${colors.reset}`);
  const sortedRules = Object.entries(stats.ruleViolations)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 10);

  sortedRules.forEach(([rule, data], index) => {
    const isLast = index === sortedRules.length - 1;
    const prefix = isLast ? '└─' : '├─';
    const color = data.severity === 'error' ? colors.red : colors.yellow;
    report.push(`${prefix} ${color}${rule}${colors.reset}: ${data.count} violations in ${data.files.size} files`);
  });
  report.push('');

  // Package breakdown
  report.push(`${colors.bright}📦 VIOLATIONS BY PACKAGE${colors.reset}`);
  const sortedPackages = Object.entries(stats.packageStats)
    .sort((a, b) => b[1].errors - a[1].errors);

  sortedPackages.forEach(([pkg, data], index) => {
    const isLast = index === sortedPackages.length - 1;
    const prefix = isLast ? '└─' : '├─';
    report.push(`${prefix} ${colors.blue}${pkg}${colors.reset}: ${data.files} files, ${colors.red}${data.errors} errors${colors.reset}, ${colors.yellow}${data.warnings} warnings${colors.reset}`);

    // Show top 3 violations for this package
    const topViolations = Object.entries(data.topViolations)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);

    topViolations.forEach(([rule, count], i) => {
      const subPrefix = isLast ? '   ' : '│  ';
      const subIsLast = i === topViolations.length - 1;
      const subItemPrefix = subIsLast ? '└─' : '├─';
      report.push(`${subPrefix}${subItemPrefix} ${rule}: ${count}`);
    });
  });
  report.push('');

  // Files with most issues
  report.push(`${colors.bright}📝 TOP 20 FILES WITH MOST ISSUES${colors.reset}`);
  const topFiles = stats.filesByErrorCount.slice(0, 20);

  topFiles.forEach((file, index) => {
    const relativePath = path.relative(process.cwd(), file.path);
    const isLast = index === topFiles.length - 1;
    const prefix = isLast ? '└─' : '├─';

    report.push(`${prefix} ${colors.magenta}${relativePath}${colors.reset}`);
    const subPrefix = isLast ? '   ' : '│  ';
    report.push(`${subPrefix}└─ ${colors.red}${file.errors} errors${colors.reset}, ${colors.yellow}${file.warnings} warnings${colors.reset} (Total: ${file.total})`);

    // Show top violations for this file
    const topFileViolations = Object.entries(file.violations)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);

    if (topFileViolations.length > 0) {
      report.push(`${subPrefix}   Top violations:`);
      topFileViolations.forEach(([rule, count], i) => {
        const vIsLast = i === topFileViolations.length - 1;
        const vPrefix = vIsLast ? '└─' : '├─';
        report.push(`${subPrefix}   ${vPrefix} ${rule}: ${count}`);
      });
    }
  });
  report.push('');

  // Quality metrics violations specifically
  const qualityRules = ['max-lines', 'max-lines-per-function', 'complexity', 'max-depth', 'max-params', 'max-nested-callbacks'];
  const qualityViolations = qualityRules
    .filter(rule => stats.ruleViolations[rule])
    .map(rule => ({ rule, ...stats.ruleViolations[rule] }));

  if (qualityViolations.length > 0) {
    report.push(`${colors.bright}📏 CODE QUALITY METRICS VIOLATIONS${colors.reset}`);
    qualityViolations.forEach((violation, index) => {
      const isLast = index === qualityViolations.length - 1;
      const prefix = isLast ? '└─' : '├─';
      report.push(`${prefix} ${colors.red}${violation.rule}${colors.reset}: ${violation.count} violations in ${violation.files.size} files`);
    });
    report.push('');
  }

  // Footer
  report.push(`${colors.bright}${colors.cyan}════════════════════════════════════════════════════════════════════════════${colors.reset}`);
  report.push(`${colors.bright}Generated: ${new Date().toLocaleString()}${colors.reset}`);

  return report.join('\n');
}

/**
 * Save report to file
 */
async function saveReport(report, stats) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
  const reportDir = path.join(process.cwd(), 'reports', 'quality');
  const reportFile = path.join(reportDir, `lint-analysis-${timestamp}.txt`);
  const jsonFile = path.join(reportDir, `lint-analysis-${timestamp}.json`);

  try {
    await fs.mkdir(reportDir, { recursive: true });

    // Save text report
    await fs.writeFile(reportFile, report);
    console.log(`${colors.green}✅ Text report saved to: ${reportFile}${colors.reset}`);

    // Save JSON data for further analysis
    const jsonData = {
      generated: new Date().toISOString(),
      summary: {
        totalFiles: stats.totalFiles,
        totalErrors: stats.totalErrors,
        totalWarnings: stats.totalWarnings,
      },
      ruleViolations: Object.fromEntries(
        Object.entries(stats.ruleViolations).map(([rule, data]) => [
          rule,
          { ...data, files: Array.from(data.files) }
        ])
      ),
      packageStats: stats.packageStats,
      topFiles: stats.filesByErrorCount.slice(0, 50),
    };

    await fs.writeFile(jsonFile, JSON.stringify(jsonData, null, 2));
    console.log(`${colors.green}✅ JSON data saved to: ${jsonFile}${colors.reset}`);

  } catch (error) {
    console.error(`${colors.red}❌ Failed to save report: ${error.message}${colors.reset}`);
  }
}

/**
 * Main execution
 */
async function main() {
  console.log(`${colors.cyan}🔍 Running ESLint analysis...${colors.reset}`);

  try {
    const results = await runEslint();
    console.log(`${colors.green}✅ ESLint analysis complete${colors.reset}`);

    console.log(`${colors.cyan}📊 Processing results...${colors.reset}`);
    const stats = processResults(results);

    const report = generateReport(stats);
    console.log('\n' + report);

    // Ask user if they want to save the report
    console.log(`\n${colors.cyan}💾 Saving report...${colors.reset}`);
    await saveReport(report, stats);

  } catch (error) {
    console.error(`${colors.red}❌ Error: ${error.message}${colors.reset}`);
    process.exit(1);
  }
}

// Run the script
main();