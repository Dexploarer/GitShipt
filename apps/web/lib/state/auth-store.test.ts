import { beforeEach, describe, expect, test } from "vitest";
import { clearLogoutStorage, useAuthStore } from "./auth-store";

const user = {
  id: "user_1",
  name: "Ada Lovelace",
  email: "ada@example.com",
  username: "ada",
  imageUrl: null,
  isPlatformAdmin: false,
};

describe("auth store", () => {
  beforeEach(() => {
    useAuthStore.getState().clearAuth();
  });

  test("mirrors server auth chrome and clears immediately on logout", () => {
    useAuthStore.getState().setAuth(user);

    expect(useAuthStore.getState().status).toBe("authenticated");
    expect(useAuthStore.getState().user?.id).toBe("user_1");

    useAuthStore.getState().clearAuth();

    expect(useAuthStore.getState().status).toBe("signed-out");
    expect(useAuthStore.getState().user).toBeNull();
  });

  test("logout storage cleanup is a no-op during server-side tests", () => {
    expect(() => clearLogoutStorage()).not.toThrow();
  });
});
