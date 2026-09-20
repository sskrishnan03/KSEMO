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
  ChevronsRight,
  FolderOpen,
  LogIn,
  MoreHorizontal,
  Pin,
  Trash2,
  UserPlus,
} from "lucide-react";
import { ShareIcon, TemporaryChatIcon } from "../components/ksemo/icons";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import React, {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { memo } from "react";
import { useLocation } from "wouter";
import { ChatComposer } from "../components/ksemo/ChatComposer";
import {
  ChatFilesDialog,
  type ChatFile,
} from "../components/ksemo/ChatFilesDialog";
import {
  FileCreationCard,
  type FileCreationStage,
  type FileMetrics,
  type FileSource,
} from "../components/ksemo/FileCreationCard";
import { PdfDrawer } from "../components/ksemo/PdfDrawer";
import type { DocFormat } from "@/lib/docFormats";
import { usePdfViewer } from "@/contexts/PdfViewerContext";
import AuthStage from "./AuthStage";
import { ConversationSidebar } from "../components/ksemo/ConversationSidebar";
import {
  MessageContent,
  type KsemoMessage,
} from "../components/ksemo/MessageContent";
import { getAuthHeaders } from "@/lib/authHeaders";
import { toast } from "sonner";
import { detectFileRequest } from "@shared/docDetect";

import { SettingsDialog } from "../components/ksemo/SettingsDialog";
import { SignInPrompt } from "../components/ksemo/SignInPrompt";
import { setGuestModeActive } from "@/lib/guestMode";
import { useGlobalShortcuts } from "../hooks/useGlobalShortcuts";
import { useIsMobile } from "../hooks/useIsMobile";
import { useVisualViewportHeight } from "../hooks/useVisualViewportHeight";
import { ShareConversationDialog } from "../components/ksemo/ShareConversationDialog";
import { ConfirmDeleteDialog } from "../components/ksemo/ConfirmDeleteDialog";
import { useVoiceInput } from "../hooks/useVoiceInput";
import { usePersistFn } from "../hooks/usePersistFn";
import { WorkspacePanel } from "../components/ksemo/WorkspacePanel";
import { LibraryWorkspace } from "../components/ksemo/LibraryWorkspace";
import { VoiceChat } from "../components/voice/VoiceChat";
import { SearchWorkspace } from "../components/ksemo/PremiumSearch";
import {
  createConversationPdfFile,
  createConversationWordFile,
} from "../lib/conversationExport";
import { createPublicConversationUrl } from "../lib/ksemoInteraction";
import { saveEditedUserMessageAndRegenerate } from "../lib/editRegeneration";
import { buildStreamingDrafts } from "../lib/streamingDrafts";
import { type CapabilityMode } from "@shared/capabilities";
import {
  DEFAULT_PRESENTATION_CONFIG,
  type PresentationConfig,
} from "@shared/presentation";
import {
  isPptOutlinePlan,
  type PptOutlinePlan,
} from "@shared/presentationOutline";
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

// When the user stops a document pipeline mid-run, the backend still finishes
// the file and attaches it to the message. Poll briefly so the standard file
// card can take over instead of leaving a frozen "creating…" dropdown.
const FILE_RECOVERY_POLL_INTERVAL_MS = 1000;
const FILE_RECOVERY_POLL_MAX_ATTEMPTS = 12;

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

// Temporary ("incognito") chats are session-scoped, but a same-tab refresh
// (F5 / back-forward) must not silently drop the user back into a normal chat.
// The mode, the active temporary conversation, and its conversation ids are
// remembered so a reload reopens the exact same thread. A fresh tab/session,
// "New Chat", or opening a saved conversation always ends temporary mode.
type StoredTemporaryChat = {
  active: boolean;
  activeConversationId: string | null;
  ids: string[];
};

function temporaryChatStorageKey(userId: string | number): string {
  return `ksemo-temporary-chat:${String(userId)}`;
}

function readStoredTemporaryChat(userId: string | number): StoredTemporaryChat {
  try {
    const raw = localStorage.getItem(temporaryChatStorageKey(userId));
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<StoredTemporaryChat>;
      return {
        active: parsed.active === true,
        activeConversationId:
          typeof parsed.activeConversationId === "string"
            ? parsed.activeConversationId
            : null,
        ids: Array.isArray(parsed.ids)
          ? parsed.ids.filter((id): id is string => typeof id === "string")
          : [],
      };
    }
  } catch {}
  return { active: false, activeConversationId: null, ids: [] };
}

function writeStoredTemporaryChat(
  userId: string | number | undefined,
  state: StoredTemporaryChat
): void {
  if (userId == null) return;
  try {
    if (!state.active) {
      localStorage.removeItem(temporaryChatStorageKey(userId));
      return;
    }
    localStorage.setItem(
      temporaryChatStorageKey(userId),
      JSON.stringify(state)
    );
  } catch {}
}

// Distinguishes a refresh of the same tab (F5/reload, back/forward) from a
// fresh open of the app (new tab / new session). A reload reuses the current
// tab and its in-memory/storage session, so the last conversation can be
// restored. A fresh open always starts on a blank new chat.
function isSameTabReload(): boolean {
  try {
    const entries = performance.getEntriesByType("navigation");
    if (entries.length) {
      const type = (entries[0] as PerformanceNavigationTiming).type;
      return type === "reload" || type === "back_forward";
    }
  } catch {}
  try {
    // Legacy fallback: 0 = navigate, 1 = reload, 2 = back/forward.
    const type = (
      performance as unknown as {
        navigation?: { type?: number };
      }
    ).navigation?.type;
    return type === 1 || type === 2;
  } catch {}
  return false;
}

