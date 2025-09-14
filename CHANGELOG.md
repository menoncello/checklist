# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Fixed
- Fixed all failing tests (8 tests total)
  - Fixed WorkflowEngine test failures (2 tests) by correcting the `emitWorkflowCompletedIfFinished` method to check workflow state status
  - Fixed dashboard test failures (6 tests) by updating test expectations to match logger-based implementation
- Fixed MigrationError constructor signature mismatch across multiple files
  - Updated MigrationExecutor.ts to use correct constructor parameters (message, fromVersion, toVersion, cause)
  - Updated MigrationValidator.ts to use correct constructor parameters
- Fixed TypeScript compilation errors (37 errors)
  - Added `msg` property to all logger calls
  - Fixed event emission types in WorkflowEngine
  - Added missing `lastModified` property in MigrationRunner
  - Fixed type guards and nullish coalescing issues
- Fixed ESLint errors (26 errors)
  - Replaced console statements with logger methods in PerformanceDashboard
  - Replaced `any` types with `unknown`
  - Removed test files from source directories

### Changed
- Refactored PerformanceDashboard to use structured logging instead of console methods
- Updated all console.log, console.clear, and console.table calls to use pino logger
- Improved error handling in migration system

### Technical Details
- All 1461 tests now passing with 0 failures
- Test coverage maintained above 80% for core package
- Code quality checks (lint, typecheck, tests) all passing