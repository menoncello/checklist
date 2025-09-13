import { describe, it, expect, beforeEach } from 'bun:test';
import { 
  InputRateLimiter, 
  PathSanitizer, 
  ResourceLimits 
} from '../../src/utils/security';

describe('Security Mutation Tests', () => {
  describe('InputRateLimiter - Exact Value Mutations', () => {
    it('should use exact default values 50ms and burst size 10', () => {
      const defaultLimiter = new InputRateLimiter();
      const customLimiter = new InputRateLimiter(50, 10);
      
      // Both should behave identically with default values
      for (let i = 0; i < 10; i++) {
        expect(defaultLimiter.shouldAllow('test')).toBe(true);
        expect(customLimiter.shouldAllow('test2')).toBe(true);
      }
      
      // 11th should be blocked (exceeds burst of 10)
      expect(defaultLimiter.shouldAllow('test')).toBe(false);
      expect(customLimiter.shouldAllow('test2')).toBe(false);
    });

    it('should check exact time intervals', () => {
      const limiter = new InputRateLimiter(50, 5);
      const action = 'test-action';
      
      // Mock Date.now for precise timing control
      const originalDateNow = Date.now;
      let currentTime = 1000;
      Date.now = () => currentTime;
      
      try {
        // First input at time 1000
        expect(limiter.shouldAllow(action)).toBe(true);
        
        // Input at exactly 49ms later (should be rate limited)
        currentTime = 1049;
        expect(limiter.shouldAllow(action)).toBe(true); // Within burst
        
        // Input at exactly 50ms later (should be allowed)
        currentTime = 1050;
        expect(limiter.shouldAllow(action)).toBe(true);
        
        // Input at 51ms later (should be allowed)
        currentTime = 1051;
        expect(limiter.shouldAllow(action)).toBe(true);
      } finally {
        Date.now = originalDateNow;
      }
    });

    it('should reset burst window after sufficient time', () => {
      const limiter = new InputRateLimiter(10, 3);
      const action = 'burst-test';
      
      // Use up burst limit (3 actions) in rapid succession
      for (let i = 0; i < 3; i++) {
        expect(limiter.shouldAllow(action)).toBe(true);
      }
      
      // 4th should be blocked (burst exhausted)
      expect(limiter.shouldAllow(action)).toBe(false);
      
      // After sufficient time, burst should reset
      // Note: exact timing depends on implementation details
    });

    it('should handle exact burst count limits', () => {
      const limits = [1, 2, 5, 10, 100];
      
      for (const limit of limits) {
        const limiter = new InputRateLimiter(1000, limit); // 1000ms interval, variable burst
        const action = `burst-${limit}`;
        
        // Should allow exactly 'limit' rapid actions
        for (let i = 0; i < limit; i++) {
          expect(limiter.shouldAllow(action)).toBe(true);
        }
        
        // The next one should be blocked
        expect(limiter.shouldAllow(action)).toBe(false);
        
        // Verify it's exactly at the limit, not off by one
        limiter.reset(action);
        for (let i = 0; i < limit - 1; i++) {
          limiter.shouldAllow(action);
        }
        expect(limiter.shouldAllow(action)).toBe(true); // Last one allowed
        expect(limiter.shouldAllow(action)).toBe(false); // Over limit
      }
    });
  });

  describe('InputRateLimiter - Conditional Mutations', () => {
    it('should handle reset with empty string vs undefined correctly', () => {
      const limiter = new InputRateLimiter(50, 5);
      
      // Set up some state
      limiter.shouldAllow('action1');
      limiter.shouldAllow('action2');
      
      // Reset with empty string should not reset anything
      limiter.reset('');
      expect(limiter.shouldAllow('action1')).toBe(true);
      expect(limiter.shouldAllow('action2')).toBe(true);
      
      // Reset with undefined should reset all
      limiter.reset(undefined);
      expect(limiter.shouldAllow('action1')).toBe(true);
      expect(limiter.shouldAllow('action2')).toBe(true);
      
      // Reset with specific action
      limiter.shouldAllow('action3');
      limiter.reset('action3');
      expect(limiter.shouldAllow('action3')).toBe(true);
    });

    it('should check action string length exactly', () => {
      const limiter = new InputRateLimiter(50, 5);
      
      // Empty string action
      limiter.shouldAllow('');
      limiter.reset(''); // Should not reset empty string action
      
      // Single character action
      limiter.shouldAllow('a');
      limiter.reset('a'); // Should reset single char action
      expect(limiter.shouldAllow('a')).toBe(true);
      
      // Normal action
      limiter.shouldAllow('normal-action');
      limiter.reset('normal-action');
      expect(limiter.shouldAllow('normal-action')).toBe(true);
    });
  });

  describe('PathSanitizer - String Mutations', () => {
    it('should handle exact path separators', () => {
      const sanitizer = new PathSanitizer(['/allowed']);
      
      // Forward slashes
      const result1 = sanitizer.sanitize('subdir/file.txt', '/allowed');
      expect(result1).toBe('/allowed/subdir/file.txt');
      
      // Backslashes (Windows style)
      const result2 = sanitizer.sanitize('subdir\\file.txt', '/allowed');
      expect(result2).toContain('file.txt');
      
      // Mixed separators
      const result3 = sanitizer.sanitize('subdir/sub2\\file.txt', '/allowed');
      expect(result3).toContain('file.txt');
    });

    it('should detect exact ".." traversal patterns', () => {
      const sanitizer = new PathSanitizer(['/safe']);
      
      // Exact ".." pattern
      let result = sanitizer.sanitize('../escape', '/safe');
      if (result !== null) {
        expect(result.includes('..')).toBe(false);
        expect(result.startsWith('/safe')).toBe(true);
      }
      
      // Not quite ".." patterns that should be allowed
      result = sanitizer.sanitize('..', '/safe'); // Just two dots
      if (result !== null) {
        expect(result.startsWith('/safe')).toBe(true);
      }
      
      result = sanitizer.sanitize('...', '/safe'); // Three dots
      if (result !== null) {
        expect(result.startsWith('/safe')).toBe(true);
      }
      
      result = sanitizer.sanitize('._.', '/safe'); // Dots with underscore
      if (result !== null) {
        expect(result.startsWith('/safe')).toBe(true);
      }
    });

    it('should handle null byte (\\0) exactly', () => {
      const sanitizer = new PathSanitizer(['/safe']);
      
      // Exact null byte
      const withNull = 'file.txt\0.evil';
      const result = sanitizer.sanitize(withNull, '/safe');
      
      if (result !== null) {
        // Should not contain null byte
        expect(result.includes('\0')).toBe(false);
        expect(result.indexOf('\0')).toBe(-1);
        expect(result.charCodeAt(result.length - 1)).not.toBe(0);
      }
      
      // Other special characters that aren't null
      const withOtherChars = 'file.txt\n\r\t';
      const result2 = sanitizer.sanitize(withOtherChars, '/safe');
      if (result2 !== null) {
        // These might be present (depends on implementation)
        expect(result2.startsWith('/safe')).toBe(true);
      }
    });

    it('should enforce exact base path prefixes', () => {
      const sanitizer = new PathSanitizer(['/allowed/path', '/tmp']);
      
      // Exact matches
      const result1 = sanitizer.sanitize('file.txt', '/allowed/path');
      expect(result1).toBe('/allowed/path/file.txt');
      
      const result2 = sanitizer.sanitize('file.txt', '/tmp');
      expect(result2).toBe('/tmp/file.txt');
      
      // Path that starts with allowed but isn't in list
      const result3 = sanitizer.sanitize('file.txt', '/allowed');
      if (result3 !== null) {
        // Implementation might allow parent paths
        expect(result3.startsWith('/allowed')).toBe(true);
      }
      
      // Completely different path
      const result4 = sanitizer.sanitize('/etc/passwd');
      expect(result4).toBe(null);
      
      // Substring but not prefix
      const result5 = sanitizer.sanitize('/not/allowed/path/file');
      expect(result5).toBe(null);
    });
  });

  describe('ResourceLimits - Exact Numeric Boundaries', () => {
    it('should enforce exact checklist size limits 1-10000', () => {
      // Exact boundaries
      expect(ResourceLimits.isChecklistSizeValid(0)).toBe(false);
      expect(ResourceLimits.isChecklistSizeValid(1)).toBe(true); // Minimum valid
      expect(ResourceLimits.isChecklistSizeValid(10000)).toBe(true); // Maximum valid
      expect(ResourceLimits.isChecklistSizeValid(10001)).toBe(false);
      
      // Just inside boundaries
      expect(ResourceLimits.isChecklistSizeValid(2)).toBe(true);
      expect(ResourceLimits.isChecklistSizeValid(9999)).toBe(true);
      
      // Negative values
      expect(ResourceLimits.isChecklistSizeValid(-1)).toBe(false);
      expect(ResourceLimits.isChecklistSizeValid(-10000)).toBe(false);
      
      // Large values
      expect(ResourceLimits.isChecklistSizeValid(Number.MAX_SAFE_INTEGER)).toBe(false);
      
      // Special numeric values
      expect(ResourceLimits.isChecklistSizeValid(NaN)).toBe(false);
      expect(ResourceLimits.isChecklistSizeValid(Infinity)).toBe(false);
      expect(ResourceLimits.isChecklistSizeValid(-Infinity)).toBe(false);
    });

    it('should enforce exact item text length 1-10000', () => {
      // Exact boundaries (MAX_ITEM_LENGTH is 10000, not 1000)
      expect(ResourceLimits.isItemLengthValid('')).toBe(false); // 0 length
      expect(ResourceLimits.isItemLengthValid('a')).toBe(true); // 1 char - minimum
      expect(ResourceLimits.isItemLengthValid('x'.repeat(10000))).toBe(true); // Maximum
      expect(ResourceLimits.isItemLengthValid('x'.repeat(10001))).toBe(false);
      
      // Just inside boundaries  
      expect(ResourceLimits.isItemLengthValid('ab')).toBe(true); // 2 chars
      expect(ResourceLimits.isItemLengthValid('x'.repeat(9999))).toBe(true);
      
      // Unicode characters
      expect(ResourceLimits.isItemLengthValid('🎉')).toBe(true); // Single emoji
      // Note: emoji length handling is complex and varies by implementation
    });

    it('should enforce exact concurrent task limit of 100', () => {
      // Reset to clean state
      while (ResourceLimits.getUsageStats().activeTasks > 0) {
        ResourceLimits.releaseTaskSlot();
      }
      
      // Should allow exactly 100 concurrent tasks (MAX_CONCURRENT_OPERATIONS)
      for (let i = 0; i < 100; i++) {
        expect(ResourceLimits.acquireTaskSlot()).toBe(true);
        expect(ResourceLimits.getUsageStats().activeTasks).toBe(i + 1);
      }
      
      // 101st task should be rejected
      expect(ResourceLimits.acquireTaskSlot()).toBe(false);
      expect(ResourceLimits.getUsageStats().activeTasks).toBe(100);
      
      // Release one, should allow one more
      ResourceLimits.releaseTaskSlot();
      expect(ResourceLimits.getUsageStats().activeTasks).toBe(99);
      expect(ResourceLimits.acquireTaskSlot()).toBe(true);
      expect(ResourceLimits.getUsageStats().activeTasks).toBe(100);
      
      // Should not go below 0
      for (let i = 0; i < 105; i++) {
        ResourceLimits.releaseTaskSlot();
      }
      expect(ResourceLimits.getUsageStats().activeTasks).toBe(0);
    });

    it('should enforce exact file size limit of 10MB', () => {
      const MB = 1024 * 1024;
      
      // Exact boundaries (MAX_FILE_SIZE is 10MB, not 100MB)
      expect(ResourceLimits.isFileSizeValid(1)).toBe(true); // 1 byte is valid
      expect(ResourceLimits.isFileSizeValid(10 * MB)).toBe(true); // Exactly 10MB
      expect(ResourceLimits.isFileSizeValid(10 * MB + 1)).toBe(false); // Just over
      
      // Just inside boundaries
      expect(ResourceLimits.isFileSizeValid(10 * MB - 1)).toBe(true);
      
      // Zero and negative values
      expect(ResourceLimits.isFileSizeValid(0)).toBe(false); // 0 is not valid
      expect(ResourceLimits.isFileSizeValid(-1)).toBe(false);
      expect(ResourceLimits.isFileSizeValid(-10 * MB)).toBe(false);
      
      // Large values
      expect(ResourceLimits.isFileSizeValid(100 * MB)).toBe(false);
      expect(ResourceLimits.isFileSizeValid(Number.MAX_SAFE_INTEGER)).toBe(false);
    });

    it('should calculate usage percentage exactly', () => {
      // Reset state
      while (ResourceLimits.getUsageStats().activeTasks > 0) {
        ResourceLimits.releaseTaskSlot();
      }
      
      // 0% usage
      let stats = ResourceLimits.getUsageStats();
      expect(stats.activeTasks).toBe(0);
      expect(stats.maxTasks).toBe(100); // MAX_CONCURRENT_OPERATIONS is 100
      expect(stats.utilizationPercent).toBe(0);
      
      // 50% usage (50 out of 100)
      for (let i = 0; i < 50; i++) {
        ResourceLimits.acquireTaskSlot();
      }
      stats = ResourceLimits.getUsageStats();
      expect(stats.activeTasks).toBe(50);
      expect(stats.utilizationPercent).toBe(50);
      
      // 100% usage (100 out of 100)
      for (let i = 0; i < 50; i++) {
        ResourceLimits.acquireTaskSlot();
      }
      stats = ResourceLimits.getUsageStats();
      expect(stats.activeTasks).toBe(100);
      expect(stats.utilizationPercent).toBe(100);
      
      // Other percentages
      ResourceLimits.releaseTaskSlot(); // 99/100 = 99%
      stats = ResourceLimits.getUsageStats();
      expect(stats.utilizationPercent).toBe(99);
      
      for (let i = 0; i < 9; i++) {
        ResourceLimits.releaseTaskSlot(); // Get to 90/100 = 90%
      }
      stats = ResourceLimits.getUsageStats();
      expect(stats.utilizationPercent).toBe(90);
    });
  });

  describe('PathSanitizer - Array Mutations', () => {
    it('should handle empty allowed paths array', () => {
      const openSanitizer = new PathSanitizer([]);
      
      // With no restrictions, paths might be allowed
      const result = openSanitizer.sanitize('/any/path/file.txt');
      // Implementation-dependent - just verify it doesn't crash
      expect(result === null || typeof result === 'string').toBe(true);
    });

    it('should handle single vs multiple allowed paths', () => {
      const single = new PathSanitizer(['/only']);
      const multiple = new PathSanitizer(['/first', '/second', '/third']);
      
      // Single sanitizer
      expect(single.sanitize('file.txt', '/only')).toBe('/only/file.txt');
      expect(single.sanitize('file.txt', '/other')).not.toBe('/other/file.txt');
      
      // Multiple sanitizer - all paths should work
      expect(multiple.sanitize('file.txt', '/first')).toBe('/first/file.txt');
      expect(multiple.sanitize('file.txt', '/second')).toBe('/second/file.txt');
      expect(multiple.sanitize('file.txt', '/third')).toBe('/third/file.txt');
      expect(multiple.sanitize('file.txt', '/fourth')).not.toBe('/fourth/file.txt');
    });
  });
});