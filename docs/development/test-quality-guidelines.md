# Test Quality Guidelines

**Purpose**: Maintain high test quality standards in the BMAD Checklist Manager project.

## Quick Reference

### ✅ **Do's - High Quality Test Patterns**

```typescript
// 1. Import the actual code you're testing
import { FunctionToTest } from '../src/module';

// 2. Use meaningful assertions
expect(result).toEqual(expectedValue);
expect(mockFunction).toHaveBeenCalledWith(expectedArgs);
expect(result).toHaveProperty('key');
expect(array).toContain(expectedItem);

// 3. Test real behavior, not just truthiness
test('should process data correctly', () => {
  const input = { name: 'test', value: 42 };
  const result = processor.process(input);
  expect(result.name).toBe('test');
  expect(result.processed).toBe(true);
});

// 4. Use comprehensive test data
const testCases = [
  { input: { a: 1, b: 2 }, expected: 3 },
  { input: { a: -1, b: 5 }, expected: 4 },
  { input: { a: 0, b: 0 }, expected: 0 },
];

testCases.forEach(({ input, expected }) => {
  test(`should handle ${JSON.stringify(input)}`, () => {
    expect(calculator.add(input)).toBe(expected);
  });
});
```

### ❌ **Don'ts - Anti-Patterns to Avoid**

```typescript
// 1. Don't test trivial truthiness
test('should be true', () => {
  expect(value).toBe(true); // BAD - no behavior verification
});

// 2. Don't reimplement logic inline
test('should calculate percentage', () => {
  const result = (actual / expected) * 100; // BAD - inline reimplementation
  expect(result).toBe(50);
});

// 3. Don't mock the code you're testing
jest.mock('../src/module'); // BAD - mocking target file

// 4. Don't use only basic assertions without context
expect(obj).toBeDefined(); // BAD - doesn't verify behavior
```

## Detailed Guidelines

### 1. Test Structure

#### **File Organization**
```
src/
  module.ts
  module.test.ts  // Test alongside source
```

#### **Test Naming**
```typescript
describe('ModuleName', () => {
  describe('methodName', () => {
    test('should behave correctly when given valid input', () => {
      // Implementation
    });

    test('should handle edge case gracefully', () => {
      // Implementation
    });
  });
});
```

### 2. Import Patterns

#### **✅ Correct Imports**
```typescript
// Import the actual implementation
import { StateValidator } from '../../src/state/validation';
import { ChecklistState } from '../../src/state/types';

// Mock external dependencies
import { createMockFileSystem } from '../mocks/fileSystem';
```

#### **❌ Incorrect Imports**
```typescript
// Don't use malformed imports
import { StateValidatorChecklistState } from '../../src/state/types'; // WRONG

// Don't mock the code you're testing
jest.mock('../../src/state/validation'); // WRONG
```

### 3. Assertion Quality

#### **✅ Meaningful Assertions**
```typescript
// Test specific behavior
expect(result.status).toBe('success');
expect(result.data).toHaveLength(expectedLength);
expect(mockApi).toHaveBeenCalledWith('GET', '/api/data');

// Test object structure
expect(result).toHaveProperty('id');
expect(result).toMatchObject({ name: 'test', active: true });

// Test collections
expect(errors).toContain('validation error');
expect(users).toEqual(
  expect.arrayContaining([
    expect.objectContaining({ id: 1, name: 'John' })
  ])
);
```

#### **❌ Weak Assertions**
```typescript
// Avoid generic truthiness
expect(result).toBe(true); // BAD
expect(result).toBeDefined(); // BAD
expect(!!result).toBe(true); // BAD

// Instead, test specific behavior
expect(result.success).toBe(true); // GOOD
expect(result.errors).toEqual([]); // GOOD
```

### 4. Test Data Management

#### **✅ Good Test Data Patterns**
```typescript
// Use descriptive test data
const validUser = {
  id: 'user-123',
  name: 'John Doe',
  email: 'john@example.com',
  status: 'active',
};

// Create data factories for complex objects
function createTestUser(overrides = {}) {
  return {
    id: 'test-id',
    name: 'Test User',
    email: 'test@example.com',
    ...overrides,
  };
}

// Use parameterized tests
const testCases = [
  { input: [1, 2, 3], expected: 6 },
  { input: [], expected: 0 },
  { input: [-1, -2, -3], expected: -6 },
];

test.each(testCases)('should sum $input to get $expected', ({ input, expected }) => {
  expect(calculator.sum(input)).toBe(expected);
});
```

### 5. Mock Usage

