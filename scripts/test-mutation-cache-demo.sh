#!/usr/bin/env bash

# Demo script to show how Turbo cache works with mutation testing
set -e

echo "🧬 Turbo Mutation Testing Cache Demo"
echo "=================================="
echo

echo "📁 Current directory structure:"
find . -name ".turbo" -type d | head -5
echo

echo "🧹 Cleaning any existing cache..."
rm -rf .turbo reports/mutation
echo "✅ Cache cleaned"
echo

echo "🔄 First run (no cache) - Shared Package:"
echo "-----------------------------------------"
time bun run test:mutation --filter=@checklist/shared --dry-run | grep -A 5 "Cached (Local)"
echo

echo "🔄 Second run (should use cache) - Shared Package:"
echo "----------------------------------------------------"
time bun run test:mutation --filter=@checklist/shared --dry-run | grep -A 5 "Cached (Local)"
echo

echo "🔄 First run (no cache) - Core Package:"
echo "--------------------------------------"
time bun run test:mutation --filter=@checklist/core --dry-run | grep -A 5 "Cached (Local)"
echo

echo "🔄 Second run (should use cache) - Core Package:"
echo "-------------------------------------------------"
time bun run test:mutation --filter=@checklist/core --dry-run | grep -A 5 "Cached (Local)"
echo

echo "📊 Cache Summary:"
echo "------------------"
echo "Cache directory size:"
du -sh .turbo 2>/dev/null || echo "No cache directory found"
echo

echo "Available mutation scripts:"
bun run | grep "test:mutation" | head -10
echo

echo "✅ Demo completed! The cache should show:"
echo "   - First run: Cached (Local) = false"
echo "   - Second run: Cached (Local) = true"