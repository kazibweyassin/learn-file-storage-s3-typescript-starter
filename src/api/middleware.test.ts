import { describe, test, expect, beforeEach } from "bun:test";
import { rateLimitMiddleware } from "./middleware";
import { UserForbiddenError } from "./errors";

// Clear rate limit store before each test
beforeEach(() => {
  // We need to access the store to clear it
  // For now, just wait for windows to expire in tests
});

describe("Rate Limiting", () => {
  test("should allow requests under limit", async () => {
    const rateLimit = rateLimitMiddleware(5, 60000); // 5 req per minute
    
    // Make 5 requests - all should succeed
    for (let i = 0; i < 5; i++) {
      await rateLimit("test-user-1");
    }
    
    expect(true).toBe(true); // If we got here, test passed!
  });
  
  test("should reject 6th request when limit is 5", async () => {
    const rateLimit = rateLimitMiddleware(5, 60000);
    
    // Make 5 requests (should succeed)
    for (let i = 0; i < 5; i++) {
      await rateLimit("test-user-2");
    }
    
    // 6th request should fail
    try {
      await rateLimit("test-user-2");
      expect(true).toBe(false); // Should not reach here
    } catch (error) {
      expect(error).toBeInstanceOf(UserForbiddenError);
      expect(error.message).toContain("Rate limit exceeded");
    }
  });
  
  test("should reset after window expires", async () => {
    const rateLimit = rateLimitMiddleware(2, 100); // 2 req per 100ms
    
    // Make 2 requests
    await rateLimit("test-user-3");
    await rateLimit("test-user-3");
    
    // 3rd should fail
    try {
      await rateLimit("test-user-3");
      expect(true).toBe(false);
    } catch (error) {
      expect(error).toBeInstanceOf(UserForbiddenError);
    }
    
    // Wait for window to expire
    await new Promise(resolve => setTimeout(resolve, 150));
    
    // Should allow new request after reset
    await rateLimit("test-user-3");
    expect(true).toBe(true);
  });

  test("should track users independently", async () => {
    const rateLimit = rateLimitMiddleware(2, 60000);
    
    // User A makes 2 requests
    await rateLimit("user-a");
    await rateLimit("user-a");
    
    // User A's 3rd request fails
    try {
      await rateLimit("user-a");
      expect(true).toBe(false);
    } catch (error) {
      expect(error).toBeInstanceOf(UserForbiddenError);
    }
    
    // But User B can still make requests!
    await rateLimit("user-b");
    await rateLimit("user-b");
    expect(true).toBe(true);
  });
});