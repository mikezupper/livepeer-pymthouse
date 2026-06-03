import { describe, expect, it } from "vitest";
import { ensureOpenIdScope } from "./scopes";

describe("ensureOpenIdScope", () => {
  it("adds openid when missing", () => {
    expect(ensureOpenIdScope("sign:job users:token")).toBe(
      "openid sign:job users:token",
    );
  });

  it("does not duplicate openid", () => {
    expect(ensureOpenIdScope("openid sign:job")).toBe("openid sign:job");
  });
});
