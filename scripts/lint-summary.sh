#!/bin/bash

# Lint Summary Script
# Generates a quick summary of files with most lint issues

echo "=================================="
echo "     LINT ISSUES SUMMARY"
echo "=================================="
echo ""

# Run ESLint and capture output
echo "🔍 Analyzing code quality issues..."

# Create temporary file for ESLint output
TEMP_FILE=$(mktemp)

# Run ESLint and save output
bun run lint 2>&1 | tee "$TEMP_FILE" > /dev/null

# Count total errors
TOTAL_ERRORS=$(grep -c "error" "$TEMP_FILE" || echo "0")
echo "📊 Total violations found: $TOTAL_ERRORS"
echo ""

# Extract and count violations by type
echo "📈 Top Violation Types:"
echo "------------------------"
grep -oE '[a-z-]+$' "$TEMP_FILE" | grep -v "^$" | sort | uniq -c | sort -rn | head -10 | while read count rule; do
    printf "  %-30s %s\n" "$rule" "($count)"
done
echo ""

# Extract files with violations and count them properly
echo "📁 Files with Most Issues:"
echo "--------------------------"

# Create a temporary file to store file counts
COUNTS_FILE=$(mktemp)

# Process each line and aggregate counts by file
while IFS= read -r line; do
    if [[ "$line" =~ ^/Users.*\.ts ]] || [[ "$line" =~ ^/Users.*\.js ]]; then
        # Extract just the file path (before the first colon and line number)
        file_path=$(echo "$line" | sed 's/:[0-9].*$//')
        echo "$file_path" >> "$COUNTS_FILE"
    fi
done < "$TEMP_FILE"

# Count occurrences and sort
sort "$COUNTS_FILE" | uniq -c | sort -rn | head -20 | while read count file; do
    # Get just the relative path
    rel_path=$(echo "$file" | sed "s|$PWD/||")
    printf "  %3d issues: %s\n" "$count" "$rel_path"
done

# Clean up counts file
rm "$COUNTS_FILE"
echo ""

# Count violations by package
echo "📦 Violations by Package:"
echo "-------------------------"
grep -E "^/Users" "$TEMP_FILE" | grep -oE "packages/[^/]+" | sort | uniq -c | sort -rn | while read count package; do
    printf "  %-20s %d issues\n" "$package" "$count"
done
echo ""

# Specific quality metrics violations
echo "📏 Code Quality Metrics:"
echo "------------------------"
echo "  max-lines:              $(grep -c "max-lines" "$TEMP_FILE" || echo "0")"
echo "  max-lines-per-function: $(grep -c "max-lines-per-function" "$TEMP_FILE" || echo "0")"
echo "  complexity:             $(grep -c "complexity" "$TEMP_FILE" || echo "0")"
echo "  max-depth:              $(grep -c "max-depth" "$TEMP_FILE" || echo "0")"
echo "  max-params:             $(grep -c "max-params" "$TEMP_FILE" || echo "0")"
echo "  max-nested-callbacks:   $(grep -c "max-nested-callbacks" "$TEMP_FILE" || echo "0")"
echo ""

# Clean up
rm "$TEMP_FILE"

echo "=================================="
echo "Run 'node scripts/lint-report.js' for detailed analysis"
echo "=================================="