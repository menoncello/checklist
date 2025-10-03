#!/bin/bash

# Sequential Test Runner Script
# Runs tests in logical blocks to isolate issues and provide detailed reporting

# ANSI color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
WHITE='\033[1;37m'
NC='\033[0m' # No Color

# Test suites to run in order
TEST_SUITES=(
    "packages/core/tests/state"
    "packages/core/tests/container"
    "packages/core/tests/services"
    "packages/core/tests/utils"
    "packages/core/tests/workflow"
    "packages/tui/tests/performance"
    "packages/tui/tests/terminal"
    "packages/tui/tests/navigation"
    "packages/tui/tests/application"
    "packages/cli/tests"
)

# Function to run a single test suite
run_test_suite() {
    local suite_path=$1
    local suite_name=$(basename "$suite_path")

    echo -e "${BLUE}🧪 Running test suite: $suite_name${NC}"
    echo -e "${BLUE}   Path: $suite_path${NC}"

    # Run tests with specific timeout and isolation
    if bun test "$suite_path" --timeout 30000 --bail 2>&1; then
        echo -e "${GREEN}✅ PASSED: $suite_name${NC}"
        return 0
    else
        echo -e "${RED}❌ FAILED: $suite_name${NC}"
        return 1
    fi
}

# Function to cleanup between test runs
cleanup_test_env() {
    echo -e "${PURPLE}🧹 Cleaning up test environment...${NC}"

    # Clear any temporary files
    rm -rf .bun-test-cache

    # Clear any global state if needed
    # Add any additional cleanup steps here

    # Small delay to ensure cleanup completes
    sleep 1
}

# Main execution
main() {
    echo -e "${WHITE}🚀 Starting Sequential Test Execution${NC}"
    echo -e "${WHITE}=====================================${NC}"

    local total_tests=0
    local passed_tests=0
    local failed_tests=0
    local failed_suites=()

    # Run each test suite with isolation
    for suite in "${TEST_SUITES[@]}"; do
        echo ""
        echo -e "${CYAN}Test Suite #$((total_tests + 1))${NC}"
        echo -e "${CYAN}-------------------${NC}"

        # Cleanup before running tests
        cleanup_test_env

        # Run the test suite
        if run_test_suite "$suite"; then
            ((passed_tests++))
        else
            ((failed_tests++))
            failed_suites+=("$suite")
        fi

        ((total_tests++))

        # Brief pause between suites
        sleep 2
    done

    # Final report
    echo ""
    echo -e "${WHITE}=====================================${NC}"
    echo -e "${WHITE}📊 FINAL TEST RESULTS${NC}"
    echo -e "${WHITE}=====================================${NC}"
    echo -e "${GREEN}✅ Passed suites: $passed_tests${NC}"
    echo -e "${RED}❌ Failed suites: $failed_tests${NC}"
    echo -e "${BLUE}📋 Total suites: $total_tests${NC}"

    if [ $failed_tests -gt 0 ]; then
        echo ""
        echo -e "${RED}Failed test suites:${NC}"
        for failed_suite in "${failed_suites[@]}"; do
            echo -e "${RED}  - $failed_suite${NC}"
        done
        echo ""
        echo -e "${YELLOW}💡 Run individual failed suites for detailed error analysis:${NC}"
        for failed_suite in "${failed_suites[@]}"; do
            echo -e "${YELLOW}   bun test \"$failed_suite\" --verbose${NC}"
        done
        exit 1
    else
        echo ""
        echo -e "${GREEN}🎉 All test suites passed!${NC}"
        exit 0
    fi
}

# Handle interruption gracefully
trap 'echo -e "\n${YELLOW}⚠️  Test execution interrupted${NC}"; exit 130' INT TERM

# Run main function
main "$@"