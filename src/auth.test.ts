import { describe, it, expect, beforeAll } from "vitest";
import { checkPasswordHash, hashPassword, makeJWT, validateJWT } from "./auth";

describe("Password Hashing", () => {
  const password1 = "correctPassword123!";
  const password2 = "anotherPassword456!";
  let hash1: string;
  let hash2: string;

  beforeAll(async () => {
    hash1 = await hashPassword(password1);
    hash2 = await hashPassword(password2);
  });

  it("should return true for the correct password", async () => {
    const result = await checkPasswordHash(password1, hash1);
    expect(result).toBe(true);
  });
});

describe("JWT Authentication", () => {
  const userId = "test-user-123";
  const secret = "test-secret-key";
  const wrongSecret = "wrong-secret-key";

  it("should create and validate JWTs successfully", () => {
    const token = makeJWT(userId, 3600, secret); // 1 hour expiry
    const validatedUserId = validateJWT(token, secret);
    expect(validatedUserId).toBe(userId);
  });

  it("should reject expired tokens", () => {
    const expiredToken = makeJWT(userId, -1, secret); // Already expired
    expect(() => validateJWT(expiredToken, secret)).toThrow("Token has expired");
  });

  it("should reject JWTs signed with wrong secret", () => {
    const token = makeJWT(userId, 3600, secret);
    expect(() => validateJWT(token, wrongSecret)).toThrow();
  });
});