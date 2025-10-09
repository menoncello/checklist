#!/bin/bash

# Test script for Stryker mutation testing with Bun compatibility
# This script runs the test suite in a way that works with Stryker's mutation testing

set -e

# Export environment variable to indicate we're running in Stryker context
export STRYKER_MUTATOR_RUNNER=true

# Change to project root if needed
if [[ ! -f "package.json" ]]; then
  cd "$(dirname "$0")/.."
fi

# Run tests using Bun with configurations optimized for mutation testing
# Note: Bun only supports 'junit' reporter, not 'json'
exec bun test \
  --timeout 10000 \
  --bail \
  "$@"