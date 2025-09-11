import { describe, it, expect, beforeEach } from 'bun:test';
import { 
  InputRateLimiter, 
  PathSanitizer, 
  ResourceLimits 
} from '../../src/utils/security';

describe('InputRateLimiter', () => {
  let limiter: InputRateLimiter;

  beforeEach(() => {
    limiter = new InputRateLimiter(50, 5); // 50ms minimum interval, burst of 5
  });

  it('should allow first input immediately', () => {
    expect(limiter.shouldAllow('keypress')).toBe(true);
  });

  it('should rate limit rapid inputs', async () => {
    const action = 'keypress';
    
    // First 5 should be allowed (burst limit)
    for (let i = 0; i < 5; i++) {
      expect(limiter.shouldAllow(action)).toBe(true);
    }
    
    // 6th should be blocked
    expect(limiter.shouldAllow(action)).toBe(false);
    
    // After waiting for burst window + margin, should be allowed again
    await new Promise(resolve => setTimeout(resolve, 1200)); // 1.2s to ensure burst window resets
    expect(limiter.shouldAllow(action)).toBe(true);
  });

  it('should track different actions separately', () => {
    expect(limiter.shouldAllow('action1')).toBe(true);
    expect(limiter.shouldAllow('action2')).toBe(true);
    
    // Exhaust burst for action1
    for (let i = 0; i < 5; i++) {
      limiter.shouldAllow('action1');
    }
    
    // action1 should be blocked, but action2 should still work
    expect(limiter.shouldAllow('action1')).toBe(false);
    expect(limiter.shouldAllow('action2')).toBe(true);
  });

  it('should reset rate limiting', () => {
    const action = 'keypress';
    
    // Exhaust burst
    for (let i = 0; i < 6; i++) {
      limiter.shouldAllow(action);
    }
    
    expect(limiter.shouldAllow(action)).toBe(false);
    
    // Reset specific action
    limiter.reset(action);
    expect(limiter.shouldAllow(action)).toBe(true);
  });

  it('should reset burst window after 1 second', async () => {
    const action = 'keypress';
    
    // Exhaust burst
    for (let i = 0; i < 6; i++) {
      limiter.shouldAllow(action);
    }
    
    expect(limiter.shouldAllow(action)).toBe(false);
    
    // Wait for burst window reset with extra margin
    await new Promise(resolve => setTimeout(resolve, 1200));
    
    // Should allow new burst
    for (let i = 0; i < 5; i++) {
      expect(limiter.shouldAllow(action)).toBe(true);
    }
  });
});

describe('PathSanitizer', () => {
  let sanitizer: PathSanitizer;

  beforeEach(() => {
    sanitizer = new PathSanitizer(['/allowed/path', '/tmp']);
  });

  it('should sanitize valid paths', () => {
    const result = sanitizer.sanitize('file.txt', '/allowed/path');
    expect(result).toBe('/allowed/path/file.txt');
  });

  it('should reject path traversal attempts', () => {
    const attempts = [
      '../../../etc/passwd',
      '..\\..\\..\\windows\\system32',
      'valid/../../etc/passwd',
      '%2e%2e%2f%2e%2e%2fetc%2fpasswd'
    ];
    
    for (const attempt of attempts) {
      const result = sanitizer.sanitize(attempt, '/allowed/path');
      // Path should either be null or not contain traversal
      if (result !== null) {
        expect(result.includes('..')).toBe(false);
        expect(result.startsWith('/allowed/path')).toBe(true);
      }
    }
  });

  it('should handle null bytes in paths', () => {
    const malicious = 'file.txt\0.malicious';
    const result = sanitizer.sanitize(malicious, '/allowed/path');
    expect(result).not.toContain('\0');
  });

  it('should enforce allowed base paths', () => {
    const result1 = sanitizer.sanitize('/etc/passwd');
    expect(result1).toBe(null); // Outside allowed paths
    
    const result2 = sanitizer.sanitize('file.txt', '/allowed/path');
    expect(result2).toBe('/allowed/path/file.txt');
  });

  it('should handle empty sanitizer (no restrictions)', () => {
    const openSanitizer = new PathSanitizer([]);
    const result = openSanitizer.sanitize('any/path/file.txt');
    expect(result).toBeTruthy();
  });
});

describe('ResourceLimits', () => {
  beforeEach(() => {
    // Reset active tasks
    while (ResourceLimits.getUsageStats().activeTasks > 0) {
      ResourceLimits.releaseTaskSlot();
    }
  });

  it('should validate checklist size limits', () => {
    expect(ResourceLimits.isChecklistSizeValid(100)).toBe(true);
    expect(ResourceLimits.isChecklistSizeValid(10000)).toBe(true);
    expect(ResourceLimits.isChecklistSizeValid(10001)).toBe(false);
    expect(ResourceLimits.isChecklistSizeValid(0)).toBe(false);
    expect(ResourceLimits.isChecklistSizeValid(-1)).toBe(false);
  });

  it('should validate item length limits', () => {
    expect(ResourceLimits.isItemLengthValid('Valid text')).toBe(true);
    expect(ResourceLimits.isItemLengthValid('x'.repeat(10000))).toBe(true);
    expect(ResourceLimits.isItemLengthValid('x'.repeat(10001))).toBe(false);
    expect(ResourceLimits.isItemLengthValid('')).toBe(false);
  });

  it('should validate file size limits', () => {
    expect(ResourceLimits.isFileSizeValid(1024)).toBe(true);
    expect(ResourceLimits.isFileSizeValid(10 * 1024 * 1024)).toBe(true);
    expect(ResourceLimits.isFileSizeValid(11 * 1024 * 1024)).toBe(false);
    expect(ResourceLimits.isFileSizeValid(0)).toBe(false);
    expect(ResourceLimits.isFileSizeValid(-1)).toBe(false);
  });

  it('should manage concurrent task slots', () => {
    const stats1 = ResourceLimits.getUsageStats();
    expect(stats1.activeTasks).toBe(0);
    
    // Acquire some slots
    expect(ResourceLimits.acquireTaskSlot()).toBe(true);
    expect(ResourceLimits.acquireTaskSlot()).toBe(true);
    
    const stats2 = ResourceLimits.getUsageStats();
    expect(stats2.activeTasks).toBe(2);
    expect(stats2.utilizationPercent).toBe(2);
    
    // Release slots
    ResourceLimits.releaseTaskSlot();
    
    const stats3 = ResourceLimits.getUsageStats();
    expect(stats3.activeTasks).toBe(1);
  });

  it('should enforce maximum concurrent operations', () => {
    // Acquire all available slots
    for (let i = 0; i < 100; i++) {
      expect(ResourceLimits.acquireTaskSlot()).toBe(true);
    }
    
    // Next acquisition should fail
    expect(ResourceLimits.acquireTaskSlot()).toBe(false);
    
    const stats = ResourceLimits.getUsageStats();
    expect(stats.activeTasks).toBe(100);
    expect(stats.utilizationPercent).toBe(100);
  });
});