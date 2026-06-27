import { describe, it, expect } from "vitest";
import { encrypt, decrypt } from "./encryption";

describe("encryption", () => {
  it("round-trips a secret", () => {
    const secret = "raw-pat-value-12345";
    const encrypted = encrypt(secret);
    expect(encrypted).not.toBe(secret);
    expect(decrypt(encrypted)).toBe(secret);
  });

  it("produces a different ciphertext each time (random IV)", () => {
    const a = encrypt("same-secret");
    const b = encrypt("same-secret");
    expect(a).not.toBe(b);
  });

  it("throws on tampered ciphertext", () => {
    const encrypted = encrypt("secret");
    const tampered = encrypted.slice(0, -2) + "00";
    expect(() => decrypt(tampered)).toThrow();
  });
});
