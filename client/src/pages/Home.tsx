import { useAuth } from "@/_core/hooks/useAuth";
import { keepPreviousData } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { startLogin } from "@/const";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { Menu } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";
import { ChatComposer } from "../components/ksemo/ChatComposer";
import AuthStage from "./AuthStage";
import { ConversationSidebar } from "../components/ksemo/ConversationSidebar";
import {
  MessageContent,
  type KsemoMessage,
} from "../components/ksemo/MessageContent";
import { SettingsDialog } from "../components/ksemo/SettingsDialog";
import { ShareConversationDialog } from "../components/ksemo/ShareConversationDialog";
import {
  KsemoConfirmDialogPanel,
  KsemoTextDialogPanel,
} from "../components/ksemo/DialogPanels";
import { MessageHistoryDialogPanel } from "../components/ksemo/MessageHistoryDialogPanel";
import { useVoiceInput } from "../hooks/useVoiceInput";
import { VoiceChat } from "../components/voice/VoiceChat";
import { WorkspacePanel } from "../components/ksemo/WorkspacePanel";
import { LibraryWorkspace } from "../components/ksemo/LibraryWorkspace";
import { SearchWorkspace } from "../components/ksemo/SearchWorkspace";
import {
  createConversationPdfFile,
  createConversationWordFile,
} from "../lib/conversationExport";
import { createPublicConversationUrl } from "../lib/ksemoInteraction";
import { saveEditedUserMessageAndRegenerate } from "../lib/editRegeneration";
import { buildStreamingDrafts } from "../lib/streamingDrafts";
import { restoreUserMessageVersionAndRegenerate } from "../lib/historyRestoration";

type StreamConversation = {
  conversationId: string;
  title: string;
  userMessageId: string;
  assistantMessageId: string;
};

// Streaming safety limits. Without them a silent connection (stalled
// provider, dropped socket behind a proxy) would spin the composer forever.
const STREAM_IDLE_TIMEOUT_MS = 45_000;
const STREAM_MAX_DURATION_MS = 300_000;
const REFRESH_TIMEOUT_MS = 20_000;

function withDeadline<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  return Promise.race([
    promise,
    new Promise<null>(resolve => window.setTimeout(() => resolve(null), ms)),
  ]);
}

type SelectedAttachment = {
  fileId: string;
  name: string;
  mimeType?: string;
  url: string;
  linked: boolean;
};

type SavedAccount = {
  id: string;
  name?: string | null;
  email?: string | null;
};

const SAVED_ACCOUNTS_KEY = "ksemo-saved-accounts";

function getSavedAccounts(): SavedAccount[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(SAVED_ACCOUNTS_KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed.slice(0, 2) : [];
  } catch {
    return [];
  }
}

