#!/bin/bash

echo "🔍 Analyzing test performance..."
echo "================================"
echo ""

# Run tests and capture output
TEST_OUTPUT=$(bun test 2>&1)

# Extract test times and sort by duration
echo "Top 20 Slowest Tests:"
echo "---------------------"
echo "$TEST_OUTPUT" | grep -E "\[.*ms\]" | sed 's/.*\[/[/' | sort -t'[' -k2 -rn | head -20

echo ""
echo "Test Files by Total Duration:"
echo "-----------------------------"
echo "$TEST_OUTPUT" | grep -E "Ran .* tests across .* file.*\[.*ms\]" | sort -t'[' -k2 -rn

echo ""
echo "Summary Statistics:"
echo "------------------"
TOTAL_TESTS=$(echo "$TEST_OUTPUT" | grep -E "pass|fail" | tail -1)
echo "$TOTAL_TESTS"

# Check for tests over 100ms
echo ""
echo "⚠️  Tests over 100ms (need optimization):"
echo "----------------------------------------"
echo "$TEST_OUTPUT" | grep -E "\[[0-9]{3,}\..*ms\]" | grep -v "Ran" | head -20 || echo "None found! ✅"

# Check for tests over 500ms
echo ""
echo "🚨 Tests over 500ms (violate bunfig.toml timeout):"
echo "------------------------------------------------"
echo "$TEST_OUTPUT" | grep -E "\[[5-9][0-9]{2,}\..*ms\]" | head -20 || echo "None found! ✅"

echo ""
echo "Total execution time:"
echo "$TEST_OUTPUT" | tail -1