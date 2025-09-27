#!/usr/bin/env node

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { execSync } from "child_process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

// Parse command line arguments
const args = process.argv.slice(2);
const byFunction = args.includes("--by-function") || args.includes("-f");
const topCount = parseInt(args.find(arg => arg.startsWith("--top="))?.split("=")[1] || "20");
const allTypes = args.includes("--all-types") || args.includes("-a");
const help = args.includes("--help") || args.includes("-h");

if (help) {
  console.log(`
Coverage Analysis Tool

Usage: bun run analyze:coverage [options]

Options:
  --by-function, -f    Calculate coverage by function instead of by line
  --top=N             Show top N files with most uncovered lines (default: 20)
  --all-types, -a     Include all file types (JS, TS, TSX, MJS). Default: TypeScript only
  --json              Export results to JSON file
  --help, -h          Show this help message

Examples:
  bun run analyze:coverage                    # Analyze TypeScript files by lines, show top 20
  bun run analyze:coverage --all-types        # Analyze all file types
  bun run analyze:coverage --by-function      # Analyze by functions
  bun run analyze:coverage --top=10           # Show only top 10 files
  bun run analyze:coverage --json             # Export to coverage-analysis.json
`);
  process.exit(0);
}

// File extensions to analyze
// Default: TypeScript only, unless --all-types is specified
const codeExtensions = allTypes ? [".js", ".ts", ".tsx", ".mjs"] : [".ts", ".tsx"];

// Directories to exclude
const excludeDirs = [
  "node_modules",
  ".git",
  "dist",
  "build",
  "coverage",
  ".next",
  "out",
  "tmp",
  "temp",
  ".cache",
  ".bun",
  "metronic-react"
];

// Files to exclude
const excludeFiles = [
  ".test.ts",
  ".test.js",
  ".spec.ts",
  ".spec.js",
  ".d.ts",
  "vite.config",
  "webpack.config"
];

/**
 * Get all code files in the project
 */
function getAllCodeFiles(dir = projectRoot, files = []) {
  const items = fs.readdirSync(dir);

  for (const item of items) {
    const fullPath = path.join(dir, item);
    const relativePath = path.relative(projectRoot, fullPath);

    // Skip excluded directories (check if path starts with or has directory separator before exclude pattern)
    if (
      excludeDirs.some(excl => {
        const pathSegments = relativePath.split(path.sep);
        return pathSegments.includes(excl);
      })
    ) {
      continue;
    }

    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      getAllCodeFiles(fullPath, files);
    } else if (stat.isFile()) {
      // Check if it's a code file and not excluded
      const ext = path.extname(fullPath);
      const isCodeFile = codeExtensions.includes(ext);
      const isExcluded = excludeFiles.some(excl => fullPath.includes(excl));

      if (isCodeFile && !isExcluded) {
        files.push(fullPath);
      }
    }
  }

  return files;
}

/**
 * Count lines in a file (excluding empty lines and comments)
 */
function countLines(filePath) {
  const content = fs.readFileSync(filePath, "utf-8");
  const lines = content.split("\n");

  let codeLines = 0;
  let inBlockComment = false;

  for (const line of lines) {
    const trimmed = line.trim();

    // Skip empty lines
    if (!trimmed) continue;

    // Handle block comments
    if (trimmed.startsWith("/*")) {
      inBlockComment = true;
    }
    if (inBlockComment) {
      if (trimmed.includes("*/")) {
        inBlockComment = false;
      }
      continue;
    }

    // Skip single line comments
    if (trimmed.startsWith("//") || trimmed.startsWith("#")) continue;

    codeLines++;
  }

  return codeLines;
}

/**
 * Count functions in a file
 */
