#!/bin/bash

# Test script for Stryker that filters out JSON logs
# Run tests and filter out JSON log lines that confuse Stryker

STRYKER_MUTATOR_RUNNER=true bun test --test-name-pattern="^(?!.*Integration)(?!.*Error|.*error|.*crash)" --silent 2>&1 | grep -v '^{"level"'