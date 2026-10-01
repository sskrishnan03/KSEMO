import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

// Mock streamdown
vi.mock("streamdown", () => ({
  Streamdown: ({ children }: any) => createElement("div", null, children),
}));

// Mock wouter
vi.mock("wouter", () => ({
  useRoute: () => [true, { token: "token-test-1234567890" }],
  useLocation: () => ["/share/token-test-1234567890", vi.fn()],
  Link: ({ children, ...props }: any) => createElement("a", props, children),
}));

// Mock useAuth
const mockUser = { id: "user-123", email: "user@example.com" };
let currentUser: any = null;

vi.mock("@/_core/hooks/useAuth", () => ({
  useAuth: () => ({
    user: currentUser,
    isAuthenticated: Boolean(currentUser),
  }),
}));

// Mock trpc
vi.mock("@/lib/trpc", () => ({
  trpc: {
    conversation: {
      getPublic: {
        useQuery: () => ({
          isLoading: false,
          isError: false,
          data: {
            conversation: {
              id: "conv-123",
              title: "AI Development Discussion",
              conversationType: "chat",
              createdAt: new Date(),
              isOwner: false,
            },
            messages: [
              {
                id: "msg-1",
                role: "user",
                content: "How does the shared chat UI look?",
                createdAt: new Date(),
              },
              {
                id: "msg-2",
                role: "assistant",
                content: "It looks just like the real KSEMO chat workspace!",
                createdAt: new Date(),
              },
            ],
          },
        }),
      },
      forkShared: {
        useMutation: () => ({
          mutate: vi.fn(),
          isPending: false,
        }),
      },
    },
  },
}));

// Mock PdfViewer
vi.mock("@/contexts/PdfViewerContext", () => ({
  usePdfViewer: () => ({
    openPdf: vi.fn(),
    closePdf: vi.fn(),
    isOpen: false,
    currentPdf: null,
  }),
  isViewableDocument: () => false,
}));

// Mock sonner
vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

import SharedConversation from "./SharedConversation";
import { TooltipProvider } from "@/components/ui/tooltip";

describe("SharedConversation", () => {
  it("renders authentic KSEMO chat workspace layout for unauthenticated visitors", () => {
    currentUser = null;
    const markup = renderToStaticMarkup(
      createElement(TooltipProvider, null, createElement(SharedConversation))
    );

    // Header has only KSEMO branding
    expect(markup).toContain("KSEMO");
    expect(markup).not.toContain("font-serif");

    // Conversation title in thread body
    expect(markup).toContain("AI Development Discussion");

    // Header has Sign in and Create account buttons for guests
    expect(markup).toContain("Sign in");
    expect(markup).toContain("Create account");

    // Messages thread renders user question and AI response
    expect(markup).toContain("How does the shared chat UI look?");
    expect(markup).toContain("It looks just like the real KSEMO chat workspace!");

    // Bottom dock has Sign in prompt with instruction to sign in to edit/continue
    expect(markup).toContain("Sign in to continue this chat");
    expect(markup).toContain(
      "After signing in, you can edit, branch, or ask follow-up questions."
    );
  });

  it("renders Continue this chat action for authenticated users", () => {
    currentUser = mockUser;
    const markup = renderToStaticMarkup(
      createElement(TooltipProvider, null, createElement(SharedConversation))
    );

    // Header and bottom dock offer continue chat
    expect(markup).toContain("Continue this chat");
    expect(markup).toContain("Continue this conversation in your workspace");
  });
});
