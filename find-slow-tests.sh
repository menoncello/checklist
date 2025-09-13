#!/bin/bash

echo "🔍 Finding slow tests (>100ms)..."
echo "================================"
echo ""

# Run tests and capture output with timing
TEST_OUTPUT=$(bun test 2>&1)

echo "🚨 Tests over 10 seconds:"
echo "-------------------------"
echo "$TEST_OUTPUT" | grep "✓\|✔" | grep -E "\[[0-9]{5,}\.[0-9]+ms\]" | sort -t'[' -k2 -rn | head -20

echo ""
echo "⚠️  Tests over 1 second (1000ms):"
echo "----------------------------------"
echo "$TEST_OUTPUT" | grep "✓\|✔" | grep -E "\[[0-9]{4,}\.[0-9]+ms\]" | sort -t'[' -k2 -rn | head -20

echo ""
echo "⏱️  Tests over 500ms:"
echo "---------------------"
echo "$TEST_OUTPUT" | grep "✓\|✔" | grep -E "\[[5-9][0-9]{2,}\.[0-9]+ms\]" | sort -t'[' -k2 -rn | head -20

echo ""
echo "📊 Tests over 100ms:"
echo "--------------------"
echo "$TEST_OUTPUT" | grep "✓\|✔" | grep -E "\[[1-9][0-9]{2,}\.[0-9]+ms\]" | sort -t'[' -k2 -rn | head -20

echo ""
echo "📁 File-level timing:"
echo "--------------------"
echo "$TEST_OUTPUT" | grep "Ran.*tests.*\[" | sort -t'[' -k2 -rn | head -10

echo ""
echo "Summary:"
echo "--------"
TOTAL=$(echo "$TEST_OUTPUT" | grep "Ran.*tests.*across.*files" | tail -1)
echo "$TOTAL"

# Count slow tests
OVER_10S=$(echo "$TEST_OUTPUT" | grep "✓\|✔" | grep -E "\[[0-9]{5,}\.[0-9]+ms\]" | wc -l)
OVER_1S=$(echo "$TEST_OUTPUT" | grep "✓\|✔" | grep -E "\[[0-9]{4,}\.[0-9]+ms\]" | wc -l)
OVER_500MS=$(echo "$TEST_OUTPUT" | grep "✓\|✔" | grep -E "\[[5-9][0-9]{2,}\.[0-9]+ms\]" | wc -l)
OVER_100MS=$(echo "$TEST_OUTPUT" | grep "✓\|✔" | grep -E "\[[1-9][0-9]{2,}\.[0-9]+ms\]" | wc -l)

echo ""
echo "Slow test counts:"
echo "  > 10s:   $OVER_10S tests"
echo "  > 1s:    $OVER_1S tests"
echo "  > 500ms: $OVER_500MS tests"
echo "  > 100ms: $OVER_100MS tests"