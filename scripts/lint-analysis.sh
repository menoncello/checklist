#!/bin/bash

# Enhanced Lint Analysis Script
# Provides accurate count of violations per file

echo "=================================="
echo "     LINT ANALYSIS REPORT"
echo "=================================="
echo ""

# Run ESLint with JSON output for accurate parsing
echo "🔍 Running ESLint analysis..."

# Use JSON output for accurate parsing
TEMP_JSON=$(mktemp)
bun x eslint . --format json > "$TEMP_JSON" 2>/dev/null || true

# Check if we have valid JSON
if [ ! -s "$TEMP_JSON" ]; then
    echo "❌ Failed to generate ESLint report"
    rm "$TEMP_JSON"
    exit 1
fi

# Parse JSON using node for accurate results
node -e "
const fs = require('fs');
const data = JSON.parse(fs.readFileSync('$TEMP_JSON', 'utf8'));

let totalErrors = 0;
let totalWarnings = 0;
let filesWithIssues = 0;
const fileStats = [];
const ruleStats = {};
const packageStats = {};

// Process each file
data.forEach(file => {
    if (file.errorCount > 0 || file.warningCount > 0) {
        filesWithIssues++;
        totalErrors += file.errorCount;
        totalWarnings += file.warningCount;

        // Extract relative path
        const relativePath = file.filePath.replace('$PWD/', '');

        // Extract package name
        const packageMatch = relativePath.match(/packages\/([^\/]+)/);
        const packageName = packageMatch ? 'packages/' + packageMatch[1] : 'root';

        // Update package stats
        if (!packageStats[packageName]) {
            packageStats[packageName] = { errors: 0, warnings: 0, files: 0 };
        }
        packageStats[packageName].errors += file.errorCount;
        packageStats[packageName].warnings += file.warningCount;
        packageStats[packageName].files++;

        // Store file info
        fileStats.push({
            path: relativePath,
            errors: file.errorCount,
            warnings: file.warningCount,
            total: file.errorCount + file.warningCount
        });

        // Count rule violations
        file.messages.forEach(msg => {
            const rule = msg.ruleId || 'unknown';
            ruleStats[rule] = (ruleStats[rule] || 0) + 1;
        });
    }
});

// Sort files by total issues
fileStats.sort((a, b) => b.total - a.total);

// Output summary
console.log('📊 SUMMARY');
console.log('----------');
console.log('Files with issues:', filesWithIssues);
console.log('Total errors:', totalErrors);
console.log('Total warnings:', totalWarnings);
console.log('');

// Output top violation types
console.log('🚫 TOP VIOLATION TYPES');
console.log('----------------------');
const sortedRules = Object.entries(ruleStats)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

sortedRules.forEach(([rule, count]) => {
    console.log(String(count).padStart(4), rule);
});
console.log('');

// Output files with most issues
console.log('📁 TOP 20 FILES WITH MOST ISSUES');
console.log('---------------------------------');
fileStats.slice(0, 20).forEach(file => {
    const issues = String(file.total).padStart(3);
    const errors = String(file.errors).padStart(2);
    const warnings = String(file.warnings).padStart(2);
    console.log(\`\${issues} issues (E:\${errors} W:\${warnings}): \${file.path}\`);
});
console.log('');

// Output package summary
console.log('📦 VIOLATIONS BY PACKAGE');
console.log('------------------------');
const sortedPackages = Object.entries(packageStats)
    .sort((a, b) => b[1].errors - a[1].errors);

sortedPackages.forEach(([pkg, stats]) => {
    console.log(\`\${pkg}:\`);
    console.log(\`  Files: \${stats.files}, Errors: \${stats.errors}, Warnings: \${stats.warnings}\`);
});
console.log('');

// Code quality metrics
const qualityMetrics = {
    'max-lines': ruleStats['max-lines'] || 0,
    'max-lines-per-function': ruleStats['max-lines-per-function'] || 0,
    'complexity': ruleStats['complexity'] || 0,
    'max-depth': ruleStats['max-depth'] || 0,
    'max-params': ruleStats['max-params'] || 0,
    'max-nested-callbacks': ruleStats['max-nested-callbacks'] || 0
};

console.log('📏 CODE QUALITY METRICS');
console.log('-----------------------');
Object.entries(qualityMetrics).forEach(([rule, count]) => {
    if (count > 0) {
        console.log(\`\${String(count).padStart(4)} \${rule}\`);
    }
});
"

# Clean up
rm "$TEMP_JSON"

echo ""
echo "=================================="
echo "For detailed analysis with visualization, run:"
echo "  bun run lint:analysis"
echo "=================================="