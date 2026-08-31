import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Loading } from "@/components/ui/loading";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { startLogin } from "@/const";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import {
  FileText,
  Files,
  Menu,
  MoreHorizontal,
  Pin,
  Trash2,
} from "lucide-react";
import { ShareIcon } from "../components/ksemo/icons";
import { useEffect, useMemo, useRef, useState } from "react";
import { memo } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";
import { ChatComposer } from "../components/ksemo/ChatComposer";
import {
  ChatFilesDialog,
  type ChatFile,
} from "../components/ksemo/ChatFilesDialog";
import AuthStage from "./AuthStage";
import { ConversationSidebar } from "../components/ksemo/ConversationSidebar";
import { MessageContent, type KsemoMessage } from "../components/ksemo/MessageContent";

import { SettingsDialog } from "../components/ksemo/SettingsDialog";
import { ShareConversationDialog } from "../components/ksemo/ShareConversationDialog";
import { ConfirmDeleteDialog } from "../components/ksemo/ConfirmDeleteDialog";
import { KsemoTextDialogPanel } from "../components/ksemo/DialogPanels";
import { MessageHistoryDialogPanel } from "../components/ksemo/MessageHistoryDialogPanel";
import { useVoiceInput } from "../hooks/useVoiceInput";
import { usePersistFn } from "../hooks/usePersistFn";
import { WorkspacePanel } from "../components/ksemo/WorkspacePanel";
import { LibraryWorkspace } from "../components/ksemo/LibraryWorkspace";
import { SearchDialog } from "../components/ksemo/SearchWorkspace";
import {
  createConversationPdfFile,
  createConversationWordFile,
} from "../lib/conversationExport";
import { createPublicConversationUrl } from "../lib/ksemoInteraction";
import { saveEditedUserMessageAndRegenerate } from "../lib/editRegeneration";
import { buildStreamingDrafts } from "../lib/streamingDrafts";
import { type DocFormat } from "../lib/docFormats";
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

// Returns true when an attachment with the same filename is already selected,
// so re-pasted or re-uploaded files/images are silently deduplicated instead
// of stacking identical copies.
function hasDuplicateAttachment(
  current: SelectedAttachment[],
  name: string
): boolean {
  const key = name.trim().toLowerCase();
  return current.some(item => item.name.trim().toLowerCase() === key);
}

// Appends new attachments while ignoring any whose filename is already in the
// selected list, preserving the first copy only.
function appendUniqueAttachments(
  current: SelectedAttachment[],
  additions: SelectedAttachment[]
): SelectedAttachment[] {
  const seen = new Set(current.map(item => item.name.trim().toLowerCase()));
  const result = [...current];
  for (const addition of additions) {
    const key = addition.name.trim().toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      result.push(addition);
    }
  }
  return result;
}

// The active conversation is remembered per user so a refresh restores the
// same chat (never a random/new one). An explicit "New Chat" is recorded as a
// sentinel so a refresh after New Chat stays on a fresh chat instead of
// silently reopening the previous conversation.
const ACTIVE_CONVERSATION_NEW_CHAT = "__new__";

function activeConversationStorageKey(userId: number): string {
  return `ksemo-active-conversation-id:${String(userId)}`;
}

function getStoredActiveConversationState(userId: number): {
  conversationId: string | null;
  newChatIntent: boolean;
} {
  try {
    const value = localStorage.getItem(activeConversationStorageKey(userId));
    if (value === null) return { conversationId: null, newChatIntent: false };
    if (value === ACTIVE_CONVERSATION_NEW_CHAT)
      return { conversationId: null, newChatIntent: true };
    return { conversationId: value, newChatIntent: false };
  } catch {
    return { conversationId: null, newChatIntent: false };
  }
}

function storeActiveConversationId(userId: number, id: string): void {
  try {
    localStorage.setItem(activeConversationStorageKey(userId), id);
  } catch {}
}

function rememberNewChatIntent(userId: number): void {
  try {
    localStorage.setItem(
      activeConversationStorageKey(userId),
      ACTIVE_CONVERSATION_NEW_CHAT
    );
  } catch {}
}