export default function Home() {
  const isMobile = useIsMobile();
  const visualViewportHeight = useVisualViewportHeight();
  const { user, loading, authUnavailable, refresh, logout } = useAuth();
  const { closePdf, isOpen: isDocumentOpen } = usePdfViewer();
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
  const [isTemporaryChat, setIsTemporaryChat] = useState(false);
  // Mirrors isTemporaryChat for use inside async stream callbacks, where the
  // captured state may be stale. Tracks which server conversations belong to
  // the current temporary session so they can be purged when it ends.
  const isTemporaryChatRef = useRef(false);
  const temporaryConversationIdsRef = useRef<Set<string>>(new Set());
  const [chatMessages, setChatMessages] = useState<KsemoMessage[]>([]);
  // Guest ("signed-out") mode state. Guests keep the same Home screen, but
  // sending a message (or opening any locked feature) asks them to sign in via
  // a dismissible card in the bottom-right corner.
  const guestMode = !user;
  // Mirror the guest state into the module flag used by main.tsx: while a
  // signed-out visitor is on Home, a stray 401 from a leftover cached query
  // must NOT bounce them to the sign-in screen. (Previously this flag was
  // never set, so right after signing out the app yanked the user back to
  // login — and an auto-login provider instantly signed them in again.)
  useEffect(() => {
    setGuestModeActive(guestMode);
  }, [guestMode]);
  const [guestPromptOpen, setGuestPromptOpen] = useState(false);
  const [composerValue, setComposerValue] = useState("");
  const [composerFocusToken, setComposerFocusToken] = useState(0);
  const requestComposerFocus = useCallback(() => {
    setComposerFocusToken(t => t + 1);
  }, []);
  const [attachmentNotices, setAttachmentNotices] = useState<
    SelectedAttachment[]
  >([]);
  const [fileGeneration, setFileGeneration] = useState<{
    messageId: string;
    stage: string;
    format: string;
    status: "processing" | "created" | "error";
    createdAt: number;
    message?: string;
    researchSourceCount?: number;
    sources?: FileSource[];
    metrics?: FileMetrics;
    summary?: string;
    fileId?: string;
    outline?: PptOutlinePlan;
    code?: string;
  } | null>(null);
  const [outlineGenerating, setOutlineGenerating] = useState(false);
  const [outlineRegenError, setOutlineRegenError] = useState<string | null>(
    null
  );
  const outlineGeneratingRef = useRef(false);
  const [activeMode, setActiveMode] = useState<CapabilityMode>("chat");
  const [pptConfig, setPptConfig] = useState<PresentationConfig>({
    ...DEFAULT_PRESENTATION_CONFIG,
  });
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsInitialTab, setSettingsInitialTab] = useState<
    "account" | "security" | "appearance" | "data" | "memory" | "feedback"
  >("account");
  const [speakingMessageId, setSpeakingMessageId] = useState<string | null>(
    null
  );
  const [speechState, setSpeechState] = useState<"idle" | "playing" | "paused">(
    "idle"
  );
  const [primaryWorkspace, setPrimaryWorkspace] = useState<
    "library" | "search" | null
  >(() => inlineWorkspaceSection);
  const [chatFilesOpen, setChatFilesOpen] = useState(false);
  const [voiceChatOpen, setVoiceChatOpen] = useState(false);
  const activePrimaryWorkspace = primaryWorkspace;
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
  const savedComposerDraftRef = useRef("");
  const [editValue, setEditValue] = useState("");
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
  // State mirror of seededConversationIdRef so rendering can tell whether the
  // currently-viewed conversation has been loaded yet (prevents the empty
  // "new chat" screen from flashing while switching between saved chats).
  const [seededConversationId, setSeededConversationId] = useState<
    string | null
  >(null);
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

  // -------------------------------------------------------------------
  // MODE SEPARATION: Normal Chat vs File Creation
  // -------------------------------------------------------------------
  // activeMode is a derived state — never set directly. It reflects whether
  // the user currently has a file type armed via the Create File UI.
  // "chat" = Normal Chat Mode (activeMode is "chat")
  // File creation modes (activeMode is one of the file format modes)
  // isFileGenerating: true only when in File Creation Mode AND the current
  // stream is actively producing file-generation progress for the viewed
  // conversation. This is completely separate from isGenerating (which is
  // true for both chat and file streams).
  const isFileGenerating = Boolean(
    fileGeneration &&
    fileGeneration.status === "processing" &&
    activeStream &&
    fileGeneration.messageId === generatingMessageId
  );
  // isChatGenerating: true only when a stream is active but we are NOT in
  // file generation — i.e. the normal typing/streaming UI should appear.
  const isChatGenerating = isGenerating && !isFileGenerating;

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
  // While the user is switching between saved conversations, the server data
  // loads instantly from the cache but the seed effect still needs one frame
  // to call setChatMessages. Show a small loader instead of the empty "new
  // chat" greeting so nothing flashes.
  const isPendingSeed = Boolean(
    activeConversationId &&
    seededConversationId !== activeConversationId &&
    !activeQuery.isError
  );
  const activeConversation = useMemo(() => {
    if (!activeConversationId) return null;
    const fromActive = activeQuery.data?.conversation;
    if (fromActive) return fromActive;
    const fromList = conversationQuery.data?.find(
      c => c.id === activeConversationId
    );
    if (fromList) {
      return {
        id: fromList.id,
        title: fromList.title,
        isPinned: fromList.isPinned,
        isArchived: fromList.isArchived,
        isPublic: fromList.isPublic,
        shareToken: fromList.shareToken,
      };
    }
    return {
      id: activeConversationId,
      title: "Chat",
      isPinned: false,
      isArchived: false,
    };
  }, [
    activeConversationId,
    activeQuery.data?.conversation,
    conversationQuery.data,
  ]);
  const preferencesQuery = trpc.preferences.get.useQuery(undefined, {
    enabled: Boolean(user),
  });
  const libraryFilesQuery = trpc.workspace.files.list.useQuery(undefined, {
    enabled: Boolean(user),
  });
  const preferenceMutation = trpc.preferences.update.useMutation({
    onSuccess: () => {
      utils.preferences.get.invalidate();
      setSettingsOpen(false);
    },
    onError: () => {},
  });
  const voicePreferencesMutation = trpc.preferences.update.useMutation({
    onSuccess: () => {
      utils.preferences.get.invalidate();
    },
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
    setSeededConversationId(null);
    initialSelectionUserIdRef.current = null;
    setChatMessages([]);
    setActiveConversationId(null);
    activeConversationIdRef.current = null;
    setAttachmentNotices([]);
    isTemporaryChatRef.current = false;
    setIsTemporaryChat(false);
    temporaryConversationIdsRef.current.clear();
    setGuestPromptOpen(false);
    setSettingsOpen(false);
  }, [user]);

  // Mirror guest mode into the global flag so main.tsx can suppress the
  // auto-redirect-to-login that 401 responses would otherwise trigger.
  useEffect(() => {
    setGuestModeActive(guestMode);
    return () => setGuestModeActive(false);
  }, [guestMode]);
  const renameMutation = trpc.conversation.rename.useMutation({
    onSuccess: () => utils.conversation.list.invalidate(),
  });
  const archiveMutation = trpc.conversation.setArchived.useMutation({
    onSuccess: () => {
      utils.conversation.list.invalidate();
    },
  });
  const pinMutation = trpc.conversation.setPinned.useMutation({
    onSuccess: () => {
      utils.conversation.list.invalidate();
      if (activeConversationId) {
        utils.conversation.get.invalidate({ id: activeConversationId });
      }
    },
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
      },
      onError: () => {},
    });
  const permanentDeleteMutation = trpc.conversation.remove.useMutation({
    onSuccess: () => {
      utils.conversation.list.invalidate();
    },
  });
  // Hard-delete every conversation created during the temporary session. These
  // are already hidden from all listings on the server; this removes the rows.
  // Uses the vanilla client so it is also safe to call from an unmount cleanup.
  const purgeTemporaryConversations = () => {
    const ids = Array.from(temporaryConversationIdsRef.current);
    if (ids.length === 0) return;
    temporaryConversationIdsRef.current.clear();
    for (const id of ids) {
      utils.client.conversation.remove.mutate({ id });
    }
  };
  // Best-effort cleanup if the user navigates away mid-session.
  useEffect(() => {
    return () => purgeTemporaryConversations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const messageEditMutation = trpc.message.edit.useMutation({
    onSuccess: (_, variables) => {
      if (activeConversationId)
        utils.conversation.get.invalidate({ id: activeConversationId });
    },
    onError: () => {},
  });
  const messageFeedbackMutation = trpc.message.feedback.useMutation({
    onSuccess: () => {},
    onError: () => {},
  });
  const messageRemoveMutation = trpc.message.remove.useMutation({
    onSuccess: () => {
      if (activeConversationId)
        utils.conversation.get.invalidate({ id: activeConversationId });
    },
    onError: () => {},
  });
  const composerFileUpload = trpc.workspace.files.upload.useMutation();
  const composerFileAttach =
    trpc.workspace.files.attachToConversation.useMutation();
  const regenerateOutlineMutation =
    trpc.fileGeneration.regenerateOutline.useMutation();
  const regenerateSlideMutation =
    trpc.fileGeneration.regenerateSlide.useMutation();
  const voice = useVoiceInput({
    onTranscript: text =>
      setComposerValue(current => (current ? `${current} ${text}` : text)),
    onError: () => {},
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
    if (activeQuery.data.conversation?.id !== activeConversationId) return;
    seededConversationIdRef.current = activeConversationId;
    setSeededConversationId(activeConversationId);
    // The conversation's full history is about to render into an empty thread,
    // so the next scroll must snap to the newest message rather than animate.
    pendingOpenScrollRef.current = true;
    isNearBottomRef.current = true;
    const serverMessages = activeQuery.data.messages.map(message => {
      const firstAttachment = message.attachments?.[0] as any;
      const rawExt = firstAttachment?.filename
        ? (firstAttachment.filename.split(".").pop() ?? "").toLowerCase()
        : "";
      const format = rawExt === "md" ? "markdown" : rawExt;
      const hasGeneratedFile =
        (message as Record<string, unknown>).fileGeneration !== undefined ||
        (message.role === "assistant" &&
          (message.status === "completed" || message.status === "cancelled") &&
          (message.attachments ?? []).length > 0);
      const fileGeneration = (message as Record<string, unknown>)
        .fileGeneration as
        | {
            stage: string;
            format: string;
            status: "processing" | "created" | "error";
            message?: string;
            researchSourceCount?: number;
            sources?: FileSource[];
            metrics?: FileMetrics;
            code?: string;
          }
        | undefined;

      const metadata = (message as Record<string, unknown>).metadata as
        { pptOutline?: { outline?: unknown } } | undefined;
      const restoredOutline = isPptOutlinePlan(metadata?.pptOutline?.outline)
        ? (metadata!.pptOutline!.outline as PptOutlinePlan)
        : undefined;

      let persistedSources: FileSource[] | undefined = fileGeneration?.sources;
      let persistedMetrics: FileMetrics | undefined = fileGeneration?.metrics;
      let persistedFormat: string | undefined = fileGeneration?.format;
      let persistedCode: string | undefined = fileGeneration?.code;

      if (
        firstAttachment?.metadata &&
        typeof firstAttachment.metadata === "object"
      ) {
        if (
          Array.isArray(firstAttachment.metadata.sources) &&
          firstAttachment.metadata.sources.length > 0
        ) {
          persistedSources = firstAttachment.metadata.sources;
        }
        if (firstAttachment.metadata.metrics) {
          persistedMetrics = firstAttachment.metadata.metrics;
        }
        if (firstAttachment.metadata.format) {
          persistedFormat = firstAttachment.metadata.format;
        }
        if (typeof (firstAttachment.metadata as any).code === "string") {
          persistedCode = (firstAttachment.metadata as any).code;
        }
      } else if (
        firstAttachment?.contentText &&
        typeof firstAttachment.contentText === "string"
      ) {
        try {
          const parsed = JSON.parse(firstAttachment.contentText);
          if (parsed && typeof parsed === "object") {
            if (Array.isArray(parsed.sources) && parsed.sources.length > 0) {
              persistedSources = parsed.sources;
            }
            if (parsed.metrics) {
              persistedMetrics = parsed.metrics;
            }
            if (parsed.format) {
              persistedFormat = parsed.format;
            }
            if (typeof parsed.code === "string") {
              persistedCode = parsed.code;
            }
          }
        } catch {}
      }

      return {
        id: message.id,
        role: message.role,
        content:
          message.status === "cancelled" &&
          /^I[’']m sorry, I couldn[’']t generate a response\.?$/i.test(
            message.content.trim()
          )
            ? ""
            : message.content,
        status: message.status,
        attachments: message.attachments,
        // Rebuild completed fileGeneration with durable sources and metrics restored from attachment metadata
        fileGeneration:
          fileGeneration ??
          (hasGeneratedFile
            ? {
                stage: "completed",
                format:
                  (persistedFormat as DocFormat) ||
                  (format as DocFormat) ||
                  "pdf",
                status: "created" as const,
                sources: persistedSources,
                metrics: persistedMetrics,
                code: persistedCode,
              }
            : restoredOutline
              ? {
                  stage: "outline",
                  format: "pptx",
                  status: "processing" as const,
                  message: "Outline ready — review & approve",
                  outline: restoredOutline,
                }
              : undefined),
      };
    });
    setChatMessages(current => {
      if (!current.length) return serverMessages;
      const serverIds = new Set(serverMessages.map(message => message.id));
      const previousById = new Map(
        current.map(message => [message.id, message])
      );
      const mergedMessages = serverMessages.map(message => {
        // Keep the live file card on screen while the server record for an
        // interrupted document pipeline is still settling. The backend only
        // marks the message cancelled-with-file once the pipeline finishes,
        // so without this the drafting/completed card would flicker away.
        if (message.status === "streaming" && !message.fileGeneration) {
          const previousFileGeneration = previousById.get(
            message.id
          )?.fileGeneration;
          if (previousFileGeneration) {
            return { ...message, fileGeneration: previousFileGeneration };
          }
        }
        return message;
      });
      const localStreaming = current.filter(
        message =>
          message.status === "streaming" &&
          message.id.startsWith("local-") &&
          !serverIds.has(message.id)
      );
      if (!localStreaming.length) return mergedMessages;
      return [...mergedMessages, ...localStreaming];
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

  // Restore the temporary ("incognito") session across a same-tab refresh so a
  // reload reopens the same thread instead of silently bouncing the user back
  // into a normal chat. Only a genuine reload (F5 / back-forward) restores it;
  // a fresh open has the stored flag cleared by whichever branch runs below
  // while "New Chat" and saved-conversation selection already clear it.
  useEffect(() => {
    if (user?.id == null) return;
    const userId = user.id;
    if (isSameTabReload()) {
      const stored = readStoredTemporaryChat(userId);
      isTemporaryChatRef.current = stored.active;
      setIsTemporaryChat(stored.active);
      temporaryConversationIdsRef.current = new Set(stored.ids);
      if (stored.active && stored.activeConversationId) {
        seededConversationIdRef.current = null;
        setSeededConversationId(null);
        setChatMessages([]);
        setActiveConversationId(stored.activeConversationId);
        activeConversationIdRef.current = stored.activeConversationId;
      }
    } else {
      isTemporaryChatRef.current = false;
      setIsTemporaryChat(false);
      temporaryConversationIdsRef.current.clear();
      writeStoredTemporaryChat(userId, {
        active: false,
        activeConversationId: null,
        ids: [],
      });
    }
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id || !conversationQuery.data) return;
    const userId = String(user.id);
    if (initialSelectionUserIdRef.current === userId) return;
    if (
      activeConversationId &&
      conversationQuery.data.some(item => item.id === activeConversationId)
    ) {
      initialSelectionUserIdRef.current = userId;
      requestComposerFocus();
      return;
    }
    initialSelectionUserIdRef.current = userId;
    if (isFreshChatPreview) return;
    if (sharedConversationId) {
      void utils.conversation.get
        .fetch({ id: sharedConversationId })
        .then(() => {
          setActiveConversationId(sharedConversationId);
          activeConversationIdRef.current = sharedConversationId;
          window.history.replaceState({}, "", window.location.pathname);
          requestComposerFocus();
        })
        .catch(() => {
          window.history.replaceState({}, "", window.location.pathname);
          if (conversationQuery.data.length) {
            setActiveConversationId(conversationQuery.data[0].id);
            activeConversationIdRef.current = conversationQuery.data[0].id;
          }
          requestComposerFocus();
        });
      return;
    }
    const stored = getStoredActiveConversationState(user.id);
    if (!isSameTabReload()) {
      // Fresh open (new tab / new session): always start on a blank New Chat.
      // Record the intent so a later reload of this tab stays fresh too.
      if (activeConversationId === null) rememberNewChatIntent(user.id);
      requestComposerFocus();
      return;
    }
    // Same-tab reload: restore where the user left off so a refresh doesn't
    // lose their place. A new-chat marker or no saved session keeps them on a
    // fresh new chat.
    if (stored.newChatIntent) {
      requestComposerFocus();
      return;
    }
    if (
      stored.conversationId &&
      conversationQuery.data.some(item => item.id === stored.conversationId)
    ) {
      setActiveConversationId(stored.conversationId);
      activeConversationIdRef.current = stored.conversationId;
      requestComposerFocus();
      return;
    }
    if (activeConversationId === null) rememberNewChatIntent(user.id);
    requestComposerFocus();
  }, [
    user?.id,
    activeConversationId,
    conversationQuery.data,
    isFreshChatPreview,
    sharedConversationId,
    utils.conversation.get,
    rememberNewChatIntent,
    requestComposerFocus,
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
      if (deltaFlushRafRef.current)
        cancelAnimationFrame(deltaFlushRafRef.current);
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
        let delta = deltas.get(message.id);
        if (
          delta === undefined &&
          message.role === "assistant" &&
          message.status === "streaming" &&
          deltas.size === 1
        ) {
          delta = deltas.values().next().value;
        }
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
    if (!user) {
      setGuestPromptOpen(true);
      return;
    }
    const conversationId = activeConversationId;
    // Snapshot the temporary flag at send time: the toggle may change while the
    // stream is in flight.
    const temporary = isTemporaryChatRef.current;
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
    // Resolve mode: either explicit activeMode from UI or auto-detected from natural language query
    const detected = detectFileRequest(content);
    const resolvedMode =
      activeMode !== "chat"
        ? activeMode
        : detected.isFileRequest && detected.format
          ? detected.format
          : null;

    // In file creation mode the backend runs the document pipeline,
    // so seed the generation card immediately on the optimistic assistant draft.
    if (resolvedMode) {
      for (const message of drafts) {
        if (message.role === "assistant" && message.status === "streaming") {
          message.fileGeneration = {
            stage: "analyzing",
            format: resolvedMode,
            status: "processing" as const,
          };
        }
      }
    }
    setChatMessages(drafts);
    setFileGeneration(null);
    // The selected format is intentionally NOT cleared here: it persists in the
    // chat input so the user can create multiple files in a row. It only clears
    // when the user presses Cancel on the format chip (onDocumentFormatChange(null)).
    if (selectedAttachments.length) setAttachmentNotices([]);
    const controller = new AbortController();
    const turnSequence = ++generationSequenceRef.current;
    const streamEntry = {
      turnId: turnSequence,
      conversationId,
      userMessageId: null as string | null,
      assistantMessageId:
        options.regenerateAssistantMessageId ?? `local-assistant-${draftNow}`,
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
      const authHeaders = getAuthHeaders();
      const response = await fetch("/api/chat/stream", {
        method: "POST",
        credentials: "include",
        signal: controller.signal,
        headers: {
          "content-type": "application/json",
          accept: "text/event-stream",
          ...authHeaders,
        },
        body: JSON.stringify({
          conversationId: conversationId ?? undefined,
          content,
          regenerateAssistantMessageId: options.regenerateAssistantMessageId,
          attachmentFileIds: selectedAttachments.length
            ? selectedAttachments.map(file => file.fileId)
            : undefined,
          mode: resolvedMode ?? "chat",
          activeMode: resolvedMode ?? "chat",
          ...(temporary ? { temporary: true } : {}),
          ...(resolvedMode === "pptx"
            ? {
                pptConfig,
                pptStyle:
                  pptConfig.visualStyle !== "auto"
                    ? pptConfig.visualStyle
                    : undefined,
              }
            : {}),
        }),
      });
      if (!response.ok || !response.body) {
        let serverError = "";
        try {
          const errData = await response.json();
          serverError = errData?.error || "";
        } catch {}
        throw new Error(
          serverError || "The response stream could not be started."
        );
      }
      // A PPT is being created now: reset the slides/style so the next PPT
      // always starts fresh from the defaults instead of reusing this one.
      if (resolvedMode === "pptx") {
        setPptConfig({ ...DEFAULT_PRESENTATION_CONFIG });
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
            if (temporary) {
              // Remember this conversation so it can be purged when the
              // temporary session ends. Never surface it in recents/history.
              temporaryConversationIdsRef.current.add(conv.conversationId);
              // Persist the temporary session across a same-tab refresh so a
              // reload reopens the exact same thread instead of bouncing back
              // to a normal chat.
              writeStoredTemporaryChat(user?.id, {
                active: true,
                activeConversationId: conv.conversationId,
                ids: Array.from(temporaryConversationIdsRef.current),
              });
            }
            if (wasViewing) {
              // Stay on this (fresh) conversation so the optimistic drafts keep
              // rendering here with their real server ids.
              setActiveConversationId(conv.conversationId);
              activeConversationIdRef.current = conv.conversationId;
              if (user?.id && !temporary)
                storeActiveConversationId(user.id, conv.conversationId);
              // The local drafts below are authoritative, so the seed effect
              // must not overwrite them with a mid-stream database snapshot.
              seededConversationIdRef.current = conv.conversationId;
              setSeededConversationId(conv.conversationId);
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
            if (!temporary) utils.conversation.list.invalidate();
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
          } else if (eventName === "conversation.titleUpdated") {
            // Invalidate the conversation list and active conversation to refresh with the new title
            utils.conversation.list.invalidate();
            const updatedId = str(data.conversationId);
            if (updatedId) {
              utils.conversation.get.invalidate({ id: updatedId });
            }
          } else if (eventName === "assistant.error") {
            lastProgressAt = Date.now();
            errorMessage =
              str(data.message) || "KSEMO could not complete this response.";
          } else if (eventName === "file.progress") {
            lastProgressAt = Date.now();
            const progressStage = str(data.stage) || "analyzing";
            const progressMessage = str(data.message ?? "") || undefined;
            const researchSourceCount =
              typeof data.researchSourceCount === "number"
                ? data.researchSourceCount
                : undefined;
            const progressCode =
              typeof data.code === "string" ? data.code : undefined;
            setFileGeneration(current => {
              const progressFormat =
                str(data.format ?? "") || current?.format || "";
              return {
                messageId: str(data.messageId),
                stage: progressStage,
                format: progressFormat,
                status: "processing",
                createdAt: current?.createdAt ?? Date.now(),
                message: progressMessage,
                researchSourceCount:
                  researchSourceCount ?? current?.researchSourceCount,
                outline: current?.outline,
                code: progressCode ?? current?.code,
              };
            });
            if (isViewingThisStream()) {
              const progMsgId = str(data.messageId);
              const resolvedFormat = str(data.format ?? "");
              setChatMessages(current =>
                current.map(message =>
                  message.id === progMsgId
                    ? {
                        ...message,
                        fileGeneration: {
                          stage: progressStage,
                          format: resolvedFormat,
                          status: "processing" as const,
                          message: progressMessage,
                          researchSourceCount: researchSourceCount,
                          outline: message.fileGeneration?.outline,
                          code: progressCode ?? message.fileGeneration?.code,
                        },
                      }
                    : message
                )
              );
            }
          } else if (eventName === "file.outline") {
            lastProgressAt = Date.now();
            const outlineMessageId = str(data.messageId);
            const rawOutline = data.outline;
            if (outlineMessageId && isPptOutlinePlan(rawOutline)) {
              const outline = rawOutline;
              setFileGeneration(current => ({
                messageId: outlineMessageId,
                stage: "outline",
                format: "pptx",
                status: "processing",
                createdAt: current?.createdAt ?? Date.now(),
                message: "Outline ready — review & approve",
                researchSourceCount: current?.researchSourceCount,
                outline,
              }));
              if (isViewingThisStream()) {
                setChatMessages(current =>
                  current.map(message =>
                    message.id === outlineMessageId
                      ? {
                          ...message,
                          content: outline.summary || message.content,
                          fileGeneration: {
                            stage: "outline",
                            format: "pptx",
                            status: "processing" as const,
                            message: "Outline ready — review & approve",
                            outline,
                          },
                        }
                      : message
                  )
                );
              }
            }
          } else if (eventName === "file.error") {
            lastProgressAt = Date.now();
            setFileGeneration(current => ({
              messageId: str(data.messageId),
              stage: "error",
              format: current?.format || "",
              status: "error",
              createdAt: current?.createdAt ?? Date.now(),
            }));
            if (isViewingThisStream()) {
              const errorMsgId = str(data.messageId);
              setChatMessages(current =>
                current.map(message =>
                  message.id === errorMsgId
                    ? {
                        ...message,
                        fileGeneration: {
                          stage: "error",
                          format: fileGeneration?.format || "",
                          status: "error" as const,
                        },
                      }
                    : message
                )
              );
            }
          } else if (eventName === "file.created") {
            lastProgressAt = Date.now();
            const fileData = data.file as
              | {
                  fileId?: string;
                  filename?: string;
                  mimeType?: string;
                  url?: string;
                  sizeBytes?: number;
                  sources?: FileSource[];
                  metrics?: FileMetrics;
                  summary?: string;
                  code?: string;
                }
              | undefined;
            const fileSources = fileData?.sources?.length
              ? fileData.sources
              : undefined;
            const fileMetrics = fileData?.metrics;
            const fileSummary = fileData?.summary;
            const fileCode = fileData?.code;
            setFileGeneration(current => ({
              messageId: str(data.messageId),
              stage: "completed",
              format: current?.format || "",
              status: "created",
              createdAt: current?.createdAt ?? Date.now(),
              researchSourceCount: current?.researchSourceCount,
              sources: fileSources ?? current?.sources,
              metrics: fileMetrics ?? current?.metrics,
              summary: fileSummary ?? current?.summary,
              fileId: fileData?.fileId ?? current?.fileId,
              code: fileCode ?? current?.code,
            }));
            if (isViewingThisStream()) {
              const createdMsgId = str(data.messageId);
              setChatMessages(current =>
                current.map(message =>
                  message.id === createdMsgId
                    ? {
                        ...message,
                        fileGeneration: {
                          stage: "completed",
                          format: fileGeneration?.format || "",
                          status: "created" as const,
                          researchSourceCount:
                            fileGeneration?.researchSourceCount,
                          sources: fileSources ?? fileGeneration?.sources,
                          metrics: fileMetrics ?? fileGeneration?.metrics,
                          summary: fileSummary ?? fileGeneration?.summary,
                          code: fileCode ?? fileGeneration?.code,
                        },
                      }
                    : message
                )
              );
            }
            utils.workspace.files.list.invalidate();
            const assistantId = str(data.messageId);
            if (fileData?.fileId && isViewingThisStream()) {
              const currentFormat =
                (data.format as string) || fileGeneration?.format || "";
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
                            metadata: {
                              sources: fileSources,
                              metrics: fileMetrics,
                              format: currentFormat,
                            },
                            contentText: JSON.stringify({
                              sources: fileSources,
                              metrics: fileMetrics,
                              format: currentFormat,
                            }),
                          } as any,
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
      else if ((error as Error).name !== "AbortError") {
        const caught = (error as Error)?.message;
        errorMessage =
          errorMessage ??
          (caught && caught !== "The response stream could not be started."
            ? caught
            : "KSEMO could not start a response. Your message was kept.");
      }
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
        if (userStopped) {
          setChatMessages(current =>
            current.map(message =>
              message.role === "assistant" && message.status === "streaming"
                ? { ...message, content: "", status: "cancelled" }
                : message
            )
          );
          return;
        }
        setComposerValue(current => (current ? current : content));
        if (selectedAttachments.length) {
          setAttachmentNotices(selectedAttachments);
        }
        if (failureMessage) {
          toast.error(failureMessage);
        }
        if (
          options.regenerateAssistantMessageId ||
          options.replaceUserMessageId
        ) {
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
    }

    if (completedConversation) {
      // Refresh the caching query for this conversation so that returning to it
      // shows the finished response immediately (server has already settled it).
      await syncConversationFromServer(completedConversation.conversationId);

      // A user stop during document creation does not cancel the backend
      // pipeline — it still attaches the finished file to the message. Poll
      // quietly and swap the frozen drafting card to the standard file card
      // once the file lands (or show a clean stopped card if it never does).
      if (
        userStopped &&
        resolvedMode &&
        completedConversation.assistantMessageId
      ) {
        pollGeneratedFileRecovery(
          completedConversation.conversationId,
          completedConversation.assistantMessageId,
          resolvedMode
        );
      }

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

  // ── Presentation outline (two-phase pptx flow) ─────────────────────────
  // Phase 1 streams an editable outline into the chat. The user edits and
  // approves it here; approval POSTs to /api/chat/presentation/stream which
  // runs phase 2 (the actual .pptx render) and emits progress/file events.
  function findOutlinePrompt(messageId: string): string {
    const index = chatMessages.findIndex(message => message.id === messageId);
    for (let i = index - 1; i >= 0; i -= 1) {
      if (chatMessages[i].role === "user") {
        const text = chatMessages[i].content.trim();
        if (text) return text;
      }
    }
    return "";
  }

  function setMessageFileGeneration(
    messageId: string,
    updater: (
      previous: KsemoMessage["fileGeneration"]
    ) => KsemoMessage["fileGeneration"]
  ) {
    setChatMessages(current =>
      current.map(message =>
        message.id === messageId
          ? { ...message, fileGeneration: updater(message.fileGeneration) }
          : message
      )
    );
  }

  function applyOutlineToActive(messageId: string, outline: PptOutlinePlan) {
    setFileGeneration(current => ({
      messageId,
      stage: "outline",
      format: "pptx",
      status: "processing",
      createdAt:
        current && current.messageId === messageId
          ? current.createdAt
          : Date.now(),
      message: "Outline ready — review & approve",
      researchSourceCount:
        current && current.messageId === messageId
          ? current.researchSourceCount
          : undefined,
      outline,
    }));
    setMessageFileGeneration(messageId, () => ({
      stage: "outline",
      format: "pptx",
      status: "processing" as const,
      message: "Outline ready — review & approve",
      outline,
    }));
  }

  function handleOutlineChange(messageId: string, outline: PptOutlinePlan) {
    setFileGeneration(current =>
      current && current.messageId === messageId
        ? { ...current, outline }
        : current
    );
    setMessageFileGeneration(messageId, previous => ({
      stage: previous?.stage ?? "outline",
      format: previous?.format ?? "pptx",
      status: previous?.status ?? ("processing" as const),
      message: previous?.message,
      researchSourceCount: previous?.researchSourceCount,
      sources: previous?.sources,
      metrics: previous?.metrics,
      summary: previous?.summary,
      outline,
    }));
  }

  async function handleRegenerateOutline(
    messageId: string,
    currentOutline: PptOutlinePlan
  ): Promise<PptOutlinePlan | null> {
    setOutlineRegenError(null);
    try {
      const outline = await regenerateOutlineMutation.mutateAsync({
        assistantMessageId: messageId,
        prompt:
          findOutlinePrompt(messageId) ||
          currentOutline.title ||
          "Presentation",
        pptConfig: currentOutline.config as unknown as Record<string, unknown>,
        pptStyle: currentOutline.styleName,
      });
      if (!isPptOutlinePlan(outline)) return null;
      applyOutlineToActive(messageId, outline);
      return outline;
    } catch (error) {
      setOutlineRegenError(
        error instanceof Error
          ? error.message
          : "Could not regenerate the outline. Please try again."
      );
      return null;
    }
  }

  async function handleRegenerateSlide(
    messageId: string,
    slideId: string,
    currentOutline: PptOutlinePlan,
    instruction?: string
  ): Promise<PptOutlinePlan | null> {
    setOutlineRegenError(null);
    try {
      const updated = await regenerateSlideMutation.mutateAsync({
        assistantMessageId: messageId,
        slideId,
        outline: currentOutline as unknown,
        instruction: instruction?.trim() ? instruction.trim() : undefined,
      });
      if (!isPptOutlinePlan(updated)) return null;
      applyOutlineToActive(messageId, updated);
      return updated;
    } catch (error) {
      setOutlineRegenError(
        error instanceof Error
          ? error.message
          : "Could not regenerate that slide. Please try again."
      );
      return null;
    }
  }

  async function approvePresentationOutline(
    messageId: string,
    outline: PptOutlinePlan
  ) {
    const conversationId = activeConversationIdRef.current;
    if (!conversationId) {
      toast.error("This presentation needs a saved conversation.");
      return;
    }
    if (outlineGeneratingRef.current) return;
    outlineGeneratingRef.current = true;
    setOutlineGenerating(true);
    setOutlineRegenError(null);
    setFileGeneration(current => ({
      messageId,
      stage: "content_generated",
      format: "pptx",
      status: "processing",
      createdAt:
        current && current.messageId === messageId
          ? current.createdAt
          : Date.now(),
      message: "Writing the presentation",
      outline,
    }));
    setMessageFileGeneration(messageId, () => ({
      stage: "content_generated",
      format: "pptx",
      status: "processing" as const,
      message: "Writing the presentation",
      outline,
    }));

    try {
      const response = await fetch("/api/chat/presentation/stream", {
        method: "POST",
        credentials: "include",
        headers: {
          "content-type": "application/json",
          accept: "text/event-stream",
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          assistantMessageId: messageId,
          conversationId,
          outline,
        }),
      });
      if (!response.ok || !response.body) {
        let serverError = "";
        try {
          const errData = await response.json();
          serverError = errData?.error || "";
        } catch {}
        throw new Error(
          serverError || "Presentation generation could not be started."
        );
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let streamError: string | null = null;
      const str = (value: unknown): string =>
        typeof value === "string" ? value : "";

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

          if (eventName === "file.progress") {
            const stage = str(data.stage) || "generating";
            const label = str(data.message ?? "") || undefined;
            setFileGeneration(current =>
              current && current.messageId === messageId
                ? { ...current, stage, status: "processing", message: label }
                : current
            );
            setMessageFileGeneration(messageId, previous => ({
              stage,
              format: "pptx",
              status: "processing" as const,
              message: label,
              outline: previous?.outline ?? outline,
            }));
          } else if (eventName === "file.created") {
            const fileData = data.file as
              | {
                  fileId?: string;
                  filename?: string;
                  mimeType?: string;
                  url?: string;
                  sizeBytes?: number;
                  sources?: FileSource[];
                  metrics?: FileMetrics;
                  summary?: string;
                  code?: string;
                }
              | undefined;
            if (!fileData?.fileId || !fileData.url) {
              streamError = "Presentation file could not be created.";
              continue;
            }
            const sources = fileData.sources?.length
              ? fileData.sources
              : undefined;
            const resolvedFileId = fileData.fileId;
            const resolvedUrl = fileData.url;
            const resolvedCode = fileData.code;
            setFileGeneration(current => ({
              messageId,
              stage: "completed",
              format: "pptx",
              status: "created",
              createdAt: current?.createdAt ?? Date.now(),
              researchSourceCount: current?.researchSourceCount,
              sources,
              metrics: fileData.metrics,
              summary: fileData.summary,
              fileId: resolvedFileId,
              outline,
              code: resolvedCode ?? current?.code,
            }));
            setMessageFileGeneration(messageId, () => ({
              stage: "completed",
              format: "pptx",
              status: "created" as const,
              sources,
              metrics: fileData.metrics,
              summary: fileData.summary,
              code: resolvedCode,
            }));
            setChatMessages(current =>
              current.map(message =>
                message.id === messageId
                  ? {
                      ...message,
                      attachments: [
                        ...(message.attachments ?? []).filter(
                          attachment => attachment.id !== resolvedFileId
                        ),
                        {
                          id: resolvedFileId,
                          filename: fileData.filename ?? outline.filename,
                          mimeType: fileData.mimeType,
                          url: resolvedUrl,
                          sizeBytes: fileData.sizeBytes,
                        },
                      ],
                    }
                  : message
              )
            );
            utils.workspace.files.list.invalidate();
          } else if (eventName === "file.error") {
            streamError =
              str(data.message) || "Presentation generation failed.";
          } else if (eventName === "assistant.error") {
            streamError = str(data.message) || streamError;
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

      if (streamError) {
        setOutlineRegenError(streamError);
        toast.error(streamError);
        applyOutlineToActive(messageId, outline);
        setFileGeneration(current =>
          current && current.messageId === messageId
            ? { ...current, message: streamError ?? undefined }
            : current
        );
      }
    } catch (error) {
      const errorText =
        error instanceof Error
          ? error.message
          : "Presentation generation failed. Please try again.";
      setOutlineRegenError(errorText);
      toast.error(errorText);
      applyOutlineToActive(messageId, outline);
      setFileGeneration(current =>
        current && current.messageId === messageId
          ? { ...current, message: errorText }
          : current
      );
    } finally {
      outlineGeneratingRef.current = false;
      setOutlineGenerating(false);
      void syncConversationFromServer(conversationId);
    }
  }

  async function syncConversationFromServer(targetId: string) {
    const fresh = await withDeadline(
      utils.conversation.get.fetch({ id: targetId }),
      REFRESH_TIMEOUT_MS
    );
    return fresh !== null;
  }

  function settleInterruptedGeneration(
    assistantMessageId: string,
    format: string
  ) {
    setChatMessages(current =>
      current.map(message =>
        message.id === assistantMessageId
          ? {
              ...message,
              fileGeneration: {
                stage: "interrupted" as FileCreationStage,
                format: format as DocFormat,
                status: "error" as const,
              },
            }
          : message
      )
    );
    setFileGeneration(current =>
      current && current.messageId === assistantMessageId ? null : current
    );
  }

  function settleRecoveredFile(
    assistantMessageId: string,
    format: string,
    attachments: Record<string, unknown>[]
  ) {
    const firstAttachment = attachments[0] as
      | {
          id?: string;
          filename?: string;
          mimeType?: string;
          url?: string;
          sizeBytes?: number;
          metadata?: unknown;
          contentText?: string | null;
        }
      | undefined;
    let sources: FileSource[] | undefined;
    let metrics: FileMetrics | undefined;
    let resolvedFormat = format;
    if (
      firstAttachment?.metadata &&
      typeof firstAttachment.metadata === "object"
    ) {
      const meta = firstAttachment.metadata as {
        sources?: unknown;
        metrics?: unknown;
        format?: unknown;
      };
      if (Array.isArray(meta.sources) && meta.sources.length > 0) {
        sources = meta.sources as FileSource[];
      }
      if (meta.metrics && typeof meta.metrics === "object") {
        metrics = meta.metrics as FileMetrics;
      }
      if (typeof meta.format === "string") resolvedFormat = meta.format;
    } else if (firstAttachment?.contentText) {
      try {
        const parsed = JSON.parse(firstAttachment.contentText);
        if (parsed && typeof parsed === "object") {
          if (Array.isArray(parsed.sources) && parsed.sources.length > 0) {
            sources = parsed.sources;
          }
          if (parsed.metrics) metrics = parsed.metrics;
          if (typeof parsed.format === "string") resolvedFormat = parsed.format;
        }
      } catch {}
    }

    setChatMessages(current =>
      current.map(message =>
        message.id === assistantMessageId
          ? {
              ...message,
              fileGeneration: {
                stage: "completed",
                format: (resolvedFormat || format) as DocFormat,
                status: "created" as const,
                sources,
                metrics,
              },
              attachments: attachments as KsemoMessage["attachments"],
            }
          : message
      )
    );
    setFileGeneration(current =>
      current && current.messageId === assistantMessageId ? null : current
    );
    utils.workspace.files.list.invalidate();
  }

  function pollGeneratedFileRecovery(
    conversationId: string,
    assistantMessageId: string,
    format: string
  ) {
    let attempts = 0;
    let settled = false;
    const tick = async () => {
      if (settled) return;
      attempts += 1;
      try {
        const fresh = await utils.conversation.get.fetch({
          id: conversationId,
        });
        const target = fresh?.messages?.find(
          message => message.id === assistantMessageId
        );
        const attachments = (target?.attachments ?? []) as Record<
          string,
          unknown
        >[];
        if (attachments.length > 0) {
          settled = true;
          settleRecoveredFile(assistantMessageId, format, attachments);
          return;
        }
        if (attempts >= FILE_RECOVERY_POLL_MAX_ATTEMPTS) {
          settled = true;
          settleInterruptedGeneration(assistantMessageId, format);
          return;
        }
        window.setTimeout(tick, FILE_RECOVERY_POLL_INTERVAL_MS);
      } catch {
        if (attempts >= FILE_RECOVERY_POLL_MAX_ATTEMPTS) {
          settled = true;
          settleInterruptedGeneration(assistantMessageId, format);
        } else {
          window.setTimeout(tick, FILE_RECOVERY_POLL_INTERVAL_MS);
        }
      }
    };
    window.setTimeout(tick, FILE_RECOVERY_POLL_INTERVAL_MS);
  }

  function stopGeneration() {
    // Stop only the stream for the currently-viewed conversation; any other
    // conversations generating in the background are left untouched.
    // This cancels file generation operations.
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

    // Clear active mode when stopping generation
    setActiveMode("chat");
  }

  function newChat() {
    // Guest mode: New Chat simply resets the local thread and sign-in prompt.
    if (!user) {
      setGuestPromptOpen(false);
      setChatMessages([]);
      seededConversationIdRef.current = null;
      setSeededConversationId(null);
      isNearBottomRef.current = true;
      pendingOpenScrollRef.current = true;
      setActiveMode("chat");
      setComposerValue("");
      setAttachmentNotices([]);
      requestComposerFocus();
      return;
    }
    // Ending the view also ends any temporary session: purge its chats so
    // nothing lingers, and return to normal chat.
    purgeTemporaryConversations();
    isTemporaryChatRef.current = false;
    setIsTemporaryChat(false);
    writeStoredTemporaryChat(user?.id, {
      active: false,
      activeConversationId: null,
      ids: [],
    });
    // Starting a fresh chat aborts any stream targeting the current view so the
    // composer is free, but never touches background streams in other chats.
    closePdf();
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
    setSeededConversationId(null);
    isNearBottomRef.current = true;
    pendingOpenScrollRef.current = true;
    setChatMessages([]);
    setActiveConversationId(null);
    activeConversationIdRef.current = null;
    if (user?.id) rememberNewChatIntent(user.id);
    setPrimaryWorkspace(null);
    if (
      typeof window !== "undefined" &&
      window.location.search.includes("workspace=")
    ) {
      const next = new URL(window.location.href);
      next.searchParams.delete("workspace");
      window.history.replaceState(
        {},
        "",
        next.pathname + (next.search ? next.search : "")
      );
    }
    setAttachmentNotices([]);
    setActiveMode("chat");
    setEditingMessage(null);
    setComposerValue("");
    savedComposerDraftRef.current = "";
    window.speechSynthesis?.cancel();
    setSpeakingMessageId(null);
    setSpeechState("idle");
    setSidebarOpen(false);
    requestComposerFocus();
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
    } catch {}
  }

  function conversationShareUrl(token: string) {
    return createPublicConversationUrl(window.location.origin, token);
  }

  async function copyConversationShareLink() {
    if (!shareTarget?.shareToken) return;
    const url = conversationShareUrl(shareTarget.shareToken);
    try {
      await navigator.clipboard.writeText(url);
    } catch {}
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
    if (!editingMessage) {
      savedComposerDraftRef.current = composerValue;
    }
    setEditingMessage(message);
    setComposerValue(message.content);
  }

  function cancelEdit() {
    setEditingMessage(null);
    setComposerValue(savedComposerDraftRef.current);
    savedComposerDraftRef.current = "";
  }

  async function saveEditedMessage() {
    const message = editingMessage;
    const content = composerValue.trim();
    if (!message || !content) {
      cancelEdit();
      return;
    }
    if (content === message.content) {
      cancelEdit();
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
          setComposerValue(savedComposerDraftRef.current);
          savedComposerDraftRef.current = "";
          void sendMessage(editedContent, {
            regenerateAssistantMessageId: assistantMessageId,
            replaceUserMessageId: message.id,
          });
          return Promise.resolve();
        },
      });
      setEditingMessage(null);
      setComposerValue(savedComposerDraftRef.current);
      savedComposerDraftRef.current = "";
      setChatMessages(current =>
        current.map(item =>
          item.id === message.id ? { ...item, content } : item
        )
      );
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

  function resolveMimeType(file: File): string {
    if (file.type && file.type.trim()) return file.type;
    const ext = file.name.split(".").pop()?.toLowerCase() || "";
    const mimeMap: Record<string, string> = {
      pdf: "application/pdf",
      docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      doc: "application/msword",
      xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      xls: "application/vnd.ms-excel",
      pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      ppt: "application/vnd.ms-powerpoint",
      csv: "text/csv",
      tsv: "text/tab-separated-values",
      txt: "text/plain",
      md: "text/markdown",
      markdown: "text/markdown",
      json: "application/json",
      png: "image/png",
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      webp: "image/webp",
      gif: "image/gif",
      svg: "image/svg+xml",
      mp3: "audio/mp3",
      wav: "audio/wav",
      m4a: "audio/m4a",
      ogg: "audio/ogg",
      webm: "audio/webm",
      mp4: "video/mp4",
      mov: "video/quicktime",
      ts: "text/plain",
      tsx: "text/plain",
      js: "text/javascript",
      jsx: "text/javascript",
      py: "text/plain",
      sql: "text/plain",
      html: "text/html",
      css: "text/css",
      xml: "text/xml",
      yaml: "text/yaml",
      yml: "text/yaml",
    };
    return mimeMap[ext] || "application/octet-stream";
  }

  async function attachFromComposer(file: File) {
    if (!user) {
      toast.info("Sign in to attach files.");
      return;
    }
    if (file.size > 25 * 1024 * 1024) {
      toast.error(`"${file.name}" exceeds the 25MB limit.`);
      return;
    }
    const resolvedMime = resolveMimeType(file);
    if (hasDuplicateAttachment(attachmentNotices, file.name)) {
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
        mimeType: resolvedMime,
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
            mimeType: resolvedMime,
            url: uploaded.url,
            linked: true,
          },
        ]);
      } else {
        setAttachmentNotices(current => [
          ...current,
          {
            fileId: uploaded.id,
            name: file.name,
            mimeType: resolvedMime,
            url: uploaded.url,
            linked: false,
          },
        ]);
      }
    } catch (err) {
      console.error("[attachFromComposer] upload failed:", err);
      toast.error(`Failed to upload "${file.name}". Please try again.`);
    }
  }

  async function captureScreenshot() {
    if (!navigator.mediaDevices?.getDisplayMedia) {
      toast.info(
        "Screen capture is supported on desktop browsers. Use Take photo or upload files on mobile."
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
        return;
      }
      ctx.drawImage(video, 0, 0);
      video.srcObject = null;
      track.stop();
      const blob = await new Promise<Blob | null>(resolve =>
        canvas.toBlob(resolve, "image/png", 0.92)
      );
      if (!blob) {
        return;
      }
      const timestamp = Date.now();
      const file = new File([blob], `ksemo-screenshot-${timestamp}.png`, {
        type: "image/png",
      });
      await attachFromComposer(file);
    } catch (error: unknown) {
      if (stream) {
        for (const track of stream.getVideoTracks()) track.stop();
      }
      const name = error instanceof Error ? error.name : String(error);
      if (name === "NotAllowedError") return;
      if (name === "NotReadableError") {
        return;
      }
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
  }

  function selectConversation(id: string) {
    closePdf();
    setPrimaryWorkspace(null);
    setSidebarOpen(false);

    if (
      typeof window !== "undefined" &&
      window.location.search.includes("workspace=")
    ) {
      const next = new URL(window.location.href);
      next.searchParams.delete("workspace");
      window.history.replaceState(
        {},
        "",
        next.pathname + (next.search ? next.search : "")
      );
    }

    if (id === activeConversationId) {
      // Clicking the chat that is already open still jumps straight to the
      // newest message (e.g. after scrolling up to read older messages).
      if (chatMessages.length === 0 && activeQuery.data?.messages) {
        seededConversationIdRef.current = null;
        setSeededConversationId(null);
      }
      isNearBottomRef.current = true;
      scrollChatToEnd("auto");
      requestComposerFocus();
      return;
    }
    // Switching is always allowed, even while another conversation's response
    // is still streaming in the background. That stream keeps running and the
    // finished response is saved to its original conversation.
    // Selecting a saved conversation ends any temporary session: its chats are
    // tucked away (and purged) and this chat is a normal, persisted one.
    if (isTemporaryChatRef.current) {
      purgeTemporaryConversations();
      isTemporaryChatRef.current = false;
      setIsTemporaryChat(false);
      writeStoredTemporaryChat(user?.id, {
        active: false,
        activeConversationId: null,
        ids: [],
      });
    }
    setChatMessages([]);
    seededConversationIdRef.current = null;
    setSeededConversationId(null);
    isNearBottomRef.current = true;
    pendingOpenScrollRef.current = true;
    setActiveConversationId(id);
    activeConversationIdRef.current = id;
    if (user?.id) storeActiveConversationId(user.id, id);
    setAttachmentNotices([]);
    setEditingMessage(null);
    savedComposerDraftRef.current = "";
    requestComposerFocus();
  }

  function speak(text: string, messageId: string) {
    if (!("speechSynthesis" in window)) {
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
  const stableComposerSend = usePersistFn(
    (content: string) => void sendMessage(content)
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
  const stableVoiceAction = usePersistFn(
    voice.state === "recording" ? voice.stop : voice.start
  );
  const stableVoiceCancel = usePersistFn(voice.cancel);
  const stableOpenVoiceChat = usePersistFn(() => {
    if (isTemporaryChatRef.current) return;
    setVoiceChatOpen(true);
  });
  const stableCloseVoiceChat = usePersistFn(() => {
    setVoiceChatOpen(false);
    if (activeConversationId) {
      // Spoken turns stream straight to the server, so the open chat must
      // re-seed from the database for the exchange to read as a normal chat.
      seededConversationIdRef.current = null;
      setSeededConversationId(null);
      void utils.conversation.get.refetch({ id: activeConversationId });
    }
    utils.conversation.list.invalidate();
  });
  const stableOnFeedback = usePersistFn(
    (messageId: string, value: "up" | "down") =>
      messageFeedbackMutation.mutate({ messageId, value })
  );
  const stableOnClearAttachment = usePersistFn((fileId?: string) =>
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
  const stableRenameSubmit = usePersistFn((id: string, title: string) => {
    renameMutation.mutate({ id, title });
  });
  const stableOnArchive = usePersistFn((conversation: { id: string }) =>
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
  const stableOnLoginPrompt = usePersistFn(() => setGuestPromptOpen(true));
  const stableOnSearch = usePersistFn(() => {
    if (guestMode) {
      setGuestPromptOpen(true);
      return;
    }
    closePdf();
    setPrimaryWorkspace("search");
    setSidebarOpen(false);
  });
  const stableOnWorkspace = usePersistFn((_section: "files") => {
    if (guestMode) {
      setGuestPromptOpen(true);
      return;
    }
    closePdf();
    setPrimaryWorkspace("library");
    setSidebarOpen(false);
  });
  const stableCloseWorkspace = usePersistFn(() => {
    setPrimaryWorkspace(null);
    if (
      typeof window !== "undefined" &&
      window.location.search.includes("workspace=")
    ) {
      const next = new URL(window.location.href);
      next.searchParams.delete("workspace");
      window.history.replaceState(
        {},
        "",
        next.pathname + (next.search ? next.search : "")
      );
    }
  });
  const stableOnSettings = usePersistFn(() => {
    if (guestMode) {
      setGuestPromptOpen(true);
      return;
    }
    setSettingsOpen(true);
    setSidebarOpen(false);
  });

  useEffect(() => {
    if (!activePrimaryWorkspace) return;
    if (isDocumentOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        stableCloseWorkspace();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activePrimaryWorkspace, stableCloseWorkspace, isDocumentOpen]);

  useGlobalShortcuts({
    onNewChat: stableNewChat,
    onToggleSidebar: () => {
      if (typeof window !== "undefined" && window.innerWidth < 768) {
        setSidebarOpen(prev => !prev);
      } else {
        stableOnToggleCollapsed();
      }
    },
    onOpenSettings: tab => {
      if (guestMode) {
        setGuestPromptOpen(true);
        return;
      }
      if (tab) setSettingsInitialTab(tab as any);
      setSettingsOpen(true);
    },
    onModeChange: guestMode ? undefined : mode => setActiveMode(mode),
    focusTargetId: "ksemo-composer-textarea",
  });
  const stableOnSupport = usePersistFn((topic: "faq" | "privacy" | "terms") => {
    setSidebarOpen(false);
    setLocation(`/support/${topic}`);
  });
  const stableOnSearchSelect = usePersistFn((id: string) => {
    selectConversation(id);
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
    // Clear every auth storage key up-front so there is no window where a
    // stale token could re-authenticate the user between now and logout().
    try {
      localStorage.removeItem("ksemo-user-info");
      localStorage.removeItem("ksemo-token");
      localStorage.removeItem("ksemo-cookie");
      sessionStorage.removeItem("ksemo-token");
      sessionStorage.removeItem("ksemo-cookie");
    } catch {}
    void logout();
  });
  const stableShareOnOpenChange = usePersistFn((next: boolean) => {
    if (!next) setShareTarget(null);
  });
  const stableShareOnCopy = usePersistFn(
    () => void copyConversationShareLink()
  );
  const stableShareOnEmail = usePersistFn(openEmailShare);
  const stableShareOnSetPublic = usePersistFn((isPublic: boolean) => {
    if (shareTarget)
      publicShareMutation.mutate({ id: shareTarget.id, isPublic });
  });
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
  const stableCancelEdit = usePersistFn(cancelEdit);
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

  const stableVoiceSpeechRate = usePersistFn((rate: number) => {
    voicePreferencesMutation.mutate({ speechRate: rate });
  });

  const renderComposer = (
    options: {
      hideVoiceInput?: boolean;
      menuPlacement?: "above" | "below";
      isCentered?: boolean;
      compactBottomSpacing?: boolean;
      initialToolsOpen?: boolean;
    } = {}
  ) => (
    <ChatComposer
      onSend={stableComposerSend}
      onCancel={stableStopGeneration}
      onVoice={stableVoiceAction}
      onVoiceChat={guestMode ? undefined : stableOpenVoiceChat}
      onCancelRecording={stableVoiceCancel}
      isGenerating={isGenerating}
      isRecording={voice.state === "recording"}
      isTranscribing={voice.state === "transcribing"}
      recordingSeconds={voice.seconds}
      audioBars={voice.audioBars}
      audioLevel={voice.audioLevel}
      value={composerValue}
      onValueChange={setComposerValue}
      activeMode={guestMode ? "chat" : activeMode}
      onModeChange={
        guestMode ? undefined : mode => setActiveMode(mode || "chat")
      }
      pptConfig={pptConfig}
      onPptConfigChange={setPptConfig}
      onAttachment={guestMode ? undefined : stableAttachFromComposer}
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
      libraryFiles={guestMode ? [] : libraryFilesQuery.data}
      onLibraryFile={guestMode ? undefined : stableAttachLibraryFiles}
      initialLibraryOpen={isLibraryPreview}
      initialToolsOpen={options.initialToolsOpen}
      menuPlacement={options.menuPlacement ?? "above"}
      compactBottomSpacing={options.compactBottomSpacing ?? true}
      isCentered={options.isCentered ?? false}
      onTakeScreenshot={guestMode ? undefined : stableCaptureScreenshot}
      hideVoiceInput={guestMode || Boolean(options.hideVoiceInput)}
      focusToken={composerFocusToken}
      isEditingMessage={Boolean(editingMessage)}
      onSaveEdit={stableEditAction}
      onCancelEdit={stableCancelEdit}
      temporary={isTemporaryChat}
      guestMode={guestMode}
    />
  );
  const composerElement = renderComposer();
  const voiceComposerElement = renderComposer({ hideVoiceInput: true });

  if (loading) return <Loading fullScreen />;

  // The server could not verify the session (data store/OAuth temporarily
  // down). Do NOT show the sign-in screen: the user may still be signed in,
  // and bouncing them to login on an outage looks like a forced logout.
  // Only signed-in users need to wait on this: after signing out (or while
  // signed out) a data-store blip must never flash this screen over the guest
  // UI — that read as "everything is broken / flickering" on deployed devices.
  if (authUnavailable && user) {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-background px-5 text-center">
        <p className="text-sm font-medium text-foreground">
          KSEMO could not verify your session because its data store is
          temporarily unavailable.
        </p>
        <p className="max-w-sm text-xs leading-5 text-muted-foreground">
          Please retry in a moment — you will not be signed out.
        </p>
        <button
          type="button"
          onClick={() => void refresh()}
          className="inline-flex h-9 items-center rounded-lg border border-border bg-card px-4 text-sm font-medium text-foreground hover:bg-accent"
        >
          Retry
        </button>
      </main>
    );
  }

  // Signed-out visitors stay inside the app in a locked "guest" preview: the
  // layout looks identical, the sidebar is gated, and a local demo chat runs
  // until they sign in. Only the dev-only signed-out preview shows AuthStage.
  if (isSignedOutPreview) return <AuthStage />;

  return (
    <div
      className="flex h-dvh overflow-hidden bg-background"
      style={
        isMobile && visualViewportHeight
          ? { height: visualViewportHeight }
          : undefined
      }
    >
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
        onRenameSubmit={stableRenameSubmit}
        onPin={stableOnPin}
        onArchive={stableOnArchive}
        onShare={stableOnShareConversation}
        onExport={stableOnExport}
        onDelete={stableOnDelete}
        onSearch={stableOnSearch}
        onWorkspace={stableOnWorkspace}
        previewSupportOpen={isProfileSupportPreview}
        onSettings={stableOnSettings}
        onSupport={stableOnSupport}
        onLogout={stableLogout}
        user={user ?? {}}
        locked={guestMode}
        onLoginPrompt={stableOnLoginPrompt}
      />

      <main
        className={cn(
          "relative flex min-w-0 flex-1 flex-col transition-[margin] duration-300 ease-out",
          chatFilesOpen && "md:ml-6 md:mr-[25rem]"
        )}
      >
        {activePrimaryWorkspace === "library" ? (
          <LibraryWorkspace
            onClose={stableCloseWorkspace}
            onOpenSidebar={() => setSidebarOpen(true)}
            onChatWithFiles={startChatWithLibraryFiles}
          />
        ) : activePrimaryWorkspace === "search" ? (
          <SearchWorkspace
            onBackToChat={stableCloseWorkspace}
            onOpenSidebar={() => setSidebarOpen(true)}
            conversations={conversationQuery.data ?? []}
            onSelectConversation={stableOnSearchSelect}
          />
        ) : (
          <>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSidebarOpen(true)}
              className="absolute left-2 top-2 z-10 size-10 rounded-lg bg-neutral-900 text-neutral-50 hover:bg-neutral-800 lg:hidden"
              aria-label="Open conversations"
              data-testid="mobile-sidebar-toggle"
            >
              <ChevronsRight className="size-5" />
            </Button>

            {!guestMode &&
              !activeConversationId &&
              visibleMessages.length === 0 && (
                <div className="absolute right-2 top-2 z-10">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        data-testid="temporary-chat-toggle"
                        aria-label={
                          isTemporaryChat
                            ? "Exit temporary chat"
                            : "Temporary chat"
                        }
                        aria-pressed={isTemporaryChat}
                        onClick={() => {
                          const next = !isTemporaryChatRef.current;
                          isTemporaryChatRef.current = next;
                          setIsTemporaryChat(next);
                          if (next) {
                            temporaryConversationIdsRef.current = new Set();
                            writeStoredTemporaryChat(user?.id, {
                              active: true,
                              activeConversationId: null,
                              ids: [],
                            });
                          } else {
                            purgeTemporaryConversations();
                            writeStoredTemporaryChat(user?.id, {
                              active: false,
                              activeConversationId: null,
                              ids: [],
                            });
                          }
                        }}
                        // Hover effect is always the same (ghost default);
                        // active state adds a staying rounded-square highlight.
                        className={cn(
                          "size-10 rounded-xl text-foreground transition-colors",
                          isTemporaryChat && "bg-foreground/10"
                        )}
                      >
                        <TemporaryChatIcon
                          active={false}
                          className="size-[26px]"
                        />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" sideOffset={6}>
                      {isTemporaryChat
                        ? "Exit temporary chat"
                        : "Temporary chat"}
                    </TooltipContent>
                  </Tooltip>
                </div>
              )}

            {guestMode && (
              <div className="absolute right-2 top-2 z-10 flex items-center gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    window.location.href = "/signup";
                  }}
                  className="h-9 rounded-lg border-border text-foreground transition-colors duration-150 hover:border-transparent hover:bg-[oklch(0.21_0.008_80)] hover:text-[oklch(0.95_0.003_80)] active:scale-[0.98]"
                  aria-label="Create account"
                  data-testid="guest-create-account-button"
                >
                  <span className="inline-flex items-center gap-1.5 text-sm font-medium">
                    <UserPlus className="size-4" />
                    Create account
                  </span>
                </Button>
                <Button
                  onClick={() => startLogin()}
                  className="h-9 rounded-lg bg-[oklch(0.95_0.003_80)] text-[oklch(0.21_0.008_80)] shadow-sm transition-colors duration-150 hover:bg-[oklch(0.93_0.003_80)] active:scale-[0.98]"
                  aria-label="Sign in"
                  data-testid="guest-sign-in-button"
                >
                  <span className="inline-flex items-center gap-1.5 text-sm font-medium">
                    <LogIn className="size-4" />
                    Sign in
                  </span>
                </Button>
              </div>
            )}

            {/* Chat action menu has no place in a temporary chat, so the
                three-dots button is hidden there entirely. */}
            {!guestMode &&
              visibleMessages.length > 0 &&
              !isTemporaryChat &&
              !chatFilesOpen && (
                <div className="absolute right-2 top-2 z-10">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-9 rounded-lg bg-neutral-900 text-neutral-50 hover:bg-neutral-800"
                        aria-label="Chat actions"
                      >
                        <MoreHorizontal
                          className="size-4.5"
                          strokeWidth={2.75}
                          fill="currentColor"
                        />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      align="end"
                      className="w-44 rounded-xl"
                    >
                      <DropdownMenuItem
                        disabled={!activeConversationId}
                        onSelect={() => {
                          if (activeConversationId) {
                            const pinned =
                              activeConversation?.isPinned ?? false;
                            stableOnPin({
                              id: activeConversationId,
                              isPinned: pinned,
                            });
                          }
                        }}
                      >
                        <Pin className="mr-2 size-4" />
                        {activeConversation?.isPinned ? "Unpin" : "Pin"}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        disabled={!activeConversationId}
                        onSelect={() => {
                          if (activeConversationId) {
                            stableOnShareConversation(
                              activeConversation
                                ? {
                                    id: activeConversationId,
                                    title: activeConversation.title,
                                    isPublic: activeConversation.isPublic,
                                    shareToken: activeConversation.shareToken,
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
                        <FolderOpen className="mr-2 size-4" />
                        View files
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
                                activeConversation?.title ??
                                "this conversation",
                            });
                        }}
                      >
                        <Trash2 className="mr-2 size-4" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              )}
            <ChatFilesDialog
              open={chatFilesOpen}
              onOpenChange={setChatFilesOpen}
              files={chatFiles}
            />

            <section
              ref={messagesContainerRef}
              onScroll={handleMessagesScroll}
              className={cn(
                "min-h-0 flex-1",
                visibleMessages.length
                  ? "overflow-y-auto"
                  : "overflow-y-auto lg:overflow-hidden"
              )}
              aria-label="Conversation"
            >
              {visibleMessages.length ? (
                <div
                  ref={messagesBodyRef}
                  className="mx-auto max-w-3xl space-y-5 px-4 pb-3 pt-16 sm:px-6 sm:pb-4 lg:pt-5"
                >
                  {visibleMessages.map(message => {
                    const activeFileGen =
                      fileGeneration && fileGeneration.messageId === message.id
                        ? fileGeneration
                        : message.fileGeneration
                          ? {
                              messageId: message.id,
                              stage: message.fileGeneration.stage,
                              format: message.fileGeneration.format,
                              status: message.fileGeneration.status,
                              createdAt: 0,
                              message: message.fileGeneration.message,
                              researchSourceCount:
                                message.fileGeneration.researchSourceCount,
                              outline: message.fileGeneration.outline,
                              code: message.fileGeneration.code,
                            }
                          : null;

                    const fileCreationNode = activeFileGen ? (
                      <div className="animate-in fade-in-0 duration-150">
                        <FileCreationCard
                          stage={
                            activeFileGen.status === "created"
                              ? "completed"
                              : activeFileGen.stage === "interrupted"
                                ? "interrupted"
                                : activeFileGen.status === "error"
                                  ? "error"
                                  : (activeFileGen.stage as FileCreationStage)
                          }
                          format={
                            (activeFileGen.format as DocFormat) || undefined
                          }
                          filename={message.attachments?.[0]?.filename}
                          fileUrl={message.attachments?.[0]?.url}
                          fileSizeBytes={message.attachments?.[0]?.sizeBytes}
                          fileId={message.attachments?.[0]?.id}
                          researchSourceCount={
                            activeFileGen.researchSourceCount
                          }
                          onRetry={() => regenerateMessage(message)}
                          code={activeFileGen.code}
                        />
                      </div>
                    ) : null;

                    return (
                      <MessageContent
                        key={message.id}
                        message={message}
                        fileCreationNode={fileCreationNode}
                        isFileGenerating={Boolean(
                          activeFileGen && activeFileGen.status === "processing"
                        )}
                        onSpeak={stableSpeak}
                        onPause={stablePauseSpeech}
                        onResume={stableResumeSpeech}
                        onStop={stableStopSpeech}
                        isSpeaking={speakingMessageId === message.id}
                        speechState={speechState}
                        isCurrentGeneration={
                          isGenerating && generatingMessageId === message.id
                        }
                        hideTypingIndicator={Boolean(
                          isFileGenerating ||
                          activeFileGen ||
                          message.fileGeneration ||
                          (isGenerating &&
                            generatingMessageId === message.id &&
                            (activeMode !== "chat" || Boolean(fileGeneration)))
                        )}
                        onEdit={guestMode ? undefined : stableEditMessage}
                        isEditing={editingMessage?.id === message.id}
                        editValue={editValue}
                        onEditValueChange={setEditValue}
                        onSaveEdit={stableEditAction}
                        onCancelEdit={stableCancelEdit}
                        onRegenerate={
                          guestMode ? undefined : stableRegenerateMessage
                        }
                        onRetry={
                          guestMode ? undefined : stableRegenerateMessage
                        }
                        onShare={guestMode ? undefined : stableShareMessage}
                        onDelete={guestMode ? undefined : stableDeleteMessage}
                        onFeedback={guestMode ? undefined : stableOnFeedback}
                      />
                    );
                  })}
                  <div ref={messagesEndRef} />
                </div>
              ) : isPendingSeed ||
                (activeQuery.isLoading &&
                  activeConversationId &&
                  !isGenerating) ? (
                <Loading />
              ) : (
                <EmptyState
                  greeting={greeting}
                  temporary={isTemporaryChat}
                  composer={
                    isMobile
                      ? null
                      : renderComposer({
                          menuPlacement: isMobile ? "above" : "below",
                          isCentered: true,
                          compactBottomSpacing: false,
                          initialToolsOpen: isLibraryPreview,
                        })
                  }
                />
              )}
            </section>

            {(visibleMessages.length > 0 || isMobile) && (
              <div
                className={cn(
                  "z-10",
                  isMobile && visibleMessages.length === 0
                    ? "absolute inset-x-0 bottom-0"
                    : "relative"
                )}
              >
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute -top-8 left-0 right-0 h-8 bg-gradient-to-b from-transparent to-background"
                />
                {composerElement}
              </div>
            )}
            {voiceChatOpen && !isTemporaryChat && (
              <VoiceChat
                conversationId={activeConversationId}
                onConversation={stableSelectConversation}
                onExit={stableCloseVoiceChat}
                speechRatePreference={preferencesQuery.data?.speechRate ?? 100}
                onSpeechRateChange={stableVoiceSpeechRate}
                composer={voiceComposerElement}
              />
            )}
          </>
        )}
        <PdfDrawer />
      </main>

      {!guestMode && (
        <SettingsDialog
          open={settingsOpen || isSettingsPreview}
          onOpenChange={setSettingsOpen}
          initialTab={settingsInitialTab}
          user={user!}
          onSignOut={stableLogout}
          onAllChatsDeleted={stableOnAllChatsDeleted}
          onOpenConversation={stableOnOpenArchivedConversation}
          onAccountDeleted={stableOnAccountDeleted}
        />
      )}
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
        open={isEditPreview}
        onOpenChange={stableEditDialogOpen}
        title="Edit message"
        description="Your earlier version stays safely recorded."
        label="Message"
        value={
          isEditPreview ? "Can you make this answer more concise?" : editValue
        }
        onValueChange={setEditValue}
        multiline
        actionLabel="Save"
        onAction={stableEditAction}
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

      {guestMode && (
        <SignInPrompt
          open={guestPromptOpen}
          onClose={() => setGuestPromptOpen(false)}
        />
      )}
    </div>
  );
}

function timeGreeting() {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return "Hey, what's sparking today?";
  if (hour >= 12 && hour < 17) return "Hey, what's your next move?";
  if (hour >= 17 && hour < 21) return "Hey, what's on your mind?";
  return "Hey, what are you thinking?";
}

const EmptyState = memo(function EmptyState({
  greeting,
  composer,
  temporary = false,
}: {
  greeting: string;
  composer: React.ReactNode;
  temporary?: boolean;
}) {
  return (
    <div className="mx-auto flex h-full w-full max-w-3xl flex-col px-0 pb-16 sm:px-5 sm:pb-4 lg:justify-center">
      <div className="flex min-h-0 flex-1 flex-col justify-center lg:flex-none">
        <div className="mb-4 px-5 text-center sm:mb-5 sm:px-0">
          {temporary ? (
            <div className="flex items-center justify-center gap-3 animate-in fade-in duration-200">
              <TemporaryChatIcon
                active={temporary}
                className="size-8 shrink-0 text-foreground"
              />
              <p className="text-[22px] font-bold tracking-[-0.04em] text-balance text-foreground sm:tracking-[-0.025em]">
                Temporary chat
              </p>
            </div>
          ) : (
            <p className="text-[22px] font-bold tracking-[-0.04em] text-balance text-foreground sm:tracking-[-0.025em]">
              {greeting}
            </p>
          )}
        </div>
      </div>
      <div className="relative mx-auto w-full max-w-3xl">
        {composer}
        {temporary && (
          <p className="pointer-events-none absolute inset-x-0 top-full mt-1 px-5 text-center text-[13px] font-medium leading-snug text-muted-foreground sm:px-0 animate-in fade-in duration-200">
            This conversation won't be saved to your chat history.
          </p>
        )}
      </div>
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
  const placeCaretAtEnd = (event: React.FocusEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    requestAnimationFrame(() => {
      const end = input.value.length;
      input.setSelectionRange(end, end);
      input.scrollLeft = input.scrollWidth;
    });
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-2xl border bg-background sm:max-w-sm">
        <div className="py-1">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold tracking-[-0.02em]">
              {title}
            </h2>
            {description && (
              <p className="text-sm leading-relaxed text-muted-foreground">
                {description}
              </p>
            )}
          </div>
          <div className="mt-4">
            {multiline ? (
              <textarea
                id="ksemo-dialog-value"
                value={value}
                onChange={event => onValueChange(event.target.value)}
                autoFocus
                className="min-h-32 w-full resize-none rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none transition-colors"
              />
            ) : (
              <input
                id="rename-conversation-input"
                value={value}
                onChange={event => onValueChange(event.target.value)}
                maxLength={120}
                autoFocus
                onFocus={placeCaretAtEnd}
                onKeyDown={event => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    if (value.trim()) onAction();
                  }
                }}
                className="h-11 w-full rounded-xl border border-border bg-background px-4 text-sm outline-none transition-colors"
              />
            )}
          </div>
          <div className="mt-5 flex items-center justify-end gap-2">
            {secondaryActionLabel && onSecondaryAction && (
              <Button
                variant="outline"
                size="sm"
                className="mr-auto h-9 rounded-lg px-4 text-muted-foreground hover:text-foreground"
                onClick={onSecondaryAction}
              >
                {secondaryActionLabel}
              </Button>
            )}
            <Button
              variant="ghost"
              onClick={() => onOpenChange(false)}
              className="h-9 rounded-lg px-4"
            >
              Cancel
            </Button>
            <Button
              onClick={onAction}
              disabled={!value.trim()}
              className="h-9 rounded-lg px-5 bg-foreground text-background hover:bg-foreground/90"
            >
              {actionLabel}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
});
