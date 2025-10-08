#!/bin/bash

# Test script for Stryker that filters out JSON logs
# Run CLI tests and filter out JSON log lines that confuse Stryker

cd apps/cli && STRYKER_MUTATOR_RUNNER=true bun test --silent 2>&1 | grep -v '^{"level"'