export default function Home() {
  const { user, loading, logout } = useAuth();
  const [, setLocation] = useLocation();
  const searchParams = useMemo(
    () => new URLSearchParams(window.location.search),
    []
  );
  const isFreshChatPreview =
    import.meta.env.DEV && searchParams.has("freshChatPreview");
  const isSignedOutPreview =
    import.meta.env.DEV && searchParams.has("signedOutPreview");
  const workspacePreview = import.meta.env.DEV
    ? searchParams.get("workspacePreview")
    : null;
  const interactionPreview = import.meta.env.DEV
    ? new URLSearchParams(window.location.search).get("interactionPreview")
    : null;
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
    import.meta.env.DEV && searchParams.has("sidebarCollapsedPreview");
  const isSidebarOpenPreview =
    import.meta.env.DEV && searchParams.has("sidebarOpenPreview");
  const isProfileSupportPreview =
    import.meta.env.DEV && searchParams.has("profileSupportPreview");
  const sharedConversationId = searchParams.get("conversation");
  const inlineWorkspaceSection: "library" | null =
    workspacePreview === "files" ? "library" : null;
  const utils = trpc.useUtils();
  const [sidebarOpen, setSidebarOpen] = useState(isSidebarOpenPreview);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    if (isCollapsedSidebarPreview) return true;
    try {
      return localStorage.getItem("ksemo-sidebar-collapsed") === "true";
    } catch {
      return false;
    }
  });
  const [activeConversationId, setActiveConversationId] = useState<
    string | null
  >(null);
  const [chatMessages, setChatMessages] = useState<KsemoMessage[]>([]);
  const [composerValue, setComposerValue] = useState("");
  const [attachmentNotices, setAttachmentNotices] = useState<
    SelectedAttachment[]
  >([]);
  const [fileGeneration, setFileGeneration] = useState<{
    messageId: string;
    stage: string;
    format: string;
  } | null>(null);
  const [documentFormat, setDocumentFormat] = useState<DocFormat | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [speakingMessageId, setSpeakingMessageId] = useState<string | null>(
    null
  );
  const [speechState, setSpeechState] = useState<"idle" | "playing" | "paused">(
    "idle"
  );
  const [primaryWorkspace, setPrimaryWorkspace] = useState<"library" | null>(
    null
  );
  const [searchOpen, setSearchOpen] = useState(false);
  const [chatFilesOpen, setChatFilesOpen] = useState(false);
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
  // One active stream per conversation, tracked by the conversation it targets
  // (null = a brand-new conversation that the server has not assigned an id to
  // yet). This lets the user switch chats freely while a response continues to
  // stream in the background — the switch never aborts or loses generation.
  const [streams, setStreams] = useState<
    Array<{
      turnId: number;
      conversationId: string | null;
      userMessageId: string | null;
      assistantMessageId: string | null;
      controller: AbortController;
      active: boolean;
    }>
  >([]);
  const generationSequenceRef = useRef(0);
  // Mirrors activeConversationId so the streaming callbacks (which capture a
  // stale closure) can check whether the user is still viewing the conversation
  // the stream belongs to.
  const activeConversationIdRef = useRef<string | null>(null);
  // Imperative handle to the live streams so cleanup/new-chat/stop can abort the
  // right controllers without waiting for a render.
  const streamsRef = useRef(streams);
  useEffect(() => {
    streamsRef.current = streams;
  }, [streams]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  // The chat pane is the scroll container; tracking closeness to the bottom lets
  // us auto-scroll during generation without fighting the user's scroll wheel.
  const messagesContainerRef = useRef<HTMLElement | null>(null);
  // The inner thread wrapper; observing its height lets us re-pin the view to
  // the newest message when media renders after the initial paint.
  const messagesBodyRef = useRef<HTMLDivElement | null>(null);
  const isNearBottomRef = useRef(true);
  // While "true", the next scroll to the end is treated as the user opening or
  // re-opening a conversation and snaps (instead of animating) to the last
  // message, so the view never lands partway through the thread.
  const pendingOpenScrollRef = useRef(false);
  // Streaming deltas arrive much faster than frames (dozens per token burst).
  // Batches them into one state commit per animation frame instead of forcing a
  // full Home re-render for every token.
  const pendingDeltasRef = useRef<Map<string, string>>(new Map());
  const deltaFlushRafRef = useRef<number>(0);
  // chatMessages is the single source of truth for the open conversation.
  // Server data only seeds it ONCE per conversation id (when it is opened) and
  // is never allowed to overwrite messages that are currently streaming.
  const seededConversationIdRef = useRef<string | null>(null);
  // Tracks whether the current user already auto-selected an initial
  // conversation so the auto-open effect runs once per session.
  const initialSelectionUserIdRef = useRef<string | null>(null);

  // Generation UI derives from the streams for the currently-viewed
  // conversation, so switching chats never leaks one conversation's streaming
  // state into another, and the composer/loading states stay accurate per chat.
  const activeStream = useMemo(
    () =>
      streams.find(
        stream =>
          stream.active &&
          (stream.conversationId === activeConversationId ||
            (stream.conversationId === null && activeConversationId === null))
      ),
    [streams, activeConversationId]
  );
  const isGenerating = Boolean(activeStream);
  const generatingMessageId = activeStream?.assistantMessageId ?? null;

  const conversationQuery = trpc.conversation.list.useQuery(
    { scope: "active" },
    {
      enabled: Boolean(user),
      // Keep the previous list while refetching so the sidebar never flashes
      // empty.
      placeholderData: previousData =>
        previousData && user ? previousData : undefined,
    }
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

  // Keep a ref mirror of the viewed conversation so streaming callbacks can
  // tell whether the user has switched away mid-stream (see sendMessage).
  useEffect(() => {
    activeConversationIdRef.current = activeConversationId;
  }, [activeConversationId]);

  useEffect(() => {
    try {
      localStorage.setItem("ksemo-sidebar-collapsed", String(sidebarCollapsed));
    } catch {}
  }, [sidebarCollapsed]);

  // When the session ends, forget the previous session's chat state so nothing
  // leaks into the next one.
  useEffect(() => {
    if (user) return;
    seededConversationIdRef.current = null;
    initialSelectionUserIdRef.current = null;
    setChatMessages([]);
    setActiveConversationId(null);
    setAttachmentNotices([]);
  }, [user]);
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
  // chatMessages is the single source of truth for the open conversation's
  // messages. The server query only seeds it once per conversation and is
  // never allowed to overwrite messages that are currently streaming or that
  // arrived back from a completed / failed generation. Seeding is not blocked
  // while a response streams so that switching back into a still-generating
  // conversation still loads its in-progress messages.
  useEffect(() => {
    if (!activeConversationId) return;
    if (seededConversationIdRef.current === activeConversationId) return;
    if (activeQuery.isLoading || !activeQuery.data) return;
    seededConversationIdRef.current = activeConversationId;
    // The conversation's full history is about to render into an empty thread,
    // so the next scroll must snap to the newest message rather than animate.
    pendingOpenScrollRef.current = true;
    isNearBottomRef.current = true;
    const serverMessages = activeQuery.data.messages.map(message => ({
      id: message.id,
      role: message.role,
      content: message.content,
      status: message.status,
      attachments: message.attachments,
    }));
    setChatMessages(current => {
      if (!current.length) return serverMessages;
      const serverIds = new Set(serverMessages.map(message => message.id));
      const localStreaming = current.filter(
        message =>
          message.status === "streaming" &&
          message.id.startsWith("local-") &&
          !serverIds.has(message.id)
      );
      if (!localStreaming.length) return serverMessages;
      return [...serverMessages, ...localStreaming];
    });
  }, [activeConversationId, activeQuery.data, activeQuery.isLoading]);

  const attachedMessagePreviewMessages: KsemoMessage[] = [
    {
      id: "media-user",
      role: "user",
      content: "What is in this image?",
      status: "completed",
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
      role: "assistant",
      content:
        "I can use the attached image as context when your selected model supports vision.",
      status: "completed",
    },
  ];
  const editSavingPreviewMessages: KsemoMessage[] = [
    {
      id: "edited-user",
      role: "user",
      content: "Can you make this answer more concise?",
      status: "completed",
    },
    {
      id: "regenerating-assistant",
      role: "assistant",
      content: "",
      status: "streaming",
    },
  ];
  const editRegeneratedPreviewMessages: KsemoMessage[] = [
    {
      id: "edited-user",
      role: "user",
      content: "Can you make this answer more concise?",
      status: "completed",
    },
    {
      id: "regenerated-assistant",
      role: "assistant",
      content:
        "Yes. Here is the concise revision, rebuilt from your edited request without adding another user message.",
      status: "completed",
    },
  ];
  const messagePreviewMessages: KsemoMessage[] = [
    {
      id: "preview-user",
      role: "user",
      content: "Can you make this plan more concise?",
      status: "completed",
    },
    {
      id: "preview-assistant",
      role: "assistant",
      content:
        "Absolutely. I'll keep the main decisions, remove repetition, and make the next steps easier to scan.",
      status: "completed",
    },
  ];
  const visibleMessages = useMemo(() => {
    if (isAttachedMessagePreview) return attachedMessagePreviewMessages;
    if (isEditSavingPreview) return editSavingPreviewMessages;
    if (isEditRegeneratedPreview) return editRegeneratedPreviewMessages;
    if (isMessagePreview) return messagePreviewMessages;
    return chatMessages;
  }, [
    isAttachedMessagePreview,
    isEditSavingPreview,
    isEditRegeneratedPreview,
    isMessagePreview,
    chatMessages,
  ]);

  const chatFiles = useMemo<ChatFile[]>(() => {
    const seen = new Set<string>();
    const files: ChatFile[] = [];
    for (const message of chatMessages) {
      for (const attachment of message.attachments ?? []) {
        if (!attachment.id) continue;
        const key = attachment.id || attachment.url;
        if (seen.has(key)) continue;
        seen.add(key);
        files.push({
          id: attachment.id,
          filename: attachment.filename,
          mimeType: attachment.mimeType,
          url: attachment.url,
        });
      }
    }
    return files;
  }, [chatMessages]);

  useEffect(() => {
    if (!user?.id || !conversationQuery.data) return;
    const userId = String(user.id);
    if (initialSelectionUserIdRef.current === userId) return;
    if (
      activeConversationId &&
      conversationQuery.data.some(item => item.id === activeConversationId)
    ) {
      initialSelectionUserIdRef.current = userId;
      return;
    }
    initialSelectionUserIdRef.current = userId;
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
    const stored = getStoredActiveConversationState(user.id);
    // Restore where the user left off: if they were in a specific chat, reopen
    // it (so a refresh doesn't lose their place). A new-chat marker or no saved
    // session keeps them on a fresh new chat.
    if (stored.newChatIntent) return;
    if (
      stored.conversationId &&
      conversationQuery.data.some(item => item.id === stored.conversationId)
    ) {
      setActiveConversationId(stored.conversationId);
      return;
    }
    if (activeConversationId === null) rememberNewChatIntent(user.id);
  }, [
    user?.id,
    activeConversationId,
    conversationQuery.data,
    isFreshChatPreview,
    sharedConversationId,
    utils.conversation.get,
    rememberNewChatIntent,
  ]);

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

  // Scrolls the conversation thread to its newest message. Prefers the end
  // sentinel so it always lands exactly on the last item of the thread.
  function scrollChatToEnd(mode: "auto" | "smooth") {
    const container = messagesContainerRef.current;
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({
        behavior: mode,
        block: "end",
      });
    } else {
      container?.scrollTo({ top: container.scrollHeight, behavior: mode });
    }
  }

  // Scrolls on every conversation open / switch and whenever the thread changes.
  // Opening snaps straight to the last message (so async content that renders
  // after the first paint cannot leave the view in the middle of the thread);
  // new content that arrives while reading is only followed when the user is
  // already near the bottom.
  useEffect(() => {
    if (!activeConversationId) return;
    if (!isNearBottomRef.current) return;
    const opening = pendingOpenScrollRef.current;
    const container = messagesContainerRef.current;
    const threadRendered =
      container !== null && container.scrollHeight > container.clientHeight;
    if (opening && threadRendered) pendingOpenScrollRef.current = false;
    scrollChatToEnd(opening || isGenerating ? "auto" : "smooth");
  }, [visibleMessages, isGenerating, activeConversationId]);

  // While the view is pinned near the bottom, keep it glued there even when
  // media (images, highlighted code, web fonts) loads and grows the thread
  // after the fact. Scrolling up to read older messages breaks the pin.
  useEffect(() => {
    const body = messagesBodyRef.current;
    if (!body) return;
    const observer = new ResizeObserver(() => {
      if (!isNearBottomRef.current) return;
      scrollChatToEnd("auto");
    });
    observer.observe(body);
    return () => observer.disconnect();
  }, [visibleMessages.length]);

  useEffect(
    () => () => {
      if (deltaFlushRafRef.current) cancelAnimationFrame(deltaFlushRafRef.current);
      for (const stream of streamsRef.current) stream.controller.abort();
      window.speechSynthesis?.cancel();
    },
    []
  );

  function flushPendingDeltas() {
    if (deltaFlushRafRef.current) {
      cancelAnimationFrame(deltaFlushRafRef.current);
      deltaFlushRafRef.current = 0;
    }
    const deltas = pendingDeltasRef.current;
    if (!deltas.size) return;
    pendingDeltasRef.current = new Map();
    setChatMessages(current => {
      let changed = false;
      const next = current.map(message => {
        const delta = deltas.get(message.id);
        if (delta === undefined) return message;
        changed = true;
        return { ...message, content: message.content + delta };
      });
      return changed ? next : current;
    });
  }

  function handleMessagesScroll() {
    const el = messagesContainerRef.current;
    if (!el) return;
    // Within ~96px of the bottom counts as pinned to the newest message.
    isNearBottomRef.current =
      el.scrollHeight - el.scrollTop - el.clientHeight < 96;
  }

  async function sendMessage(
    content: string,
    options: {
      regenerateAssistantMessageId?: string;
      replaceUserMessageId?: string;
    } = {}
  ) {
    const conversationId = activeConversationId;
    // Per-conversation double-submit guard: let other chats keep generating in
    // the background, but never start a second stream in the same conversation.
    if (
      streamsRef.current.some(
        stream => stream.active && stream.conversationId === conversationId
      )
    )
      return;
    const knownMessages = chatMessages;
    const isRegeneration = Boolean(options.regenerateAssistantMessageId);
    const draftNow = Date.now();
    const selectedAttachments = !isRegeneration ? attachmentNotices : [];
    const drafts = buildStreamingDrafts(knownMessages, content, {
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
    }) as KsemoMessage[];
    setChatMessages(drafts);
    setFileGeneration(null);
    if (selectedAttachments.length) setAttachmentNotices([]);
    const controller = new AbortController();
    const turnSequence = ++generationSequenceRef.current;
    const streamEntry = {
      turnId: turnSequence,
      conversationId,
      userMessageId: null as string | null,
      assistantMessageId: options.regenerateAssistantMessageId ?? `local-assistant-${draftNow}`,
      controller,
      active: true,
    };
    setStreams(current => [...current, streamEntry]);
    // True when the user is still viewing the conversation this stream writes to.
    const isViewingThisStream = () =>
      activeConversationIdRef.current === streamEntry.conversationId;

    const startedAt = Date.now();
    let lastProgressAt = startedAt;
    let stalled = false;
    let userStopped = false;
    let errorMessage: string | null = null;
    const maxDuration = STREAM_MAX_DURATION_MS;
    const watchdog = window.setInterval(() => {
      const now = Date.now();
      if (
        now - lastProgressAt > STREAM_IDLE_TIMEOUT_MS ||
        now - startedAt > maxDuration
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
          documentFormat: documentFormat ?? undefined,
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
          const lines = rawEvent.split("\n");
          const eventName = lines
            .find(line => line.startsWith("event:"))
            ?.slice(6)
            .trim();
          const rawData = lines
            .find(line => line.startsWith("data:"))
            ?.slice(5)
            .trim();
          if (!eventName || !rawData) continue;
          let data: Record<string, unknown>;
          try {
            data = JSON.parse(rawData) as Record<string, unknown>;
          } catch {
            continue;
          }
          const str = (value: unknown): string =>
            typeof value === "string" ? value : "";
          if (eventName === "conversation") {
            lastProgressAt = Date.now();
            const conv = data as unknown as StreamConversation;
            streamConversation = conv;
            // Whether the user is (still) looking at the conversation this new
            // server conversation belongs to before we re-point the stream.
            const wasViewing = isViewingThisStream();
            streamEntry.conversationId = conv.conversationId;
            streamEntry.userMessageId = conv.userMessageId;
            streamEntry.assistantMessageId = conv.assistantMessageId;
            if (wasViewing) {
              // Stay on this (fresh) conversation so the optimistic drafts keep
              // rendering here with their real server ids.
              setActiveConversationId(conv.conversationId);
              if (user?.id) storeActiveConversationId(user.id, conv.conversationId);
              // The local drafts below are authoritative, so the seed effect
              // must not overwrite them with a mid-stream database snapshot.
              seededConversationIdRef.current = conv.conversationId;
              setChatMessages(current =>
                current.map(message =>
                  message.id.startsWith("local-user")
                    ? { ...message, id: conv.userMessageId }
                    : message.id.startsWith("local-assistant")
                      ? { ...message, id: conv.assistantMessageId }
                      : message
                )
              );
            }
            utils.conversation.list.invalidate();
          } else if (eventName === "assistant.delta") {
            lastProgressAt = Date.now();
            const delta = str(data.delta);
            const messageId = str(data.messageId);
            responseText += delta;
            // Only mutate the visible conversation's messages when it is the one
            // this stream belongs to. Otherwise the deltas ride along in
            // responseText and are written by the seed/sync path when the user
            // returns to (or already has open) that conversation.
            if (isViewingThisStream()) {
              const pending = pendingDeltasRef.current;
              pending.set(messageId, (pending.get(messageId) ?? "") + delta);
              if (!deltaFlushRafRef.current) {
                deltaFlushRafRef.current = requestAnimationFrame(() => {
                  deltaFlushRafRef.current = 0;
                  flushPendingDeltas();
                });
              }
            }
          } else if (eventName === "assistant.completed") {
            lastProgressAt = Date.now();
          } else if (eventName === "assistant.error") {
            lastProgressAt = Date.now();
            errorMessage =
              str(data.message) || "KSEMO could not complete this response.";
          } else if (eventName === "file.progress") {
            lastProgressAt = Date.now();
            setFileGeneration({
              messageId: str(data.messageId),
              stage: str(data.stage) || "detecting",
              format: str(data.format ?? ""),
            });
          } else if (eventName === "file.created") {
            lastProgressAt = Date.now();
            setFileGeneration(null);
            utils.workspace.files.list.invalidate();
            const fileData = data.file as
              | {
                  fileId?: string;
                  filename?: string;
                  mimeType?: string;
                  url?: string;
                  sizeBytes?: number;
                }
              | undefined;
            const assistantId = str(data.messageId);
            if (fileData?.fileId && isViewingThisStream()) {
              setChatMessages(current =>
                current.map(message =>
                  message.id === assistantId
                    ? {
                        ...message,
                        attachments: [
                          ...(message.attachments ?? []).filter(
                            a => a.id !== fileData.fileId
                          ),
                          {
                            id: fileData.fileId!,
                            filename: fileData.filename ?? "",
                            mimeType: fileData.mimeType,
                            url: fileData.url ?? "",
                            sizeBytes: fileData.sizeBytes,
                          },
                        ],
                      }
                    : message
                )
              );
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

    // The stream is finished for this conversation. Mark it inactive so the
    // derived generating state for this conversation switches off, then
    // finalize it. Streams in other conversations are left untouched.
    setStreams(current =>
      current.map(stream =>
        stream.turnId === turnSequence ? { ...stream, active: false } : stream
      )
    );

    const failureMessage =
      errorMessage ??
      (stalled
        ? responseText
          ? "KSEMO stopped waiting because this response took too long."
          : "KSEMO's response stalled. Please try again."
        : null);
    const completedConversation =
      streamConversation as StreamConversation | null;

    const finalStatus = failureMessage
      ? "failed"
      : userStopped
        ? "cancelled"
        : "completed";

    // Only touch the visible conversation's messages if the user is actually
    // viewing it right now. If they switched away the server already owns the
    // truth and the seed/sync path will surface the finished response.
    if (isViewingThisStream()) {
      // Drain any deltas still sitting in the rAF buffer so the final content
      // below is complete and idempotent.
      flushPendingDeltas();
      if (!completedConversation) {
        setComposerValue(current => (current ? current : content));
        if (failureMessage) toast.error(failureMessage);
        if (options.regenerateAssistantMessageId || options.replaceUserMessageId) {
          // The turn ids are already server-recognized; keep the layout intact
          // and mark the in-flight bubble as failed so Retry is available.
          setChatMessages(current =>
            current.map(message =>
              message.role === "assistant" && message.status === "streaming"
                ? { ...message, content: "", status: "failed" }
                : message
            )
          );
        } else {
          // The request never produced a server conversation, so the optimistic
          // drafts have no ids to keep. Remove them while preserving the user's
          // wording in the composer for an easy retry.
          setChatMessages(current =>
            current.filter(message => !message.id.startsWith("local-"))
          );
        }
        return;
      }

      if (failureMessage) toast.error(failureMessage);

      setChatMessages(current =>
        current.map(message =>
          message.role === "assistant" && message.status === "streaming"
            ? {
                ...message,
                content: responseText || message.content,
                status: finalStatus,
              }
            : message
        )
      );
    } else if (failureMessage) {
      toast.error(failureMessage);
    }

    if (completedConversation) {
      // Refresh the caching query for this conversation so that returning to it
      // shows the finished response immediately (server has already settled it).
      await syncConversationFromServer(completedConversation.conversationId);

      if (
        isViewingThisStream() &&
        preferencesQuery.data?.autoPlayResponses &&
        responseText &&
        !failureMessage &&
        !userStopped
      )
        speak(responseText, completedConversation.assistantMessageId);
    }
  }

  async function syncConversationFromServer(targetId: string) {
    const fresh = await withDeadline(
      utils.conversation.get.fetch({ id: targetId }),
      REFRESH_TIMEOUT_MS
    );
    return fresh !== null;
  }

  function stopGeneration() {
    // Stop only the stream for the currently-viewed conversation; any other
    // conversations generating in the background are left untouched.
    const target = activeConversationId;
    for (const stream of streamsRef.current) {
      if (stream.active && stream.conversationId === target) {
        stream.controller.abort();
        setStreams(current =>
          current.map(item =>
            item.turnId === stream.turnId ? { ...item, active: false } : item
          )
        );
      }
    }
  }

  function newChat() {
    // Starting a fresh chat aborts any stream targeting the current view so the
    // composer is free, but never touches background streams in other chats.
    const target = activeConversationId;
    for (const stream of streamsRef.current) {
      if (stream.active && stream.conversationId === target) {
        stream.controller.abort();
        setStreams(current =>
          current.map(item =>
            item.turnId === stream.turnId ? { ...item, active: false } : item
          )
        );
      }
    }
    seededConversationIdRef.current = null;
    isNearBottomRef.current = true;
    pendingOpenScrollRef.current = true;
    setChatMessages([]);
    setActiveConversationId(null);
    if (user?.id) rememberNewChatIntent(user.id);
    setPrimaryWorkspace(null);
    setAttachmentNotices([]);
    window.speechSynthesis?.cancel();
    setSpeakingMessageId(null);
    setSpeechState("idle");
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

  function openShareDialog(conversation: {
    id: string;
    title: string;
    isPublic?: boolean;
    shareToken?: string | null;
  }) {
    setShareTarget({
      id: conversation.id,
      title: conversation.title,
      isPublic: Boolean(conversation.isPublic),
      shareToken: conversation.shareToken ?? null,
    });
    setShareEmail("");
  }

  async function shareMessage(_message: KsemoMessage) {
    const conversation = activeQuery.data?.conversation;
    if (!conversation?.id) return;
    openShareDialog(conversation);
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
        messages: chatMessages,
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
      setChatMessages(current =>
        current.map(item =>
          item.id === message.id ? { ...item, content } : item
        )
      );
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
        messages: chatMessages,
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
      setChatMessages(current =>
        current.map(item =>
          item.id === message.id ? { ...item, content } : item
        )
      );
      if (!result.regenerated) toast.success("Your message was updated.");
    } catch {
      // The mutation-level error message already informs the user.
    }
  }

  function regenerateMessage(message: KsemoMessage) {
    const assistantIndex = chatMessages.findIndex(
      item => item.id === message.id
    );
    let sourceUser;
    if (assistantIndex >= 0) {
      for (let index = assistantIndex - 1; index >= 0; index -= 1) {
        if (chatMessages[index].role === "user") {
          sourceUser = chatMessages[index];
          break;
        }
      }
    }
    if (message.role !== "assistant" || !sourceUser) {
      toast.error("KSEMO could not find the user turn for this response.");
      return;
    }
    if (message.id.startsWith("local-")) {
      // A retry of a response that never reached the server: re-send the
      // source turn normally so a real conversation is created.
      void sendMessage(sourceUser.content);
      return;
    }
    void sendMessage(sourceUser.content, {
      regenerateAssistantMessageId: message.id,
    });
  }



  async function attachFromComposer(file: File) {
    if (file.size > 25 * 1024 * 1024 || !file.type) {
      toast.error("Choose a recognized file smaller than 25 MB.");
      return;
    }
    if (hasDuplicateAttachment(attachmentNotices, file.name)) {
      toast.info(`"${file.name}" is already attached.`);
      return;
    }
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      let binary = "";
      const CHUNK_SIZE = 0x8000;
      for (let offset = 0; offset < bytes.length; offset += CHUNK_SIZE)
        binary += String.fromCharCode.apply(
          null,
          bytes.subarray(offset, offset + CHUNK_SIZE) as unknown as number[]
        );
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
        setAttachmentNotices(current => [
          ...current,
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
        setAttachmentNotices(current => [
          ...current,
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

  async function captureScreenshot() {
    if (!navigator.mediaDevices?.getDisplayMedia) {
      toast.error(
        "Screen capture is not supported in this browser."
      );
      return;
    }
    let stream: MediaStream | null = null;
    try {
      stream = await navigator.mediaDevices.getDisplayMedia({
        video: { displaySurface: "monitor" } as MediaTrackConstraints,
        audio: false,
      });
      const track = stream.getVideoTracks()[0];
      if (!track) {
        toast.error("Screen capture failed. Please try again.");
        return;
      }
      const video = document.createElement("video");
      video.srcObject = stream;
      video.muted = true;
      await video.play();
      await new Promise<void>(resolve => {
        if (video.readyState >= 2) return resolve();
        video.onloadeddata = () => resolve();
      });
      await new Promise(r => setTimeout(r, 100));
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        track.stop();
        toast.error("Screen capture failed. Please try again.");
        return;
      }
      ctx.drawImage(video, 0, 0);
      video.srcObject = null;
      track.stop();
      const blob = await new Promise<Blob | null>(resolve =>
        canvas.toBlob(resolve, "image/png", 0.92)
      );
      if (!blob) {
        toast.error("Screen capture failed. Please try again.");
        return;
      }
      const timestamp = Date.now();
      const file = new File(
        [blob],
        `ksemo-screenshot-${timestamp}.png`,
        { type: "image/png" }
      );
      await attachFromComposer(file);
    } catch (error: unknown) {
      if (stream) {
        for (const track of stream.getVideoTracks()) track.stop();
      }
      const name =
        error instanceof Error ? error.name : String(error);
      if (name === "NotAllowedError") return;
      if (name === "NotReadableError") {
        toast.error("Could not read the captured screen. Please try again.");
        return;
      }
      toast.error("Screen capture failed. Please try again.");
    }
  }

  function attachLibraryFile(file: {
    id: string;
    filename: string;
    mimeType?: string;
    url?: string;
  }) {
    setAttachmentNotices(current =>
      appendUniqueAttachments(current, [
        {
          fileId: file.id,
          name: file.filename,
          mimeType: file.mimeType,
          url: file.url ?? "",
          linked: Boolean(activeConversationId),
        },
      ])
    );
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
    setAttachmentNotices(current =>
      appendUniqueAttachments(current, newAttachments)
    );
    const existing = new Set(
      attachmentNotices.map(item => item.name.trim().toLowerCase())
    );
    const addedCount = newAttachments.filter(file => {
      const key = file.name.trim().toLowerCase();
      if (existing.has(key)) return false;
      existing.add(key);
      return true;
    }).length;
    if (addedCount > 0) {
      toast.success(
        `${addedCount} file${addedCount > 1 ? "s" : ""} selected. Send your message to include ${addedCount > 1 ? "them" : "it"} in this conversation.`
      );
    } else {
      toast.info("Those files are already attached.");
    }
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
    const seen = new Set<string>();
    const unique = files.filter(file => {
      const key = file.filename.trim().toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    setAttachmentNotices(
      unique.map(file => ({
        fileId: file.id,
        name: file.filename,
        mimeType: file.mimeType,
        url: file.url ?? "",
        linked: false,
      }))
    );
    toast.success(
      `${unique.length} ${unique.length === 1 ? "file is" : "files are"} ready for a new chat.`
    );
  }

  function selectConversation(id: string) {
    if (id === activeConversationId) {
      // Clicking the chat that is already open still jumps straight to the
      // newest message (e.g. after scrolling up to read older messages).
      isNearBottomRef.current = true;
      scrollChatToEnd("auto");
      return;
    }
    // Switching is always allowed, even while another conversation's response
    // is still streaming in the background. That stream keeps running and the
    // finished response is saved to its original conversation.
    setChatMessages([]);
    isNearBottomRef.current = true;
    pendingOpenScrollRef.current = true;
    setPrimaryWorkspace(null);
    setActiveConversationId(id);
    if (user?.id) storeActiveConversationId(user.id, id);
    setAttachmentNotices([]);
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

  // Stable wrappers for every callback handed to memoized children. Without
  // these, useMemo/React.memo boundaries would be defeated because Home
  // recreates plain function declarations on each render.
  const stableSendMessage = usePersistFn(sendMessage);
  const stableComposerSend = usePersistFn((content: string) =>
    void sendMessage(content)
  );
  const stableStopGeneration = usePersistFn(stopGeneration);
  const stableNewChat = usePersistFn(newChat);
  const stableSelectConversation = usePersistFn(selectConversation);
  const stableAttachFromComposer = usePersistFn(attachFromComposer);
  const stableAttachLibraryFiles = usePersistFn(attachLibraryFiles);
  const stableCaptureScreenshot = usePersistFn(captureScreenshot);
  const stableLogout = usePersistFn(logout);
  const stableSpeak = usePersistFn(speak);
  const stablePauseSpeech = usePersistFn(pauseSpeech);
  const stableResumeSpeech = usePersistFn(resumeSpeech);
  const stableStopSpeech = usePersistFn(stopSpeech);
  const stableEditMessage = usePersistFn(editMessage);
  const stableRegenerateMessage = usePersistFn(regenerateMessage);
  const stableShareMessage = usePersistFn(shareMessage);
  const stableDeleteMessage = usePersistFn(deleteMessage);
  const stableRestoreMessageVersion = usePersistFn(restoreMessageVersion);
  const stableVoiceAction = usePersistFn(
    voice.state === "recording" ? voice.stop : voice.start
  );
  const stableVoiceCancel = usePersistFn(voice.cancel);
  const stableOnViewHistory = usePersistFn(
    (userMessage: KsemoMessage) => setHistoryMessage(userMessage)
  );
  const stableOnFeedback = usePersistFn(
    (messageId: string, value: "up" | "down") =>
      messageFeedbackMutation.mutate({ messageId, value })
  );
  const stableOnClearAttachment = usePersistFn(
    (fileId?: string) =>
      setAttachmentNotices(current =>
        fileId ? current.filter(file => file.fileId !== fileId) : []
      )
  );
  const stableOnCloseSidebar = usePersistFn(() => setSidebarOpen(false));
  const stableOnToggleCollapsed = usePersistFn(() =>
    setSidebarCollapsed(current => !current)
  );
  const stableOnRename = usePersistFn(
    (conversation: { id: string; title: string }) => {
      setRenameTarget({ id: conversation.id, title: conversation.title });
      setRenameValue(conversation.title);
    }
  );
  const stableOnDuplicate = usePersistFn(
    (conversation: { id: string }) =>
      duplicateMutation.mutate({ id: conversation.id })
  );
  const stableOnArchive = usePersistFn(
    (conversation: { id: string }) =>
      archiveMutation.mutate({ id: conversation.id, isArchived: true })
  );
  const stableOnPin = usePersistFn(
    (conversation: { id: string; isPinned: boolean }) =>
      pinMutation.mutate({
        id: conversation.id,
        isPinned: !conversation.isPinned,
      })
  );
  const stableOnShareConversation = usePersistFn(
    (conversation: {
      id: string;
      title: string;
      isPublic?: boolean;
      shareToken?: string | null;
    }) => {
      setShareTarget({
        id: conversation.id,
        title: conversation.title,
        isPublic: Boolean(conversation.isPublic),
        shareToken: conversation.shareToken ?? null,
      });
      setShareEmail("");
    }
  );
  const stableOnExport = usePersistFn(
    (conversation: { id: string }, format: "pdf" | "word") =>
      void exportConversation(conversation.id, format)
  );
  const stableOnDelete = usePersistFn(
    (conversation: { id: string; title: string }) =>
      setDeleteTarget({
        kind: "conversation",
        id: conversation.id,
        title: conversation.title,
      })
  );
  const stableOnSearch = usePersistFn(() => {
    setSearchOpen(true);
    setSidebarOpen(false);
  });
  const stableOnWorkspace = usePersistFn((_section: "files") => {
    setPrimaryWorkspace("library");
    setSidebarOpen(false);
  });
  const stableOnSettings = usePersistFn(() => setSettingsOpen(true));
  const stableOnSupport = usePersistFn((topic: "faq" | "privacy" | "terms") =>
    setLocation(`/support/${topic}`)
  );
  const stableOnSearchSelect = usePersistFn((id: string) => {
    selectConversation(id);
    setSearchOpen(false);
  });
  const stableOnOpenArchivedConversation = usePersistFn(
    (conversationId: string) => {
      setSettingsOpen(false);
      selectConversation(conversationId);
    }
  );
  const stableOnAllChatsDeleted = usePersistFn(() => {
    newChat();
    utils.conversation.list.invalidate();
  });
  const stableOnAccountDeleted = usePersistFn(() => {
    setSettingsOpen(false);
    newChat();
    try {
      localStorage.removeItem("ksemo-user-info");
    } catch {}
    try {
      sessionStorage.removeItem("ksemo-cookie");
    } catch {}
    void logout();
  });
  const stableShareOnOpenChange = usePersistFn((next: boolean) => {
    if (!next) setShareTarget(null);
  });
  const stableShareOnCopy = usePersistFn(() => void copyConversationShareLink());
  const stableShareOnEmail = usePersistFn(openEmailShare);
  const stableShareOnSetPublic = usePersistFn(
    (isPublic: boolean) => {
      if (shareTarget)
        publicShareMutation.mutate({ id: shareTarget.id, isPublic });
    }
  );
  const stableWorkspaceOnOpenChange = usePersistFn((next: boolean) => {
    if (!next && isWorkspaceDeletePreview)
      window.history.replaceState({}, "", "/");
  });
  const stableRenameDialogOpen = usePersistFn((open: boolean) => {
    if (!open) setRenameTarget(null);
  });
  const stableRenameAction = usePersistFn(() => {
    const title = renameValue.trim();
    if (renameTarget && title) {
      renameMutation.mutate({ id: renameTarget.id, title });
      setRenameTarget(null);
    }
  });
  const stableEditDialogOpen = usePersistFn((open: boolean) => {
    if (!open) setEditingMessage(null);
  });
  const stableEditAction = usePersistFn(() => void saveEditedMessage());
  const stableEditSecondaryAction = usePersistFn(() => {
    if (editingMessage) setHistoryMessage(editingMessage);
  });
  const stableHistoryOpen = usePersistFn((open: boolean) => {
    if (!open) setHistoryMessage(null);
  });
  const stableDeleteDialogOpen = usePersistFn((open: boolean) => {
    if (!open) setDeleteTarget(null);
  });
  const stableDeleteAction = usePersistFn(() => {
    if (!deleteTarget) return;
    if (deleteTarget.kind === "conversation") {
      permanentDeleteMutation.mutate({ id: deleteTarget.id });
      if (activeConversationId === deleteTarget.id) newChat();
    } else {
      messageRemoveMutation.mutate({ id: deleteTarget.id });
      setChatMessages(current =>
        current.filter(message => message.id !== deleteTarget.id)
      );
    }
    setDeleteTarget(null);
  });

  const greeting = useMemo(timeGreeting, []);

  if (loading)
    return (
      <Loading fullScreen />
    );

  if (!user || isSignedOutPreview) return <AuthStage />;

  return (
    <div className="flex h-dvh overflow-hidden bg-background">
      <ConversationSidebar
        conversations={conversationQuery.data ?? []}
        activeConversationId={activeConversationId}
        open={sidebarOpen}
        collapsed={sidebarCollapsed}
        onClose={stableOnCloseSidebar}
        onToggleCollapsed={stableOnToggleCollapsed}
        onNew={stableNewChat}
        onSelect={stableSelectConversation}
        onRename={stableOnRename}
        onDuplicate={stableOnDuplicate}
        onArchive={stableOnArchive}
        onPin={stableOnPin}
        onShare={stableOnShareConversation}
        onExport={stableOnExport}
        onDelete={stableOnDelete}
        onSearch={stableOnSearch}
        onWorkspace={stableOnWorkspace}
        previewSupportOpen={isProfileSupportPreview}
        onSettings={stableOnSettings}
        onSupport={stableOnSupport}
        onLogout={stableLogout}
        user={user}
      />

      <main className="relative flex min-w-0 flex-1 flex-col">
        {activePrimaryWorkspace === "library" ? (
          <LibraryWorkspace
            onBackToChat={() => setPrimaryWorkspace(null)}
            onChatWithFiles={startChatWithLibraryFiles}
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

            {visibleMessages.length > 0 && (
              <div className="absolute right-4 top-4 z-10">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-9 rounded-xl"
                      aria-label="Chat actions"
                    >
                      <MoreHorizontal className="size-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuItem
                      disabled={!activeConversationId}
                      onSelect={() => {
                        if (activeConversationId) {
                          const pinned =
                            activeQuery.data?.conversation?.isPinned ?? false;
                          stableOnPin({
                            id: activeConversationId,
                            isPinned: pinned,
                          });
                        }
                      }}
                    >
                      <Pin className="mr-2 size-4" />
                      {activeQuery.data?.conversation?.isPinned ? "Unpin" : "Pin"}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      disabled={!activeConversationId}
                      onSelect={() => {
                        if (activeConversationId) {
                          const conv = activeQuery.data?.conversation;
                          stableOnShareConversation(
                            conv
                              ? {
                                  id: activeConversationId,
                                  title: conv.title,
                                  isPublic: conv.isPublic,
                                  shareToken: conv.shareToken,
                                }
                              : {
                                  id: activeConversationId,
                                  title: "this conversation",
                                }
                          );
                        }
                      }}
                    >
                      <ShareIcon className="mr-2 size-4" />
                        Share
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => setChatFilesOpen(true)}>
                      <Files className="mr-2 size-4" />
                      View files in this chat
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      disabled={!activeConversationId}
                      variant="destructive"
                      onSelect={() => {
                        if (activeConversationId)
                          stableOnDelete({
                            id: activeConversationId,
                            title:
                              activeQuery.data?.conversation?.title ??
                              "this conversation",
                          });
                      }}
                    >
                      <Trash2 className="mr-2 size-4" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <ChatFilesDialog
                  open={chatFilesOpen}
                  onOpenChange={setChatFilesOpen}
                  files={chatFiles}
                />
              </div>
            )}

            <section
              ref={messagesContainerRef}
              onScroll={handleMessagesScroll}
              className={cn(
                "min-h-0 flex-1",
                visibleMessages.length ? "overflow-y-auto" : "overflow-hidden"
              )}
              aria-label="Conversation"
            >
              {visibleMessages.length ? (
                <div
                  ref={messagesBodyRef}
                  className="mx-auto max-w-3xl space-y-7 px-4 pb-4 pt-6 sm:px-6 sm:pb-5 sm:pt-8"
                >
                  {visibleMessages.map(message => {
                    return (
                      <>
                      {fileGeneration && fileGeneration.messageId === message.id && (
                        <div className="mb-1.5 flex items-center gap-2 text-xs text-muted-foreground">
                          <span className="size-3 animate-spin rounded-full border-[1.5px] border-muted-foreground/30 border-t-muted-foreground" />
                          {fileGeneration.stage === "generating"
                            ? `Creating ${fileGeneration.format.toUpperCase()} file…`
                            : "Preparing your file…"}
                        </div>
                      )}
                      <MessageContent
                        key={message.id}
                        message={message}
                        onSpeak={stableSpeak}
                        onPause={stablePauseSpeech}
                        onResume={stableResumeSpeech}
                        onStop={stableStopSpeech}
                        isSpeaking={speakingMessageId === message.id}
                        speechState={speechState}
                        isCurrentGeneration={
                          isGenerating && generatingMessageId === message.id
                        }
                        onEdit={stableEditMessage}
                        onRegenerate={stableRegenerateMessage}
                        onRetry={stableRegenerateMessage}
                        onShare={stableShareMessage}
                        onDelete={stableDeleteMessage}
                        onViewHistory={stableOnViewHistory}
                        onFeedback={stableOnFeedback}
                      />
                      </>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </div>
              ) : activeQuery.isLoading && activeConversationId && !isGenerating ? (
                <Loading />
              ) : (
                <EmptyState
                  greeting={greeting}
                  composer={
                    <ChatComposer
                      onSend={stableComposerSend}
                      onCancel={stableStopGeneration}
                      onVoice={stableVoiceAction}
                      onCancelRecording={stableVoiceCancel}
                      isGenerating={isGenerating}
                      isRecording={voice.state === "recording"}
                      isTranscribing={voice.state === "transcribing"}
                      recordingSeconds={voice.seconds}
                      value={composerValue}
                      onValueChange={setComposerValue}
                      documentFormat={documentFormat}
                      onDocumentFormatChange={setDocumentFormat}
                      onAttachment={stableAttachFromComposer}
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
                      onClearAttachment={stableOnClearAttachment}
                      libraryFiles={libraryFilesQuery.data}
                      onLibraryFile={stableAttachLibraryFiles}
                      initialLibraryOpen={isLibraryPreview}
                      initialToolsOpen={isLibraryPreview}
                      menuPlacement="below"
                      showSafetyNote={false}
                      isCentered={true}
                      onTakeScreenshot={stableCaptureScreenshot}
                    />
                  }
                />
              )}
            </section>

            {visibleMessages.length > 0 && (
              <ChatComposer
                onSend={stableComposerSend}
                onCancel={stableStopGeneration}
                onVoice={stableVoiceAction}
                onCancelRecording={stableVoiceCancel}
                isGenerating={isGenerating}
                isRecording={voice.state === "recording"}
                isTranscribing={voice.state === "transcribing"}
                recordingSeconds={voice.seconds}
                value={composerValue}
                onValueChange={setComposerValue}
                documentFormat={documentFormat}
                onDocumentFormatChange={setDocumentFormat}
                onAttachment={stableAttachFromComposer}
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
                onClearAttachment={stableOnClearAttachment}
                libraryFiles={libraryFilesQuery.data}
                onLibraryFile={stableAttachLibraryFiles}
                initialLibraryOpen={isLibraryPreview}
                menuPlacement="above"
                compactBottomSpacing
                showSafetyNote
                onTakeScreenshot={stableCaptureScreenshot}
              />
            )}
          </>
        )}
      </main>

      <SearchDialog
        open={searchOpen}
        onOpenChange={setSearchOpen}
        conversations={conversationQuery.data ?? []}
        onSelectConversation={stableOnSearchSelect}
      />

      <SettingsDialog
        open={settingsOpen || isSettingsPreview}
        onOpenChange={setSettingsOpen}
        user={user}
        onSignOut={stableLogout}
        onAllChatsDeleted={stableOnAllChatsDeleted}
        onOpenConversation={stableOnOpenArchivedConversation}
        onAccountDeleted={stableOnAccountDeleted}
      />
      <WorkspacePanel
        open={isWorkspaceDeletePreview}
        onOpenChange={stableWorkspaceOnOpenChange}
        initialSection="files"
        activeConversationId={activeConversationId}
        initialDeletePreview={isWorkspaceDeletePreview}
      />
      <ShareConversationDialog
        open={Boolean(shareTarget) || isSharePreview}
        onOpenChange={stableShareOnOpenChange}
        title={shareTarget?.title ?? "your conversation"}
        shareUrl={
          shareTarget?.shareToken
            ? conversationShareUrl(shareTarget.shareToken)
            : ""
        }
        email={shareEmail}
        onEmailChange={setShareEmail}
        onCopy={stableShareOnCopy}
        onEmail={stableShareOnEmail}
        onSetPublic={stableShareOnSetPublic}
        enabled={Boolean(shareTarget) && !publicShareMutation.isPending}
        isPublic={Boolean(shareTarget?.isPublic)}
      />
      <KsemoTextDialog
        open={Boolean(renameTarget) || isRenamePreview}
        onOpenChange={stableRenameDialogOpen}
        title="Rename conversation"
        description="Choose a clear title that helps you find this conversation later."
        label="Conversation title"
        value={isRenamePreview ? "Project planning" : renameValue}
        onValueChange={setRenameValue}
        actionLabel="Save name"
        onAction={stableRenameAction}
      />
      <KsemoTextDialog
        open={Boolean(editingMessage) || isEditPreview}
        onOpenChange={stableEditDialogOpen}
        title="Edit message"
        description="Your earlier version stays safely recorded. Saving updates the following KSEMO response from this exact edited message."
        label="Message"
        value={
          isEditPreview ? "Can you make this answer more concise?" : editValue
        }
        onValueChange={setEditValue}
        multiline
        actionLabel="Save"
        onAction={stableEditAction}
        secondaryActionLabel={
          editingMessage ? "View version history" : undefined
        }
        onSecondaryAction={stableEditSecondaryAction}
      />
      <MessageHistoryDialog
        open={Boolean(historyMessage) || isHistoryPreview}
        onOpenChange={stableHistoryOpen}
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
        onRestore={stableRestoreMessageVersion}
      />
      <ConfirmDeleteDialog
        open={Boolean(deleteTarget) || isDeletePreview}
        onOpenChange={stableDeleteDialogOpen}
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
        confirmLabel="Delete"
        onConfirm={stableDeleteAction}
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

const EmptyState = memo(function EmptyState({
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
});

const KsemoTextDialog = memo(function KsemoTextDialog({
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
});

const MessageHistoryDialog = memo(function MessageHistoryDialog({
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
});