export default function Home() {
  const { user, loading, logout } = useAuth();
  const [, setLocation] = useLocation();
  const isFreshChatPreview =
    import.meta.env.DEV &&
    new URLSearchParams(window.location.search).has("freshChatPreview");
  const isSignedOutPreview =
    import.meta.env.DEV &&
    new URLSearchParams(window.location.search).has("signedOutPreview");
  const workspacePreview = import.meta.env.DEV
    ? new URLSearchParams(window.location.search).get("workspacePreview")
    : null;
  const interactionPreview = import.meta.env.DEV
    ? new URLSearchParams(window.location.search).get("interactionPreview")
    : null;
  const isRecordingPreview = interactionPreview === "recording";
  const isTranscribingPreview = interactionPreview === "transcribing";
  const isLibraryPreview = interactionPreview === "library";
  const isSharePreview = interactionPreview === "share";
  const isRenamePreview = interactionPreview === "rename";
  const isDeletePreview = interactionPreview === "delete";
  const isEditPreview = interactionPreview === "edit";
  const isEditRegeneratedPreview = interactionPreview === "editRegenerated";
  const isEditSavingPreview = interactionPreview === "editSaving";
  const isHistoryPreview = interactionPreview === "history";
  const isSettingsPreview = interactionPreview === "settings";
  const isWorkspaceDeletePreview = interactionPreview === "workspaceDelete";
  const isAttachmentPreview = interactionPreview === "attachment";
  const isAttachedMessagePreview = interactionPreview === "attachedMessage";
  const isMessagePreview = interactionPreview === "messages";
  const isCollapsedSidebarPreview =
    import.meta.env.DEV &&
    new URLSearchParams(window.location.search).has("sidebarCollapsedPreview");
  const isSidebarOpenPreview =
    import.meta.env.DEV &&
    new URLSearchParams(window.location.search).has("sidebarOpenPreview");
  const isProfileSupportPreview =
    import.meta.env.DEV &&
    new URLSearchParams(window.location.search).has("profileSupportPreview");
  const sharedConversationId = useMemo(
    () => new URLSearchParams(window.location.search).get("conversation"),
    []
  );
  const inlineWorkspaceSection: "library" | null =
    workspacePreview === "files"
      ? "library"
      : null;
  const utils = trpc.useUtils();
  const [savedAccounts, setSavedAccounts] =
    useState<SavedAccount[]>(getSavedAccounts);
  const [sidebarOpen, setSidebarOpen] = useState(isSidebarOpenPreview);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(
    isCollapsedSidebarPreview
  );
  const [activeConversationId, setActiveConversationId] = useState<
    string | null
  >(null);
  const [pendingConversationId, setPendingConversationId] = useState<
    string | null
  >(null);
  const [pendingMessages, setPendingMessages] = useState<KsemoMessage[] | null>(
    null
  );
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatingMessageId, setGeneratingMessageId] = useState<string | null>(
    null
  );
  const [composerValue, setComposerValue] = useState("");
  const [attachmentNotices, setAttachmentNotices] = useState<
    SelectedAttachment[]
  >([]);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [speakingMessageId, setSpeakingMessageId] = useState<string | null>(
    null
  );
  const [speechState, setSpeechState] = useState<"idle" | "playing" | "paused">(
    "idle"
  );
  const [primaryWorkspace, setPrimaryWorkspace] = useState<
    "library" | "search" | null
  >(null);
  const [voiceChatOpen, setVoiceChatOpen] = useState(false);
  const activePrimaryWorkspace = primaryWorkspace ?? inlineWorkspaceSection;
  const [shareTarget, setShareTarget] = useState<{
    id: string;
    title: string;
    isPublic: boolean;
    shareToken: string | null;
  } | null>(null);
  const [shareEmail, setShareEmail] = useState("");
  const [renameTarget, setRenameTarget] = useState<{
    id: string;
    title: string;
  } | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [editingMessage, setEditingMessage] = useState<KsemoMessage | null>(
    null
  );
  const [editValue, setEditValue] = useState("");
  const [historyMessage, setHistoryMessage] = useState<KsemoMessage | null>(
    null
  );
  const [deleteTarget, setDeleteTarget] = useState<{
    kind: "conversation" | "message";
    id: string;
    title: string;
  } | null>(null);
  const [webSearchEnabled, setWebSearchEnabled] = useState(false);
  const [webSourcesByMessage, setWebSourcesByMessage] = useState<
    Record<string, Array<{ title: string; url: string }>>
  >({});
  const streamAbortRef = useRef<AbortController | null>(null);
  const generationSequenceRef = useRef(0);
  // State does not update until React renders. This ref closes the small
  // double-submit window between a click/Enter event and that render.
  const generationActiveRef = useRef(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const initialConversationResolvedRef = useRef(false);

  const conversationQuery = trpc.conversation.list.useQuery(
    { scope: "active" },
    { enabled: Boolean(user) }
  );
  const activeQuery = trpc.conversation.get.useQuery(
    { id: activeConversationId ?? "unselected" },
    { enabled: Boolean(activeConversationId) }
  );
  const preferencesQuery = trpc.preferences.get.useQuery(undefined, {
    enabled: Boolean(user),
  });
  const libraryFilesQuery = trpc.workspace.files.list.useQuery(undefined, {
    enabled: Boolean(user),
  });
  const preferenceMutation = trpc.preferences.update.useMutation({
    onSuccess: () => {
      utils.preferences.get.invalidate();
      toast.success("Assistant settings saved");
      setSettingsOpen(false);
    },
    onError: () => toast.error("Settings could not be saved."),
  });
  const [switchingAccountId, setSwitchingAccountId] = useState<string | null>(null);
  const switchAccountMutation = trpc.auth.signIn.useMutation({
    onSuccess: async () => {
      await utils.auth.me.invalidate();
      await utils.conversation.list.invalidate();
      setActiveConversationId(null);
      setPrimaryWorkspace(null);
      setSwitchingAccountId(null);
      toast.success("Switched account");
    },
    onError: (_error, variables) => {
      setSwitchingAccountId(null);
      if (variables?.email) {
        setSavedAccounts(prev => {
          const next = prev.filter(a => a.email !== variables.email);
          localStorage.setItem(SAVED_ACCOUNTS_KEY, JSON.stringify(next));
          return next;
        });
      }
      toast.error(
        "That account could not be switched. Signing out so you can sign in again.",
      );
      void logout();
    },
  });

  useEffect(() => {
    if (!user?.id) return;
    const current: SavedAccount = {
      id: String(user.id),
      name: user.name,
      email: user.email,
    };
    setSavedAccounts(previous => {
      const next = [
        current,
        ...previous.filter(
          account =>
            account.id !== current.id && account.email !== current.email
        ),
      ].slice(0, 2);
      localStorage.setItem(SAVED_ACCOUNTS_KEY, JSON.stringify(next));
      return next;
    });
  }, [user?.email, user?.id, user?.name]);
  const renameMutation = trpc.conversation.rename.useMutation({
    onSuccess: () => utils.conversation.list.invalidate(),
  });
  const archiveMutation = trpc.conversation.setArchived.useMutation({
    onSuccess: () => {
      utils.conversation.list.invalidate();
      toast.success("Conversation archived");
    },
  });
  const pinMutation = trpc.conversation.setPinned.useMutation({
    onSuccess: () => utils.conversation.list.invalidate(),
  });
  const publicShareMutation =
    trpc.conversation.configurePublicShare.useMutation({
      onSuccess: data => {
        setShareTarget(current =>
          current
            ? {
                ...current,
                isPublic: data.isPublic,
                shareToken: data.shareToken,
              }
            : null
        );
        utils.conversation.list.invalidate();
        toast.success(
          data.isPublic ? "Public sharing enabled" : "Public sharing disabled"
        );
      },
      onError: () => toast.error("KSEMO could not update public sharing."),
    });
  const permanentDeleteMutation = trpc.conversation.remove.useMutation({
    onSuccess: () => {
      utils.conversation.list.invalidate();
      toast.success("Conversation permanently deleted");
    },
  });
  const duplicateMutation = trpc.conversation.duplicate.useMutation({
    onSuccess: conversation => {
      utils.conversation.list.invalidate();
      setActiveConversationId(conversation.id);
      toast.success("Conversation duplicated");
    },
  });
  const messageEditMutation = trpc.message.edit.useMutation({
    onSuccess: (_, variables) => {
      if (activeConversationId)
        utils.conversation.get.invalidate({ id: activeConversationId });
      utils.message.history.invalidate({ id: variables.id });
      toast.success("Message updated");
    },
    onError: () => toast.error("KSEMO could not update that message."),
  });
  const messageHistoryQuery = trpc.message.history.useQuery(
    { id: historyMessage?.id ?? "history-preview" },
    { enabled: Boolean(historyMessage) }
  );
  const messageRestoreMutation = trpc.message.restoreVersion.useMutation({
    onSuccess: (_, variables) => {
      if (activeConversationId)
        utils.conversation.get.invalidate({ id: activeConversationId });
      utils.message.history.invalidate({ id: variables.id });
    },
    onError: () => toast.error("KSEMO could not restore that version."),
  });
  const messageFeedbackMutation = trpc.message.feedback.useMutation({
    onSuccess: () => toast.success("Thanks for the feedback."),
    onError: () => toast.error("Feedback could not be saved."),
  });
  const messageRemoveMutation = trpc.message.remove.useMutation({
    onSuccess: () => {
      if (activeConversationId)
        utils.conversation.get.invalidate({ id: activeConversationId });
      toast.success("Message permanently deleted");
    },
    onError: () => toast.error("KSEMO could not delete that message."),
  });
  const composerFileUpload = trpc.workspace.files.upload.useMutation();
  const composerFileAttach =
    trpc.workspace.files.attachToConversation.useMutation();
  const voice = useVoiceInput({
    onTranscript: text =>
      setComposerValue(current => (current ? `${current} ${text}` : text)),
    onError: message => toast.error(message),
  });

  const persistedMessages = useMemo<KsemoMessage[]>(
    () =>
      (activeQuery.data?.messages ?? []).map(message => ({
        id: message.id,
        role: message.role,
        content: message.content,
        status: message.status,
        attachments: message.attachments,
      })),
    [activeQuery.data?.messages]
  );
  const visibleMessages = isAttachedMessagePreview
    ? [
        {
          id: "media-user",
          role: "user" as const,
          content: "What is in this image?",
          status: "completed" as const,
          attachments: [
            {
              id: "media-file",
              filename: "workspace-photo.jpg",
              mimeType: "image/jpeg",
              url: "/ksemo-storage/workspace-photo.jpg",
            },
          ],
        },
        {
          id: "media-assistant",
          role: "assistant" as const,
          content:
            "I can use the attached image as context when your selected model supports vision.",
          status: "completed" as const,
        },
      ]
    : isEditSavingPreview
      ? [
          {
            id: "edited-user",
            role: "user" as const,
            content: "Can you make this answer more concise?",
            status: "completed" as const,
          },
          {
            id: "regenerating-assistant",
            role: "assistant" as const,
            content: "",
            status: "streaming" as const,
          },
        ]
      : isEditRegeneratedPreview
        ? [
            {
              id: "edited-user",
              role: "user" as const,
              content: "Can you make this answer more concise?",
              status: "completed" as const,
            },
            {
              id: "regenerated-assistant",
              role: "assistant" as const,
              content:
                "Yes. Here is the concise revision, rebuilt from your edited request without adding another user message.",
              status: "completed" as const,
            },
          ]
        : isMessagePreview
          ? [
              {
                id: "preview-user",
                role: "user" as const,
                content: "Can you make this plan more concise?",
                status: "completed" as const,
              },
              {
                id: "preview-assistant",
                role: "assistant" as const,
                content:
                  "Absolutely. I’ll keep the main decisions, remove repetition, and make the next steps easier to scan.",
                status: "completed" as const,
              },
            ]
          : pendingConversationId === activeConversationId && pendingMessages
            ? pendingMessages
            : persistedMessages;

  useEffect(() => {
    if (initialConversationResolvedRef.current || !conversationQuery.data)
      return;
    initialConversationResolvedRef.current = true;
    if (isFreshChatPreview) return;
    if (sharedConversationId) {
      void utils.conversation.get
        .fetch({ id: sharedConversationId })
        .then(() => {
          setActiveConversationId(sharedConversationId);
          window.history.replaceState({}, "", window.location.pathname);
        })
        .catch(() => {
          toast.error(
            "That shared conversation is unavailable in this KSEMO account."
          );
          window.history.replaceState({}, "", window.location.pathname);
          if (conversationQuery.data.length)
            setActiveConversationId(conversationQuery.data[0].id);
        });
      return;
    }
    if (conversationQuery.data.length)
      setActiveConversationId(conversationQuery.data[0].id);
  }, [isFreshChatPreview, sharedConversationId, utils.conversation.get]);

  useEffect(() => {
    document.documentElement.classList.toggle(
      "ksemo-reduce-motion",
      Boolean(preferencesQuery.data?.reduceMotion)
    );
  }, [preferencesQuery.data?.reduceMotion]);

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      const modifier = event.metaKey || event.ctrlKey;
      if (modifier && event.key.toLowerCase() === "k") {
        event.preventDefault();
        return;
      }
      if (modifier && event.shiftKey && event.key.toLowerCase() === "o") {
        event.preventDefault();
        newChat();
        return;
      }
      if (event.key === "Escape" && isGenerating) {
        event.preventDefault();
        stopGeneration();
      }
    };
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, [isGenerating]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "end",
    });
  }, [visibleMessages, isGenerating]);

  useEffect(
    () => () => {
      streamAbortRef.current?.abort();
      window.speechSynthesis?.cancel();
    },
    []
  );

  async function sendMessage(
    content: string,
    options: {
      regenerateAssistantMessageId?: string;
      replaceUserMessageId?: string;
    } = {}
  ) {
    if (generationActiveRef.current) return;
    generationActiveRef.current = true;
    const conversationId = activeConversationId;
    const knownMessages = conversationId ? persistedMessages : [];
    const isRegeneration = Boolean(options.regenerateAssistantMessageId);
    const draftNow = Date.now();
    setPendingConversationId(conversationId ?? "pending");
    const selectedAttachments = !isRegeneration ? attachmentNotices : [];
    setPendingMessages(
      buildStreamingDrafts(knownMessages, content, {
        isRegeneration,
        replaceUserMessageId: options.replaceUserMessageId,
        replaceAssistantMessageId: options.regenerateAssistantMessageId,
        attachments: selectedAttachments.length
          ? selectedAttachments.map(file => ({
              id: file.fileId,
              filename: file.name,
              mimeType: file.mimeType,
              url: file.url,
            }))
          : undefined,
        now: draftNow,
      }) as KsemoMessage[]
    );
    if (selectedAttachments.length) setAttachmentNotices([]);
    setIsGenerating(true);
    setGeneratingMessageId(
      options.regenerateAssistantMessageId ?? `local-assistant-${draftNow}`
    );
    const controller = new AbortController();
    streamAbortRef.current = controller;
    const turnSequence = ++generationSequenceRef.current;

    // Watchdog: the stream must always terminate. A silent connection (half
    // -open socket, stalled provider, proxy drop) previously hung the composer
    // forever with no error; now silence or an overlong run aborts the turn.
    const startedAt = Date.now();
    // Only real protocol events count as progress. SSE heartbeats keep the
    // socket open, but they must not keep a stalled model generation alive.
    let lastProgressAt = startedAt;
    let stalled = false;
    let userStopped = false;
    let errorMessage: string | null = null;
    const watchdog = window.setInterval(() => {
      const now = Date.now();
      if (
        now - lastProgressAt > STREAM_IDLE_TIMEOUT_MS ||
        now - startedAt > STREAM_MAX_DURATION_MS
      ) {
        stalled = true;
        controller.abort();
      }
    }, 1_000);

    let streamConversation: StreamConversation | null = null;
    let responseText = "";
    try {
      const response = await fetch("/api/chat/stream", {
        method: "POST",
        credentials: "include",
        signal: controller.signal,
        headers: {
          "content-type": "application/json",
          accept: "text/event-stream",
        },
        body: JSON.stringify({
          conversationId: conversationId ?? undefined,
          content,
          regenerateAssistantMessageId: options.regenerateAssistantMessageId,
          attachmentFileIds: selectedAttachments.length
            ? selectedAttachments.map(file => file.fileId)
            : undefined,
          webSearch: webSearchEnabled && !isRegeneration ? true : undefined,
        }),
      });
      if (!response.ok || !response.body) {
        throw new Error("The response stream could not be started.");
      }
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      const processEvents = (rawEvents: string[]) => {
        for (const rawEvent of rawEvents) {
          const eventName = rawEvent
            .split("\n")
            .find(line => line.startsWith("event:"))
            ?.slice(6)
            .trim();
          const rawData = rawEvent
            .split("\n")
            .find(line => line.startsWith("data:"))
            ?.slice(5)
            .trim();
          if (!eventName || !rawData) continue;
          let data: Record<string, string>;
          try {
            data = JSON.parse(rawData) as Record<string, string>;
          } catch {
            continue;
          }
          if (eventName === "conversation") {
            lastProgressAt = Date.now();
            streamConversation = data as StreamConversation;
            setGeneratingMessageId(data.assistantMessageId);
            setActiveConversationId(data.conversationId);
            setPendingConversationId(data.conversationId);
            setPendingMessages(
              current =>
                current?.map(message =>
                  message.id.startsWith("local-user")
                    ? { ...message, id: data.userMessageId }
                    : message.id.startsWith("local-assistant")
                      ? { ...message, id: data.assistantMessageId }
                      : message
                ) ?? null
            );
            utils.conversation.list.invalidate();
          } else if (eventName === "assistant.delta") {
            lastProgressAt = Date.now();
            responseText += data.delta;
            setPendingMessages(
              current =>
                current?.map(message =>
                  message.id === data.messageId
                    ? { ...message, content: `${message.content}${data.delta}` }
                    : message
                ) ?? null
            );
          } else if (eventName === "assistant.completed") {
            lastProgressAt = Date.now();
          } else if (eventName === "assistant.error") {
            lastProgressAt = Date.now();
            errorMessage =
              data.message || "KSEMO could not complete this response.";
          } else if (eventName === "web.sources") {
            lastProgressAt = Date.now();
            const payload = data as unknown as {
              messageId: string;
              sources?: Array<{ title: string; url: string }>;
            };
            if (payload.messageId && payload.sources?.length) {
              setWebSourcesByMessage(current => ({
                ...current,
                [payload.messageId]: payload.sources ?? [],
              }));
            }
          }
        }
      };
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          buffer += decoder.decode();
          if (buffer.trim()) processEvents([buffer.replace(/\r\n/g, "\n")]);
          break;
        }
        buffer += decoder
          .decode(value, { stream: true })
          .replace(/\r\n/g, "\n");
        const events = buffer.split("\n\n");
        buffer = events.pop() ?? "";
        processEvents(events);
      }
    } catch (error) {
      if ((error as Error).name === "AbortError" && !stalled)
        userStopped = true;
      else if ((error as Error).name !== "AbortError")
        errorMessage =
          errorMessage ??
          "KSEMO could not start a response. Your message was kept.";
    } finally {
      clearInterval(watchdog);
    }

    // Finalization always runs exactly once and every network step is
    // time-bounded, so isGenerating can never stick on a hanging request.
    if (generationSequenceRef.current !== turnSequence) return;
    clearInterval(watchdog);
    setIsGenerating(false);
    setGeneratingMessageId(null);
    generationActiveRef.current = false;
    if (streamAbortRef.current === controller) streamAbortRef.current = null;

    const failureMessage =
      errorMessage ??
      (stalled
        ? responseText
          ? "KSEMO stopped waiting because this response took too long."
          : "KSEMO's response stalled. Please try again."
        : null);
    // The stream event handler assigns this asynchronously, which TypeScript
    // cannot follow through the closure even though it is available at runtime.
    const completedConversation =
      streamConversation as StreamConversation | null;

    const persistTurnLocally = () => {
      if (!completedConversation) return false;
      return mergeTurnIntoConversationCache(
        completedConversation.conversationId,
        {
          user: {
            id: completedConversation.userMessageId,
            role: "user",
            content,
            status: "completed",
            attachments: selectedAttachments.length
              ? selectedAttachments.map(file => ({
                  id: file.fileId,
                  filename: file.name,
                  mimeType: file.mimeType,
                  url: file.url,
                }))
              : undefined,
          },
          assistant: {
            id: completedConversation.assistantMessageId,
            role: "assistant",
            content: responseText,
            status: failureMessage
              ? "failed"
              : userStopped
                ? "cancelled"
                : "completed",
          },
        }
      );
    };

    if (!completedConversation) {
      // Nothing was saved server-side: give the text back to the composer.
      setPendingMessages(null);
      setPendingConversationId(null);
      if (!userStopped)
        setComposerValue(current => (current ? current : content));
      if (failureMessage) toast.error(failureMessage);
      return;
    }

    if (failureMessage) {
      markStreamingDraft("failed");
      toast.error(failureMessage);
      const synced = await syncConversationFromServer(
        completedConversation.conversationId
      );
      if (generationSequenceRef.current !== turnSequence) return;
      if (synced) clearPendingDrafts();
      else if (!persistTurnLocally()) keepPendingDraftsVisible();
      return;
    }

    if (userStopped) {
      markStreamingDraft("cancelled");
      const synced = await syncConversationFromServer(
        completedConversation.conversationId
      );
      if (generationSequenceRef.current !== turnSequence) return;
      if (synced || persistTurnLocally()) clearPendingDrafts();
      return;
    }

    const synced = await syncConversationFromServer(
      completedConversation.conversationId
    );
    if (generationSequenceRef.current !== turnSequence) return;
    if (synced || persistTurnLocally()) clearPendingDrafts();
    else keepPendingDraftsVisible();
    if (preferencesQuery.data?.autoPlayResponses && responseText)
      speak(responseText, completedConversation.assistantMessageId);
  }

  function markStreamingDraft(status: "failed" | "cancelled" | "completed") {
    setPendingMessages(
      current =>
        current?.map(message =>
          message.role === "assistant" && message.status === "streaming"
            ? { ...message, status }
            : message
        ) ?? null
    );
  }

  function clearPendingDrafts() {
    setPendingMessages(null);
    setPendingConversationId(null);
  }

  function keepPendingDraftsVisible() {
    // Leave the streamed answer on screen; a later cache refresh replaces it.
  }

  async function syncConversationFromServer(targetId: string) {
    const fresh = await withDeadline(
      utils.conversation.get.fetch({ id: targetId }),
      REFRESH_TIMEOUT_MS
    );
    return fresh !== null;
  }

  function mergeTurnIntoConversationCache(
    targetId: string,
    turn: { user: KsemoMessage; assistant: KsemoMessage }
  ) {
    const existing = utils.conversation.get.getData({ id: targetId });
    if (!existing) return false;
    const messages = [...existing.messages];
    const upsert = (incoming: KsemoMessage) => {
      const index = messages.findIndex(message => message.id === incoming.id);
      if (index >= 0)
        messages[index] = {
          ...messages[index],
          content: incoming.content,
          status: incoming.status ?? "completed",
        };
      else
        messages.push({
          ...incoming,
          attachments: incoming.attachments ?? [],
        } as (typeof messages)[number]);
    };
    upsert(turn.user);
    upsert(turn.assistant);
    utils.conversation.get.setData({ id: targetId }, { ...existing, messages });
    return true;
  }

  function stopGeneration() {
    generationSequenceRef.current += 1;
    streamAbortRef.current?.abort();
    streamAbortRef.current = null;
    generationActiveRef.current = false;
    setIsGenerating(false);
    setGeneratingMessageId(null);
  }

  function newChat() {
    generationSequenceRef.current += 1;
    streamAbortRef.current?.abort();
    streamAbortRef.current = null;
    generationActiveRef.current = false;
    setIsGenerating(false);
    setGeneratingMessageId(null);
    setPendingMessages(null);
    setPendingConversationId(null);
    setActiveConversationId(null);
    setPrimaryWorkspace(null);
    setVoiceChatOpen(false);
    setSidebarOpen(false);
  }

  async function exportConversation(id: string, format: "pdf" | "word") {
    try {
      const exported = await utils.conversation.export.fetch({ id });
      const slug =
        exported.conversation.title
          .replace(/[^a-z0-9]+/gi, "-")
          .replace(/(^-|-$)/g, "")
          .toLowerCase() || "ksemo-conversation";
      const file =
        format === "word"
          ? createConversationWordFile(
              exported.conversation.title,
              exported.messages
            )
          : createConversationPdfFile(
              exported.conversation.title,
              exported.messages
            );
      const url = URL.createObjectURL(file);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${slug}.${format === "word" ? "doc" : "pdf"}`;
      link.click();
      URL.revokeObjectURL(url);
      toast.success(`Conversation exported as ${format.toUpperCase()}`);
    } catch {
      toast.error("KSEMO could not export this conversation.");
    }
  }

  function conversationShareUrl(token: string) {
    return createPublicConversationUrl(window.location.origin, token);
  }

  async function copyConversationShareLink() {
    if (!shareTarget?.shareToken) return;
    const url = conversationShareUrl(shareTarget.shareToken);
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Public conversation link copied");
    } catch {
      toast.error("KSEMO could not copy the conversation link.");
    }
  }

  function openEmailShare() {
    if (!shareTarget?.shareToken) return;
    const url = conversationShareUrl(shareTarget.shareToken);
    const subject = `KSEMO conversation: ${shareTarget.title}`;
    const body = `Here is a public KSEMO conversation link:\n${url}`;
    window.location.href = `mailto:${encodeURIComponent(shareEmail.trim())}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  }

  async function shareMessage(message: KsemoMessage) {
    try {
      if (navigator.share)
        await navigator.share({
          title: "KSEMO message",
          text: message.content,
        });
      else {
        await navigator.clipboard.writeText(message.content);
        toast.success("Message copied for sharing");
      }
    } catch (error) {
      if ((error as DOMException)?.name !== "AbortError")
        toast.error("KSEMO could not share that message.");
    }
  }

  function deleteMessage(message: KsemoMessage) {
    setDeleteTarget({
      kind: "message",
      id: message.id,
      title:
        message.role === "assistant" ? "this KSEMO response" : "this message",
    });
  }

  function editMessage(message: KsemoMessage) {
    setEditingMessage(message);
    setEditValue(message.content);
  }

  async function restoreMessageVersion(versionId: string, content: string) {
    const message = historyMessage;
    if (!message) return;
    try {
      const result = await restoreUserMessageVersionAndRegenerate({
        messageId: message.id,
        versionId,
        restoredContent: content,
        messages: persistedMessages,
        restore: async (messageId, restoredVersionId) => {
          await messageRestoreMutation.mutateAsync({
            id: messageId,
            versionId: restoredVersionId,
          });
        },
        regenerate: async (restoredContent, assistantMessageId) => {
          void sendMessage(restoredContent, {
            regenerateAssistantMessageId: assistantMessageId,
            replaceUserMessageId: message.id,
          });
        },
      });
      setHistoryMessage(null);
      setEditingMessage(null);
      if (!result.regenerated) toast.success("Message version restored.");
    } catch {
      // The mutation reports a recoverable error to the user.
    }
  }

  async function saveEditedMessage() {
    const message = editingMessage;
    const content = editValue.trim();
    if (!message || !content || content === message.content) {
      setEditingMessage(null);
      return;
    }
    try {
      const result = await saveEditedUserMessageAndRegenerate({
        message,
        editedContent: content,
        messages: persistedMessages,
        save: (messageId, editedContent) =>
          messageEditMutation.mutateAsync({
            id: messageId,
            content: editedContent,
          }),
        regenerate: (editedContent, assistantMessageId) => {
          setEditingMessage(null);
          void sendMessage(editedContent, {
            regenerateAssistantMessageId: assistantMessageId,
            replaceUserMessageId: message.id,
          });
          return Promise.resolve();
        },
      });
      setEditingMessage(null);
      if (!result.regenerated) toast.success("Your message was updated.");
    } catch {
      // The mutation-level error message already informs the user.
    }
  }

  function regenerateMessage(message: KsemoMessage) {
    const assistantIndex = persistedMessages.findIndex(
      item => item.id === message.id
    );
    const sourceUser =
      assistantIndex >= 0
        ? [...persistedMessages.slice(0, assistantIndex)]
            .reverse()
            .find(item => item.role === "user")
        : undefined;
    if (message.role !== "assistant" || !sourceUser) {
      toast.error("KSEMO could not find the user turn for this response.");
      return;
    }
    void sendMessage(sourceUser.content, {
      regenerateAssistantMessageId: message.id,
    });
  }

  async function attachFromComposer(file: File) {
    if (file.size > 8 * 1024 * 1024 || !file.type) {
      toast.error("Choose a recognized file smaller than 8 MB.");
      return;
    }
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      let binary = "";
      for (let index = 0; index < bytes.length; index += 1)
        binary += String.fromCharCode(bytes[index]);
      const uploaded = await composerFileUpload.mutateAsync({
        filename: file.name,
        mimeType: file.type,
        dataBase64: window.btoa(binary),
      });
      if (activeConversationId) {
        await composerFileAttach.mutateAsync({
          fileId: uploaded.id,
          conversationId: activeConversationId,
        });
        setAttachmentNotices([
          {
            fileId: uploaded.id,
            name: file.name,
            mimeType: file.type,
            url: uploaded.url,
            linked: true,
          },
        ]);
        toast.success(
          "File added to your library. Send your message to include it in this conversation."
        );
      } else {
        setAttachmentNotices([
          {
            fileId: uploaded.id,
            name: file.name,
            mimeType: file.type,
            url: uploaded.url,
            linked: false,
          },
        ]);
        toast.success(
          "File added to your private library. Send a message to include it in a new chat."
        );
      }
    } catch {
      toast.error("KSEMO could not add that file.");
    }
  }

  function attachLibraryFile(file: {
    id: string;
    filename: string;
    mimeType?: string;
    url?: string;
  }) {
    setAttachmentNotices(current => [
      ...current,
      {
        fileId: file.id,
        name: file.filename,
        mimeType: file.mimeType,
        url: file.url ?? "",
        linked: Boolean(activeConversationId),
      },
    ]);
  }

  function attachLibraryFiles(
    files: Array<{
      id: string;
      filename: string;
      mimeType?: string;
      url?: string;
    }>
  ) {
    const newAttachments = files.map(file => ({
      fileId: file.id,
      name: file.filename,
      mimeType: file.mimeType,
      url: file.url ?? "",
      linked: Boolean(activeConversationId),
    }));
    setAttachmentNotices(current => [...current, ...newAttachments]);
    toast.success(
      `${files.length} file${files.length > 1 ? "s" : ""} selected. Send your message to include ${files.length > 1 ? "them" : "it"} in this conversation.`
    );
  }

  function startChatWithLibraryFiles(
    files: Array<{
      id: string;
      filename: string;
      mimeType?: string;
      url?: string;
    }>
  ) {
    if (!files.length) return;
    newChat();
    setAttachmentNotices(
      files.map(file => ({
        fileId: file.id,
        name: file.filename,
        mimeType: file.mimeType,
        url: file.url ?? "",
        linked: false,
      }))
    );
    toast.success(
      `${files.length} ${files.length === 1 ? "Library item is" : "Library items are"} ready for a new chat.`
    );
  }

  function selectConversation(id: string) {
    if (isGenerating) {
      toast.info("Finish or stop the current response before switching chats.");
      return;
    }
    setPendingMessages(null);
    setPendingConversationId(null);
    setPrimaryWorkspace(null);
    setVoiceChatOpen(false);
    setActiveConversationId(id);
    setSidebarOpen(false);
  }

  function speak(text: string, messageId: string) {
    if (!("speechSynthesis" in window)) {
      toast.error("Speech playback is not supported in this browser.");
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = (preferencesQuery.data?.speechRate ?? 100) / 100;
    utterance.onstart = () => setSpeechState("playing");
    utterance.onend = () => {
      setSpeakingMessageId(null);
      setSpeechState("idle");
    };
    utterance.onerror = () => {
      setSpeakingMessageId(null);
      setSpeechState("idle");
    };
    setSpeakingMessageId(messageId);
    setSpeechState("playing");
    window.speechSynthesis.speak(utterance);
  }

  function pauseSpeech() {
    window.speechSynthesis.pause();
    setSpeechState("paused");
  }

  function resumeSpeech() {
    window.speechSynthesis.resume();
    setSpeechState("playing");
  }

  function stopSpeech() {
    window.speechSynthesis.cancel();
    setSpeakingMessageId(null);
    setSpeechState("idle");
  }

  if (loading)
    return (
      <div className="grid min-h-screen place-items-center bg-background">
        <div className="size-7 animate-pulse rounded-xl bg-foreground" />
      </div>
    );

  if (!user || isSignedOutPreview) return <AuthStage />;

  return (
    <div className="flex h-dvh overflow-hidden bg-background">
      <ConversationSidebar
        conversations={conversationQuery.data ?? []}
        activeConversationId={activeConversationId}
        open={sidebarOpen}
        collapsed={sidebarCollapsed}
        onClose={() => setSidebarOpen(false)}
        onToggleCollapsed={() => setSidebarCollapsed(current => !current)}
        onNew={newChat}
        onSelect={selectConversation}
        onRename={conversation => {
          setRenameTarget({ id: conversation.id, title: conversation.title });
          setRenameValue(conversation.title);
        }}
        onDuplicate={conversation =>
          duplicateMutation.mutate({ id: conversation.id })
        }
        onArchive={conversation =>
          archiveMutation.mutate({ id: conversation.id, isArchived: true })
        }
        onPin={conversation =>
          pinMutation.mutate({
            id: conversation.id,
            isPinned: !conversation.isPinned,
          })
        }
        onShare={conversation => {
          setShareTarget({
            id: conversation.id,
            title: conversation.title,
            isPublic: Boolean(conversation.isPublic),
            shareToken: conversation.shareToken ?? null,
          });
          setShareEmail("");
        }}
        onExport={(conversation, format) =>
          void exportConversation(conversation.id, format)
        }
        onDelete={conversation =>
          setDeleteTarget({
            kind: "conversation",
            id: conversation.id,
            title: conversation.title,
          })
        }
        onSearch={() => {
          setPrimaryWorkspace("search");
          setSidebarOpen(false);
        }}
        onWorkspace={section => {
          setPrimaryWorkspace("library");
          setSidebarOpen(false);
        }}
        previewSupportOpen={isProfileSupportPreview}
        onSettings={() => setSettingsOpen(true)}
        onSupport={topic => setLocation(`/support/${topic}`)}
        onLogout={logout}
        accounts={savedAccounts}
        switchingAccountId={switchingAccountId}
        onSwitchAccount={account => {
          if (!account.email || account.email === user.email) return;
          setSwitchingAccountId(account.id);
          switchAccountMutation.mutate({ email: account.email });
        }}
        onAddAccount={() => {
          void logout();
        }}
        onRemoveAccount={account => {
          setSavedAccounts(prev => {
            const next = prev.filter(a => a.id !== account.id);
            localStorage.setItem(SAVED_ACCOUNTS_KEY, JSON.stringify(next));
            return next;
          });
          toast.success("Account removed");
        }}
        user={user}
      />

      <main className="relative flex min-w-0 flex-1 flex-col">
        {activePrimaryWorkspace === "library" ? (
          <LibraryWorkspace
            onBackToChat={() => setPrimaryWorkspace(null)}
            onChatWithFiles={startChatWithLibraryFiles}
          />
        ) : activePrimaryWorkspace === "search" ? (
          <SearchWorkspace
            conversations={conversationQuery.data ?? []}
            onBackToChat={() => setPrimaryWorkspace(null)}
            onSelectConversation={id => {
              setActiveConversationId(id);
              setPrimaryWorkspace(null);
            }}
          />
        ) : voiceChatOpen ? (
          <VoiceChat
            conversationId={activeConversationId}
            onConversation={id => {
              setActiveConversationId(id);
              utils.conversation.list.invalidate();
            }}
            onExit={() => setVoiceChatOpen(false)}
            speechRate={(preferencesQuery.data?.speechRate ?? 100) / 100}
          />
        ) : (
          <>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSidebarOpen(true)}
              className="absolute left-3 top-3 z-10 size-9 rounded-xl lg:hidden"
              aria-label="Open conversations"
            >
              <Menu className="size-4" />
            </Button>

            <section
              className={cn(
                "min-h-0 flex-1",
                visibleMessages.length ? "overflow-y-auto" : "overflow-hidden"
              )}
              aria-label="Conversation"
            >
              {activeQuery.isLoading && activeConversationId ? (
                <div className="grid h-full place-items-center text-sm text-muted-foreground">
                  Loading conversation…
                </div>
              ) : visibleMessages.length ? (
                <div className="mx-auto max-w-3xl space-y-7 px-4 pb-4 pt-6 sm:px-6 sm:pb-5 sm:pt-8">
                  {visibleMessages.map(message => (
                    <MessageContent
                      key={message.id}
                      message={message}
                      onSpeak={speak}
                      onPause={pauseSpeech}
                      onResume={resumeSpeech}
                      onStop={stopSpeech}
                      isSpeaking={speakingMessageId === message.id}
                      speechState={speechState}
                      isCurrentGeneration={
                        isGenerating && generatingMessageId === message.id
                      }
                      onEdit={editMessage}
                      onRegenerate={regenerateMessage}
                      onRetry={regenerateMessage}
                      onShare={shareMessage}
                      onDelete={deleteMessage}
                      onViewHistory={userMessage =>
                        setHistoryMessage(userMessage)
                      }
                      onFeedback={(messageId, value) =>
                        messageFeedbackMutation.mutate({ messageId, value })
                      }
                      webSources={webSourcesByMessage[message.id]}
                    />
                  ))}
                  <div ref={messagesEndRef} />
                </div>
              ) : (
                <EmptyState
                  greeting={timeGreeting()}
                  composer={
                    <ChatComposer
                      onSend={sendMessage}
                      onCancel={stopGeneration}
                      onVoice={
                        voice.state === "recording" ? voice.stop : voice.start
                      }
                      onVoiceChat={() => {
                        setPrimaryWorkspace(null);
                        setVoiceChatOpen(true);
                      }}
                      onCancelRecording={voice.cancel}
                      isGenerating={isGenerating}
                      isRecording={
                        voice.state === "recording" || isRecordingPreview
                      }
                      isTranscribing={
                        voice.state === "transcribing" || isTranscribingPreview
                      }
                      recordingSeconds={isRecordingPreview ? 7 : voice.seconds}
                      value={composerValue}
                      onValueChange={setComposerValue}
                      onAttachment={attachFromComposer}
                      attachmentNotices={
                        isAttachmentPreview
                          ? [
                              {
                                fileId: "preview-file",
                                name: "project-brief.pdf",
                                linked: true,
                              },
                            ]
                          : attachmentNotices
                      }
                      onClearAttachment={fileId =>
                        setAttachmentNotices(current =>
                          fileId
                            ? current.filter(file => file.fileId !== fileId)
                            : []
                        )
                      }
                      libraryFiles={libraryFilesQuery.data}
                      onLibraryFile={attachLibraryFiles}
                      initialLibraryOpen={isLibraryPreview}
                      initialToolsOpen={isLibraryPreview}
                      menuPlacement="below"
                      showSafetyNote={false}
                      webSearchEnabled={webSearchEnabled}
                      onToggleWebSearch={() =>
                        setWebSearchEnabled(current => !current)
                      }
                      isCentered={true}
                    />
                  }
                />
              )}
            </section>

            {visibleMessages.length > 0 && (
              <ChatComposer
                onSend={sendMessage}
                onCancel={stopGeneration}
                onVoice={voice.state === "recording" ? voice.stop : voice.start}
                onVoiceChat={() => {
                  setPrimaryWorkspace(null);
                  setVoiceChatOpen(true);
                }}
                onCancelRecording={voice.cancel}
                isGenerating={isGenerating}
                isRecording={voice.state === "recording"}
                isTranscribing={
                  voice.state === "transcribing" || isTranscribingPreview
                }
                recordingSeconds={voice.seconds}
                value={composerValue}
                onValueChange={setComposerValue}
                onAttachment={attachFromComposer}
                attachmentNotices={
                  isAttachmentPreview
                    ? [
                        {
                          fileId: "preview-file",
                          name: "project-brief.pdf",
                          linked: true,
                        },
                      ]
                    : attachmentNotices
                }
                onClearAttachment={fileId =>
                  setAttachmentNotices(current =>
                    fileId ? current.filter(file => file.fileId !== fileId) : []
                  )
                }
                libraryFiles={libraryFilesQuery.data}
                onLibraryFile={attachLibraryFiles}
                initialLibraryOpen={isLibraryPreview}
                compactBottomSpacing
                showSafetyNote
                webSearchEnabled={webSearchEnabled}
                onToggleWebSearch={() =>
                  setWebSearchEnabled(current => !current)
                }
              />
            )}
          </>
        )}
      </main>

      <SettingsDialog
        open={settingsOpen || isSettingsPreview}
        onOpenChange={setSettingsOpen}
        user={user}
        onSignOut={logout}
        onOpenWorkspace={section => {
          setSettingsOpen(false);
          setPrimaryWorkspace("library");
        }}
        onAllChatsDeleted={() => {
          setActiveConversationId(null);
          utils.conversation.list.invalidate();
        }}
      />
      <WorkspacePanel
        open={isWorkspaceDeletePreview}
        onOpenChange={next => {
          if (!next && isWorkspaceDeletePreview)
            window.history.replaceState({}, "", "/");
        }}
        initialSection="files"
        activeConversationId={activeConversationId}
        initialDeletePreview={isWorkspaceDeletePreview}
      />
      <ShareConversationDialog
        open={Boolean(shareTarget) || isSharePreview}
        onOpenChange={next => {
          if (!next) setShareTarget(null);
        }}
        title={shareTarget?.title ?? "your conversation"}
        shareUrl={
          shareTarget?.shareToken
            ? conversationShareUrl(shareTarget.shareToken)
            : ""
        }
        email={shareEmail}
        onEmailChange={setShareEmail}
        onCopy={() => void copyConversationShareLink()}
        onEmail={openEmailShare}
        onSetPublic={isPublic => {
          if (shareTarget)
            publicShareMutation.mutate({ id: shareTarget.id, isPublic });
        }}
        enabled={Boolean(shareTarget) && !publicShareMutation.isPending}
        isPublic={Boolean(shareTarget?.isPublic)}
      />
      <KsemoTextDialog
        open={Boolean(renameTarget) || isRenamePreview}
        onOpenChange={open => {
          if (!open) setRenameTarget(null);
        }}
        title="Rename conversation"
        description="Choose a clear title that helps you find this conversation later."
        label="Conversation title"
        value={isRenamePreview ? "Project planning" : renameValue}
        onValueChange={setRenameValue}
        actionLabel="Save name"
        onAction={() => {
          const title = renameValue.trim();
          if (renameTarget && title) {
            renameMutation.mutate({ id: renameTarget.id, title });
            setRenameTarget(null);
          }
        }}
      />
      <KsemoTextDialog
        open={Boolean(editingMessage) || isEditPreview}
        onOpenChange={open => {
          if (!open) setEditingMessage(null);
        }}
        title="Edit message"
        description="Your earlier version stays safely recorded. Saving updates the following KSEMO response from this exact edited message."
        label="Message"
        value={
          isEditPreview ? "Can you make this answer more concise?" : editValue
        }
        onValueChange={setEditValue}
        multiline
        actionLabel="Save"
        onAction={() => void saveEditedMessage()}
        secondaryActionLabel={
          editingMessage ? "View version history" : undefined
        }
        onSecondaryAction={() =>
          editingMessage && setHistoryMessage(editingMessage)
        }
      />
      <MessageHistoryDialog
        open={Boolean(historyMessage) || isHistoryPreview}
        onOpenChange={open => {
          if (!open) setHistoryMessage(null);
        }}
        versions={
          isHistoryPreview
            ? [
                {
                  id: "version-preview",
                  content:
                    "Could you make this plan concise and include the top three priorities?",
                  createdAt: new Date("2026-08-20T10:00:00Z"),
                },
              ]
            : (messageHistoryQuery.data ?? [])
        }
        loading={messageHistoryQuery.isLoading && !isHistoryPreview}
        restoring={messageRestoreMutation.isPending}
        onRestore={restoreMessageVersion}
      />
      <KsemoConfirmDialog
        open={Boolean(deleteTarget) || isDeletePreview}
        onOpenChange={open => {
          if (!open) setDeleteTarget(null);
        }}
        title={
          deleteTarget?.kind === "conversation" || isDeletePreview
            ? "Delete conversation?"
            : "Delete message?"
        }
        description={
          deleteTarget?.kind === "conversation" || isDeletePreview
            ? `“${deleteTarget?.title ?? "Project planning"}” and its messages will be permanently removed.`
            : `This action permanently removes ${deleteTarget?.title ?? "this message"}.`
        }
        actionLabel="Delete permanently"
        onAction={() => {
          if (!deleteTarget) return;
          if (deleteTarget.kind === "conversation") {
            permanentDeleteMutation.mutate({ id: deleteTarget.id });
            if (activeConversationId === deleteTarget.id) newChat();
          } else messageRemoveMutation.mutate({ id: deleteTarget.id });
          setDeleteTarget(null);
        }}
      />
    </div>
  );
}

function timeGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning — what can I help you with?";
  if (hour < 18) return "Good afternoon — what can I help you with?";
  return "Good evening — what can I help you with?";
}

function EmptyState({
  greeting,
  composer,
}: {
  greeting: string;
  composer: React.ReactNode;
}) {
  return (
    <div className="mx-auto flex h-full w-full max-w-3xl flex-col justify-center px-5 pb-6">
      <div className="mb-4 text-center sm:mb-5">
        <p className="whitespace-nowrap text-[17px] font-bold tracking-[-0.04em] text-foreground sm:text-xl sm:tracking-[-0.025em]">
          {greeting}
        </p>
      </div>
      <div className="mx-auto w-full max-w-3xl">{composer}</div>
    </div>
  );
}

function KsemoTextDialog({
  open,
  onOpenChange,
  title,
  description,
  label,
  value,
  onValueChange,
  multiline = false,
  actionLabel,
  onAction,
  secondaryActionLabel,
  onSecondaryAction,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  label: string;
  value: string;
  onValueChange: (value: string) => void;
  multiline?: boolean;
  actionLabel: string;
  onAction: () => void;
  secondaryActionLabel?: string;
  onSecondaryAction?: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-2xl sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold tracking-[-0.02em]">
            {title}
          </DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {secondaryActionLabel && onSecondaryAction && (
          <Button
            variant="ghost"
            size="sm"
            className="w-fit px-0 text-xs text-muted-foreground hover:bg-transparent hover:text-foreground"
            onClick={onSecondaryAction}
          >
            {secondaryActionLabel}
          </Button>
        )}
        <KsemoTextDialogPanel
          label={label}
          value={value}
          onValueChange={onValueChange}
          multiline={multiline}
          actionLabel={actionLabel}
          onCancel={() => onOpenChange(false)}
          onAction={onAction}
        />
      </DialogContent>
    </Dialog>
  );
}

function MessageHistoryDialog({
  open,
  onOpenChange,
  versions,
  loading,
  restoring,
  onRestore,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  versions: Array<{ id: string; content: string; createdAt: Date }>;
  loading: boolean;
  restoring: boolean;
  onRestore: (id: string, content: string) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[80dvh] overflow-y-auto rounded-2xl sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold tracking-[-0.02em]">
            Message version history
          </DialogTitle>
          <DialogDescription>
            Restoring a prior version preserves the current text as a new
            version. KSEMO will safely regenerate only the following response.
          </DialogDescription>
        </DialogHeader>
        <MessageHistoryDialogPanel
          versions={versions}
          loading={loading}
          restoring={restoring}
          onRestore={onRestore}
        />
      </DialogContent>
    </Dialog>
  );
}

function KsemoConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  actionLabel,
  onAction,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  actionLabel: string;
  onAction: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-2xl sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold tracking-[-0.02em]">
            {title}
          </DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <KsemoConfirmDialogPanel
          actionLabel={actionLabel}
          onCancel={() => onOpenChange(false)}
          onAction={onAction}
        />
      </DialogContent>
    </Dialog>
  );
}
