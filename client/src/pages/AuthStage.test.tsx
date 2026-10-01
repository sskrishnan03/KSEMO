import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { Router, type BaseLocationHook } from "wouter";

vi.mock("@/lib/trpc", () => ({
  trpc: {
    useUtils: () => ({
      auth: { me: { invalidate: vi.fn(), refetch: vi.fn(), setData: vi.fn() } },
    }),
    auth: {
      signIn: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
      signUp: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
    },
  },
}));

import AuthStage from "./AuthStage";

const staticLocationHook: BaseLocationHook = () => ["/", () => {}];

describe("KSEMO auth stage", () => {
  it("shows Google sign-in in the center with sign-in and create-account entry points and no password fields", () => {
    const markup = renderToStaticMarkup(
      createElement(Router, {
        hook: staticLocationHook,
        children: createElement(AuthStage),
      })
    );
    expect(markup).toContain("Welcome back");
    expect(markup).toContain("KSEMO");
    expect(markup).toContain("Continue with Google");
    expect(markup).toContain("Sign in");
    expect(markup).toContain("Create account");
    expect(markup).not.toContain('type="password"');
    expect(markup).toContain('data-testid="auth-back-button"');
  });

  it("renders the top-left back button on signin panel", () => {
    const markup = renderToStaticMarkup(
      createElement(Router, {
        hook: staticLocationHook,
        children: createElement(AuthStage, { initial: "signin" }),
      })
    );
    expect(markup).toContain('data-testid="auth-back-button"');
    expect(markup).toContain("Sign in");
  });
});
