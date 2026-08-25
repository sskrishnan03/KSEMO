import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Router, type BaseLocationHook } from "wouter";
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
  });
});