#### **✅ Proper Mocking**
```typescript
// Mock external dependencies
jest.mock('node:fs', () => ({
  readFileSync: jest.fn(),
  writeFileSync: jest.fn(),
}));

// Mock interfaces, not implementations
const mockDatabase = {
  find: jest.fn(),
  save: jest.fn(),
  delete: jest.fn(),
};

// Setup mock behavior
mockDatabase.find.mockResolvedValue([{ id: 1, name: 'test' }]);
```

#### **❌ Improper Mocking**
```typescript
// Don't mock the code you're testing
jest.mock('../src/calculator'); // WRONG

// Don't mock simple operations
jest.mock('lodash', () => ({ sum: jest.fn() })); // OVERKILL
```

### 6. Error Handling Tests

#### **✅ Comprehensive Error Testing**
```typescript
test('should throw ValidationError for invalid input', () => {
  const invalidInput = { name: '', email: 'invalid' };

  expect(() => validator.validate(invalidInput))
    .toThrow(ValidationError);
});

test('should handle network errors gracefully', async () => {
  mockApi.mockRejectedValue(new Error('Network error'));

  await expect(service.fetchData())
    .rejects.toThrow('Network error');
});
```

### 7. Integration vs Unit Tests

#### **Unit Tests** - Fast, isolated tests
```typescript
test('should validate email format', () => {
  expect(validator.isValidEmail('user@example.com')).toBe(true);
  expect(validator.isValidEmail('invalid')).toBe(false);
});
```

#### **Integration Tests** - Test component interactions
```typescript
test('should save user to database and return ID', async () => {
  const user = createTestUser();
  const result = await userService.save(user);

  expect(result.id).toBeDefined();
  expect(result.name).toBe(user.name);

  // Verify database was called
  expect(mockDatabase.save).toHaveBeenCalledWith(
    expect.objectContaining({ name: user.name })
  );
});
```

## Common Pitfalls and Solutions

### 1. **Import Issues**
```typescript
// ❌ Problem: Malformed import
import { ClassType } from './types';

// ✅ Solution: Proper imports
import { Class, Type } from './types';
```

### 2. **Async/Await Issues**
```typescript
// ❌ Problem: Forgetting await
const result = asyncFunction();
expect(result).toBe(expected); // Testing Promise, not result

// ✅ Solution: Proper async handling
const result = await asyncFunction();
expect(result).toBe(expected);
```

### 3. **Mock Setup Issues**
```typescript
// ❌ Problem: Mock not properly setup
mockFunction.mockReturnValue(expected);
expect(result).toBe(expected); // mockFunction never called

// ✅ Solution: Verify mock was used
expect(mockFunction).toHaveBeenCalledWith(expectedInput);
```

## Test Quality Checklist

Before committing tests, verify:

### **Structure** ✅
- [ ] Test file has correct imports
- [ ] Tests are properly grouped in `describe` blocks
- [ ] Test names are descriptive
- [ ] Tests are isolated (no shared state)

### **Assertions** ✅
- [ ] Tests verify actual behavior, not just truthiness
- [ ] Assertions are specific and meaningful
- [ ] Edge cases are covered
- [ ] Error conditions are tested

### **Dependencies** ✅
- [ ] External dependencies are properly mocked
- [ ] Target code is not mocked
- [ ] Mock setup is in appropriate `beforeEach`/`afterEach`
- [ ] Test cleanup is handled

### **Data** ✅
- [ ] Test data is realistic and meaningful
- [ ] Test data is isolated per test
- [ ] Complex objects use factories or builders
- [ ] Test cases cover expected scenarios

## Running Tests

```bash
# Run all tests
bun test

# Run specific test file
bun test packages/core/tests/state/validation.test.ts

# Run tests in watch mode
bun test --watch

# Run tests with coverage
bun test --coverage

# Run only failing tests
bun test --reporter=verbose
```

## Quality Monitoring

The project uses automated test quality analysis to maintain standards. The analysis checks for:

1. **Import correctness** - Ensures tests import their target files
2. **Assertion quality** - Identifies trivial vs meaningful assertions
3. **Mock usage** - Detects inappropriate mocking of target code
4. **Inline logic** - Flags reimplementation of business logic

Run the quality analysis:
```bash
# Note: Analysis script was used during quality improvement
# Future quality monitoring can be added as needed
```

## Conclusion

Following these guidelines ensures our tests provide reliable verification of application behavior, making the codebase more maintainable and reducing the likelihood of bugs in production.

**Key principle**: Tests should verify **what the code does**, not **how it does it**. Focus on behavior, implementation details, and edge cases that matter to users.

---

*Last updated: October 5, 2025*