#!/bin/bash

# Test script for Stryker mutation testing
# Run tests across all packages without reporters that conflict with Stryker

set -e

# Set environment to indicate we're running under Stryker
export STRYKER_MUTATOR_RUNNER=true

# Run all tests using Turbo (will test all packages in monorepo)
exec bun run turbo run test --force --concurrency=1