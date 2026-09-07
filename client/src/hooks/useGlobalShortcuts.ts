import { useEffect } from "react";
import { toast } from "sonner";
import type { CapabilityMode } from "@shared/research";

export type GlobalShortcutsOptions = {
  onNewChat?: () => void;
  onToggleSidebar?: () => void;
  onOpenSettings?: (tab?: string) => void;
  onModeChange?: (mode: CapabilityMode) => void;
  focusTargetId?: string;
  enabled?: boolean;
};

export function useGlobalShortcuts({
  onNewChat,
  onToggleSidebar,
  onOpenSettings,
  onModeChange,
  focusTargetId = "ksemo-composer-textarea",
  enabled = true,
}: GlobalShortcutsOptions) {
  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;
      const modifier = isMac ? e.metaKey : e.ctrlKey;

      // 1. Focus Search / Chat Input (Cmd+K / Ctrl+K)
      if (modifier && (e.key === "k" || e.key === "K") && !e.shiftKey && !e.altKey) {
        e.preventDefault();
        const el =
          document.getElementById(focusTargetId) ||
          document.querySelector<HTMLTextAreaElement>("#ksemo-composer-textarea") ||
          document.querySelector<HTMLTextAreaElement>('textarea[aria-label="Message KSEMO"]') ||
          document.querySelector<HTMLInputElement>('input[type="search"]');

        if (el) {
          el.focus();
          // If it's a textarea, scroll it into view
          el.scrollIntoView({ behavior: "smooth", block: "nearest" });
        }
        return;
      }

      // 2. Open Settings (Cmd+, / Ctrl+,)
      if (modifier && (e.key === "," || e.key === "Comma") && !e.shiftKey) {
        e.preventDefault();
        onOpenSettings?.("account");
        return;
      }

      // 3. Open Shortcuts Guide (Cmd+/ / Ctrl+/)
      if (modifier && (e.key === "/" || e.key === "?") && !e.altKey) {
        e.preventDefault();
        onOpenSettings?.("shortcuts");
        return;
      }

      // 4. Toggle Sidebar (Cmd+B / Ctrl+B)
      if (modifier && (e.key === "b" || e.key === "B") && !e.shiftKey) {
        e.preventDefault();
        onToggleSidebar?.();
        return;
      }

      // 5. New Conversation (Cmd+Shift+O / Ctrl+Shift+O)
      if (modifier && e.shiftKey && (e.key === "o" || e.key === "O")) {
        e.preventDefault();
        onNewChat?.();
        toast.info("Started new conversation");
        return;
      }

      // 6. Capability Mode Switching Shortcuts
      if (modifier && e.shiftKey && onModeChange) {
        const key = e.key.toLowerCase();
        if (key === "p") {
          e.preventDefault();
          onModeChange("pdf");
          toast.info("Switched to PDF Creation mode");
        } else if (key === "d") {
          e.preventDefault();
          onModeChange("docx");
          toast.info("Switched to Word Document mode");
        } else if (key === "x") {
          e.preventDefault();
          onModeChange("xlsx");
          toast.info("Switched to Excel Spreadsheet mode");
        } else if (key === "s") {
          e.preventDefault();
          onModeChange("pptx");
          toast.info("Switched to PowerPoint Presentation mode");
        } else if (key === "w") {
          e.preventDefault();
          onModeChange("web_search");
          toast.info("Switched to Live Web Search mode");
        } else if (key === "r") {
          e.preventDefault();
          onModeChange("deep_research");
          toast.info("Switched to Deep Research mode");
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    enabled,
    onNewChat,
    onToggleSidebar,
    onOpenSettings,
    onModeChange,
    focusTargetId,
  ]);
}
