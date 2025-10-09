const fs = require('fs');

const filePath =
  './packages/tui/tests/performance/metrics/AlertManager.test.ts';
let content = fs.readFileSync(filePath, 'utf8');

// Pattern 1: Fix lines like "metadata: { metric: 'xxx' }" followed immediately by "alertManager.checkAlerts"
// These need a closing brace and semicolon
content = content.replace(
  /(metadata:\s*\{\s*metric:\s*'[^']+'\s*\})\s*\n\s*(alertManager\.checkAlerts)/g,
  '$1\n      };\n\n      $2'
);

// Pattern 2: Fix lines like "};      const alerts" that should be "      const alerts"
content = content.replace(/\};\s+const alerts/g, '      const alerts');

// Pattern 3: Fix extra closing braces followed by "expect"
content = content.replace(/\s*\};\s+(expect\(alert)/g, '\n      $1');

// Pattern 4: Fix "{ timestamp:" patterns that are missing closing braces before arrays
content = content.replace(
  /(\{ timestamp: \d+, value: [^,]+, metadata: \{ metric: '[^']+' \},)\s*\n\s*(\{ timestamp:)/g,
  '$1 },\n        $2'
);

// Pattern 5: Fix the specific pattern "otherField: 'value' };" that should be "otherField: 'value' }"
content = content.replace(/otherField: 'value' \};/g, "otherField: 'value' }");

// Pattern 6: Fix "metadata: { metric: 'xxx' }" without closing brace at specific lines
const lines = content.split('\n');
for (let i = 0; i < lines.length - 1; i++) {
  const line = lines[i];
  const nextLine = lines[i + 1];

  // Check if current line ends with metadata object but no closing brace for MetricPoint
  if (
    line.trim().match(/metadata:\s*\{\s*metric:\s*'[^']+'\s*\}$/) &&
    !line.trim().match(/\}\s*,?\s*$/) &&
    !nextLine.trim().startsWith('}')
  ) {
    // Check if it's part of a MetricPoint definition (look back for opening brace)
    for (let j = i; j >= Math.max(0, i - 5); j--) {
      if (
        lines[j].includes('MetricPoint') ||
        lines[j].trim().match(/^(const|let)\s+\w+:\s*MetricPoint\s*=\s*\{/)
      ) {
        // Add closing brace
        lines[i] = line + '\n      };';
        break;
      }
    }
  }
}
content = lines.join('\n');

// Clean up any double closing braces that might have been created
content = content.replace(/\}\s*\};\s*\};/g, '};');

fs.writeFileSync(filePath, content, 'utf8');
console.log('Fixed AlertManager.test.ts');
