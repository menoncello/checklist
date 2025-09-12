#!/bin/bash

echo "🔍 Analyzing UNIT tests performance..."
echo "===================================="
echo ""

# Run unit tests only and capture output
echo "Running bun run test:unit..."
TEST_OUTPUT=$(bun run test:unit 2>&1)

echo "🚨 Unit tests over 10 seconds:"
echo "------------------------------"
echo "$TEST_OUTPUT" | grep "✓\|✔" | grep -E "\[[0-9]{5,}\.[0-9]+ms\]" | sort -t'[' -k2 -rn | head -10

echo ""
echo "⚠️  Unit tests over 1 second (1000ms):"
echo "---------------------------------------"
echo "$TEST_OUTPUT" | grep "✓\|✔" | grep -E "\[[0-9]{4,}\.[0-9]+ms\]" | sort -t'[' -k2 -rn | head -15

echo ""
echo "⏱️  Unit tests over 500ms:"
echo "--------------------------"
echo "$TEST_OUTPUT" | grep "✓\|✔" | grep -E "\[[5-9][0-9]{2,}\.[0-9]+ms\]" | sort -t'[' -k2 -rn | head -20

echo ""
echo "📊 Unit tests over 100ms:"
echo "-------------------------"
echo "$TEST_OUTPUT" | grep "✓\|✔" | grep -E "\[[1-9][0-9]{2,}\.[0-9]+ms\]" | sort -t'[' -k2 -rn | head -20

echo ""
echo "📁 File-level timing (unit tests only):"
echo "---------------------------------------"
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
echo "Unit test slow counts:"
echo "  > 10s:   $OVER_10S tests"
echo "  > 1s:    $OVER_1S tests" 
echo "  > 500ms: $OVER_500MS tests"
echo "  > 100ms: $OVER_100MS tests"

# Show failed tests if any
FAILED=$(echo "$TEST_OUTPUT" | grep -c "fail")
if [ "$FAILED" -gt 0 ]; then
    echo ""
    echo "❌ Failed tests:"
    echo "----------------"
    echo "$TEST_OUTPUT" | grep -B2 -A1 "fail" | head -20
fi

echo ""
echo "💡 Performance Tips:"
echo "-------------------"
echo "- Tests over 100ms might need optimization"
echo "- Consider using mocks instead of real I/O"
echo "- Use TestDataFactory for fast test data generation"
echo "- Avoid setTimeout/delays in unit tests"