function countFunctions(filePath) {
  const content = fs.readFileSync(filePath, "utf-8");

  // Regex patterns for different function types
  const patterns = [
    /function\s+\w+\s*\(/g, // Regular functions
    /\w+\s*:\s*function\s*\(/g, // Object methods
    /\w+\s*=\s*function\s*\(/g, // Function expressions
    /\w+\s*=\s*\([^)]*\)\s*=>/g, // Arrow functions
    /\w+\s*:\s*\([^)]*\)\s*=>/g, // Object arrow methods
    /async\s+function\s+\w+\s*\(/g, // Async functions
    /\w+\s*=\s*async\s*\([^)]*\)\s*=>/g, // Async arrow functions
    /^\s*(public|private|protected)?\s*(async\s+)?(\w+)\s*\([^)]*\)\s*{/gm, // Class methods
    /^\s*(get|set)\s+\w+\s*\(/gm // Getters/setters
  ];

  let functionCount = 0;

  for (const pattern of patterns) {
    const matches = content.match(pattern) || [];
    functionCount += matches.length;
  }

  // Rough estimate - avoid double counting
  return Math.max(1, Math.floor(functionCount * 0.7));
}

/**
 * Get list of changed files using git
 */
function getChangedFiles() {
  try {
    // Get committed changes compared to main branch
    const committedOutput = execSync("git diff --name-only main...HEAD", {
      cwd: projectRoot,
      encoding: "utf-8"
    });

    // Get uncommitted changes (staged and unstaged)
    const unstagedOutput = execSync("git diff --name-only", {
      cwd: projectRoot,
      encoding: "utf-8"
    });

    const stagedOutput = execSync("git diff --name-only --cached", {
      cwd: projectRoot,
      encoding: "utf-8"
    });

    // Get untracked files (new files not yet added to git)
    const untrackedOutput = execSync("git ls-files --others --exclude-standard", {
      cwd: projectRoot,
      encoding: "utf-8"
    });

    // Combine all changed files
    const allChanges = [
      ...committedOutput.split("\n"),
      ...unstagedOutput.split("\n"),
      ...stagedOutput.split("\n"),
      ...untrackedOutput.split("\n")
    ];

    const changedFiles = [...new Set(allChanges)] // Remove duplicates
      .filter(file => file.trim())
      .map(file => path.resolve(projectRoot, file))
      .filter(file => {
        // Only include files that exist and are code files
        if (!fs.existsSync(file)) return false;

        // Check if file is in excluded directory
        const relativePath = path.relative(projectRoot, file);
        const pathSegments = relativePath.split(path.sep);
        const inExcludedDir = excludeDirs.some(excl => pathSegments.includes(excl));
        if (inExcludedDir) return false;

        const ext = path.extname(file);
        return codeExtensions.includes(ext) && !excludeFiles.some(excl => file.includes(excl));
      });

    return changedFiles;
  } catch (e) {
    console.log(
      "Note: Could not get changed files from git. No changed files will be highlighted."
    );
    return [];
  }
}

/**
 * Parse coverage report from bun test output
 */
function getCoverageData() {
  console.log("Generating coverage report...");

  try {
    // Run bun test with coverage and filter to just the table, strip ANSI codes
    const output = execSync("bun test --coverage 2>&1 | grep -A 200 'File.*% Funcs.*% Lines' | sed 's/\\x1b\\[[0-9;]*m//g' || true", {
      cwd: projectRoot,
      encoding: "utf-8",
      maxBuffer: 10 * 1024 * 1024, // 10MB buffer
      shell: true
    });

    const lines = output.split("\n");
    const result = {};
    let inCoverageTable = false;
    let tableStarted = false;

    for (const line of lines) {
      // Check for coverage table start
      if (line.includes("File") && line.includes("% Funcs") && line.includes("% Lines")) {
        inCoverageTable = true;
        tableStarted = false;
        continue;
      }

      // Check for separator line after header
      if (inCoverageTable && !tableStarted && line.includes("---")) {
        tableStarted = true;
        continue;
      }

      // Check for coverage table end (empty line or line without pipe)
      if (tableStarted && (!line.includes("|") || line.trim() === "")) {
        inCoverageTable = false;
        break;
      }

      // Parse coverage data
      if (inCoverageTable && tableStarted && line.includes("|")) {
        const parts = line.split("|").map(p => p.trim());
        if (parts.length >= 3 && parts[0] && parts[0] !== "All files") {
          const filePath = parts[0];
          const funcCoverage = parseFloat(parts[1]) || 0;
          const lineCoverage = parseFloat(parts[2]) || 0;

          // Get uncovered lines from the last column
          const uncoveredLines = parts[3] || "";
          const uncoveredCount = uncoveredLines ? uncoveredLines.split(",").length : 0;

          // Estimate total lines from coverage percentage
          let totalLines = 0;
          if (lineCoverage > 0 && uncoveredCount > 0) {
            totalLines = Math.round(uncoveredCount / ((100 - lineCoverage) / 100));
          } else if (lineCoverage === 100) {
            // For fully covered files, use actual line count
            totalLines = countLines(path.resolve(projectRoot, filePath));
          } else if (lineCoverage === 0 && uncoveredCount > 0) {
            totalLines = uncoveredCount;
          }

          const coveredLines = Math.round(totalLines * (lineCoverage / 100));

          result[filePath] = {
            total: totalLines,
            covered: coveredLines,
            uncovered: totalLines - coveredLines,
            percentage: lineCoverage,
            funcPercentage: funcCoverage
          };
        }
      }
    }

    console.log(`Parsed coverage data for ${Object.keys(result).length} files from test output\n`);
    return result;
  } catch (e) {
    console.log("Note: Could not generate full coverage report. Showing all files as uncovered.");
    console.error("Error:", e.message);
    return {};
  }
}

/**
 * Main analysis function
 */
function analyzeCoverage() {
  console.log("\n📊 Coverage Analysis Report");
  console.log("=".repeat(80));
  console.log(`Analysis mode: ${byFunction ? "Functions" : "Lines"}`);
  console.log(`File types: ${allTypes ? "All (JS, TS, TSX, MJS)" : "TypeScript only (TS, TSX)"}`);
  console.log(`Date: ${new Date().toLocaleString()}`);
  console.log("=".repeat(80) + "\n");

  // Get all code files
  const codeFiles = getAllCodeFiles();
  console.log(`Found ${codeFiles.length} code files`);

  // Get changed files
  const changedFiles = getChangedFiles();
  const changedFilesSet = new Set(changedFiles);
  console.log(`Found ${changedFiles.length} changed/new files (vs main branch + untracked)`);
  if (changedFiles.length > 0) {
    console.log(
      "Changed/new files:",
      changedFiles.map(f => path.relative(projectRoot, f))
    );
  }
  console.log("");

  // Get coverage data
  const coverageData = getCoverageData();

  // Analyze each file
  const fileStats = [];
  let totalLines = 0;
  let totalCovered = 0;

  for (const file of codeFiles) {
    const relativePath = path.relative(projectRoot, file);
    const coverage = coverageData[relativePath] || {};

    let total, covered, uncovered;

    if (coverage.total !== undefined) {
      // Use actual coverage data
      total = coverage.total;
      covered = coverage.covered;
      uncovered = coverage.uncovered;
    } else {
      // File not in coverage report - count as uncovered
      if (byFunction) {
        total = countFunctions(file);
      } else {
        total = countLines(file);
      }
      covered = 0;
      uncovered = total;
    }

    totalLines += total;
    totalCovered += covered;

    const isChanged = changedFilesSet.has(file);

    fileStats.push({
      file: relativePath,
      total,
      covered,
      uncovered,
      percentage: total > 0 ? (covered / total) * 100 : 0,
      isChanged
    });
  }

  // Sort by uncovered lines/functions (descending)
  fileStats.sort((a, b) => b.uncovered - a.uncovered);

  // Separate changed and unchanged files
  const changedFileStats = fileStats.filter(stat => stat.isChanged);
  const unchangedFileStats = fileStats.filter(stat => !stat.isChanged);

  // Display changed files first if any exist
  if (changedFileStats.length > 0) {
    console.log(`🔥 Changed/New Files Coverage (${changedFileStats.length} files):`);
    console.log("-".repeat(85));
    console.log(
      `${"#".padStart(3)} | ${"File".padEnd(45)} | ${byFunction ? "Funcs" : "Lines"} | Covered | Uncovered | Coverage`
    );
    console.log("-".repeat(85));

    // Sort changed files by uncovered lines/functions (descending)
    changedFileStats.sort((a, b) => b.uncovered - a.uncovered);

    let totalChangedLines = 0;
    let totalChangedCovered = 0;
    let totalChangedUncovered = 0;

    for (let i = 0; i < changedFileStats.length; i++) {
      const stat = changedFileStats[i];
      const fileName = stat.file.length > 42 ? "..." + stat.file.slice(-39) : stat.file;

      const coverage = stat.percentage.toFixed(1) + "%";
      const coverageColor =
        stat.percentage >= 80
          ? "\x1b[32m" // green
          : stat.percentage >= 50
            ? "\x1b[33m" // yellow
            : "\x1b[31m"; // red

      // Add row number and changed indicator
      const rowNumber = (i + 1).toString().padStart(2);
      const changedIndicator = "🔄 ";

      console.log(
        `${rowNumber}. | ${changedIndicator}${fileName.padEnd(43)} | ${String(stat.total).padStart(5)} | ${String(stat.covered).padStart(7)} | ${String(stat.uncovered).padStart(9)} | ${coverageColor}${coverage.padStart(8)}\x1b[0m`
      );

      // Accumulate totals
      totalChangedLines += stat.total;
      totalChangedCovered += stat.covered;
      totalChangedUncovered += stat.uncovered;
    }

    console.log("-".repeat(85));

    // Calculate overall changed files coverage
    const overallChangedCoverage =
      totalChangedLines > 0 ? (totalChangedCovered / totalChangedLines) * 100 : 0;
    const overallCoverageColor =
      overallChangedCoverage >= 80
        ? "\x1b[32m" // green
        : overallChangedCoverage >= 50
          ? "\x1b[33m" // yellow
          : "\x1b[31m"; // red

    console.log(
      `${"TOTAL".padStart(3)} | ${"".padEnd(45)} | ${String(totalChangedLines).padStart(5)} | ${String(totalChangedCovered).padStart(7)} | ${String(totalChangedUncovered).padStart(9)} | ${overallCoverageColor}${overallChangedCoverage.toFixed(1).padStart(7)}%\x1b[0m`
    );
    console.log("-".repeat(85));
    console.log();
  }

  // Display top files with most uncovered code from all files
  console.log(
    `📊 Top ${Math.min(topCount, fileStats.length)} files with most uncovered ${byFunction ? "functions" : "lines"} (all files):`
  );
  console.log("-".repeat(80));
  console.log(
    `${"File".padEnd(50)} | ${byFunction ? "Funcs" : "Lines"} | Covered | Uncovered | Coverage`
  );
  console.log("-".repeat(80));

  const topFiles = fileStats.slice(0, topCount);

  for (const stat of topFiles) {
    const fileName = stat.file.length > 47 ? "..." + stat.file.slice(-44) : stat.file;

    const coverage = stat.percentage.toFixed(1) + "%";
    const coverageColor =
      stat.percentage >= 80
        ? "\x1b[32m" // green
        : stat.percentage >= 50
          ? "\x1b[33m" // yellow
          : "\x1b[31m"; // red

    // Add changed indicator for changed files
    const prefix = stat.isChanged ? "🔄 " : "   ";

    console.log(
      `${prefix}${fileName.padEnd(47)} | ${String(stat.total).padStart(5)} | ${String(stat.covered).padStart(7)} | ${String(stat.uncovered).padStart(9)} | ${coverageColor}${coverage.padStart(8)}\x1b[0m`
    );
  }

  console.log("-".repeat(80));

  // Summary statistics
  const overallCoverage = totalLines > 0 ? (totalCovered / totalLines) * 100 : 0;
  const filesWithCoverage = fileStats.filter(f => f.percentage > 0).length;
  const filesFullyCovered = fileStats.filter(f => f.percentage === 100).length;
  const filesNoCoverage = fileStats.filter(f => f.percentage === 0).length;

  // Changed files statistics
  const changedFilesWithCoverage = changedFileStats.filter(f => f.percentage > 0).length;
  const changedFilesFullyCovered = changedFileStats.filter(f => f.percentage === 100).length;
  const changedFilesNoCoverage = changedFileStats.filter(f => f.percentage === 0).length;
  const changedTotalLines = changedFileStats.reduce((sum, f) => sum + f.total, 0);
  const changedCoveredLines = changedFileStats.reduce((sum, f) => sum + f.covered, 0);
  const changedOverallCoverage =
    changedTotalLines > 0 ? (changedCoveredLines / changedTotalLines) * 100 : 0;

  console.log("\n📈 Overall Summary Statistics:");
  console.log("-".repeat(80));
  console.log(`Total files analyzed:        ${fileStats.length}`);
  console.log(
    `Files with coverage:         ${filesWithCoverage} (${((filesWithCoverage / fileStats.length) * 100).toFixed(1)}%)`
  );
  console.log(
    `Files with 100% coverage:    ${filesFullyCovered} (${((filesFullyCovered / fileStats.length) * 100).toFixed(1)}%)`
  );
  console.log(
    `Files with no coverage:      ${filesNoCoverage} (${((filesNoCoverage / fileStats.length) * 100).toFixed(1)}%)`
  );
  console.log(`Total ${byFunction ? "functions" : "lines"}:              ${totalLines}`);
  console.log(`Covered ${byFunction ? "functions" : "lines"}:            ${totalCovered}`);
  console.log(
    `Uncovered ${byFunction ? "functions" : "lines"}:          ${totalLines - totalCovered}`
  );
  console.log(`Overall coverage:            ${overallCoverage.toFixed(2)}%`);
  console.log("-".repeat(80));

  // Changed files summary
  if (changedFileStats.length > 0) {
    console.log("\n🔥 Changed/New Files Summary:");
    console.log("-".repeat(80));
    console.log(`Changed/new files analyzed:  ${changedFileStats.length}`);
    console.log(
      `Changed files with coverage: ${changedFilesWithCoverage} (${changedFileStats.length > 0 ? ((changedFilesWithCoverage / changedFileStats.length) * 100).toFixed(1) : 0}%)`
    );
    console.log(
      `Changed files 100% covered:  ${changedFilesFullyCovered} (${changedFileStats.length > 0 ? ((changedFilesFullyCovered / changedFileStats.length) * 100).toFixed(1) : 0}%)`
    );
    console.log(
      `Changed files no coverage:   ${changedFilesNoCoverage} (${changedFileStats.length > 0 ? ((changedFilesNoCoverage / changedFileStats.length) * 100).toFixed(1) : 0}%)`
    );
    console.log(`Changed ${byFunction ? "functions" : "lines"} total:        ${changedTotalLines}`);
    console.log(
      `Changed ${byFunction ? "functions" : "lines"} covered:      ${changedCoveredLines}`
    );
    console.log(
      `Changed ${byFunction ? "functions" : "lines"} uncovered:    ${changedTotalLines - changedCoveredLines}`
    );
    console.log(`Changed files coverage:      ${changedOverallCoverage.toFixed(2)}%`);
    console.log("-".repeat(80));
  }

  // Coverage distribution
  console.log("\n📊 Coverage Distribution:");
  console.log("-".repeat(80));
  const ranges = [
    { min: 80, max: 100, label: "80-100%", files: [] },
    { min: 60, max: 79, label: "60-79%", files: [] },
    { min: 40, max: 59, label: "40-59%", files: [] },
    { min: 20, max: 39, label: "20-39%", files: [] },
    { min: 1, max: 19, label: "1-19%", files: [] },
    { min: 0, max: 0, label: "0%", files: [] }
  ];

  for (const stat of fileStats) {
    for (const range of ranges) {
      if (range.min === 0 && range.max === 0 && stat.percentage === 0) {
        range.files.push(stat);
        break;
      } else if (stat.percentage >= range.min && stat.percentage <= range.max) {
        range.files.push(stat);
        break;
      }
    }
  }

  for (const range of ranges) {
    const bar = "█".repeat(Math.floor((range.files.length / fileStats.length) * 50));
    console.log(`${range.label.padEnd(10)} ${bar} ${range.files.length} files`);
  }

  console.log("-".repeat(80));
  console.log("\n✅ Analysis complete!\n");

  // Export to JSON if requested
  if (args.includes("--json")) {
    const outputFile = path.join(projectRoot, "coverage-analysis.json");
    fs.writeFileSync(
      outputFile,
      JSON.stringify(
        {
          metadata: {
            date: new Date().toISOString(),
            mode: byFunction ? "functions" : "lines",
            filesAnalyzed: fileStats.length,
            changedFilesAnalyzed: changedFileStats.length
          },
          summary: {
            overallCoverage,
            totalFiles: fileStats.length,
            filesWithCoverage,
            filesFullyCovered,
            filesNoCoverage,
            totalUnits: totalLines,
            coveredUnits: totalCovered,
            uncoveredUnits: totalLines - totalCovered
          },
          changedFilesSummary: {
            changedOverallCoverage,
            changedFilesAnalyzed: changedFileStats.length,
            changedFilesWithCoverage,
            changedFilesFullyCovered,
            changedFilesNoCoverage,
            changedTotalUnits: changedTotalLines,
            changedCoveredUnits: changedCoveredLines,
            changedUncoveredUnits: changedTotalLines - changedCoveredLines
          },
          files: fileStats,
          changedFiles: changedFileStats
        },
        null,
        2
      )
    );
    console.log(`📄 Detailed report saved to: ${outputFile}\n`);
  }
}

// Run the analysis
analyzeCoverage();
