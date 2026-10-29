import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  createConversationForUser,
  createMessage,
  createVoiceSession,
  archiveAllConversationsForUser,
  clearMessageFeedbackForUser,
  deleteAllConversationsForUser,
  deleteConversationForUser,
  deleteMessageForUser,
  editMessageForUser,
  getConversationForUser,
  getConversationById,
  getConversationByShareToken,
  getPublicConversationByToken,
  createSharedAnswerForUser,
  getSharedAnswerByToken,
  getMessageForUser,
  listMessageVersionsForUser,
  listMessageVersionsForMessages,
  type MessageVersion,
  listMessageFilesForUser,
  attachFileToMessageForUser,
  getUserPreferences,
  listConversationsForUser,
  listMessageFeedbackForUser,
  listMessagesForConversation,
  moveConversationToTrash,
  restoreConversationForUser,
  searchConversationMessages,
  searchConversationTitles,
setMessageFeedbackForUser,
  updateConversationForUser,
  updateMessage,
  updateVoiceSessionForUser,
  upsertUserPreferences,
  createFileForUser,
} from "../supabase-db";
import { storagePut } from "../storage";
import { listLLMModels, resolveModelName } from "../_core/llm";
import type { Message } from "../_core/llm";
import { transcribeAudio } from "../_core/voiceTranscription";
import { isMailerConfigured, sendFeedbackEmail } from "../_core/mailer";
import { generateFile, type FileFormat } from "../fileGeneration";
import { planPresentationOutline, regenerateSingleSlide, buildOutlineMetadata } from "../docgen/presentation/outline";
import { protectedProcedure, publicProcedure, router } from "../_core/trpc";
import { EPHEMERAL_TITLE_PREFIX, typeAfterVoiceSession } from "../conversationTypes";
import type { KsemoFile } from "../../supabase-schema/04-types";
import { setInterruptedResponseOverride } from "../interruptedResponse";

const conversationId = z.string().min(8).max(36);
const preferenceInput = z.object({
  selectedModel: z.string().max(160).nullable().optional(),
  persona: z.enum(["balanced", "concise", "creative", "analytical"]).optional(),
  customInstructions: z.string().max(2_000).nullable().optional(),
  speechRate: z.number().int().min(60).max(180).optional(),
  autoPlayResponses: z.boolean().optional(),
  reduceMotion: z.boolean().optional(),
});

type BranchHistoryMessage = {
  id: string;
  role: string;
  content: string;
  createdAt: Date | string;
  metadata?: (Record<string, unknown> & {
    parentBranch?: unknown;
    branches?: Array<{ childChatId?: string }>;
  }) | null;
};

function sharedBranchHistoryLength(
  parentMessages: BranchHistoryMessage[],
  branchMessages: BranchHistoryMessage[]
) {
  let length = 0;
  while (length < parentMessages.length && length < branchMessages.length) {
    const parentMessage = parentMessages[length];
    const branchMessage = branchMessages[length];
    if (
      parentMessage.role !== branchMessage.role ||
      parentMessage.content !== branchMessage.content ||
      new Date(parentMessage.createdAt).getTime() !==
        new Date(branchMessage.createdAt).getTime()
    ) {
      break;
    }
    length += 1;
  }
  return length;
}

function addMessageMetadata(
  message: BranchHistoryMessage,
  values: Record<string, unknown>
): BranchHistoryMessage {
  return {
    ...message,
    metadata: { ...(message.metadata ?? {}), ...values },
  };
}

function requireConversation(id: string, userId: number) {
  return getConversationForUser(id, userId).then(conversation => {
    if (!conversation)
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Conversation not found",
      });
    return conversation;
  });
}

async function removeConversationBranchLinks(
  conversationId: string,
  userId: number
) {
  const conversations = await Promise.all(
    (["active", "archived", "trash"] as const).map(scope =>
      listConversationsForUser(userId, scope)
    )
  );
  const seen = new Set<string>();
  for (const conversation of conversations.flat()) {
    if (conversation.id === conversationId || seen.has(conversation.id)) continue;
    seen.add(conversation.id);
    const messages = await listMessagesForConversation(conversation.id);
    for (const message of messages) {
      const metadata = message.metadata as Record<string, any> | null | undefined;
      if (!metadata) continue;
      let changed = false;
      const next = { ...metadata };

      if (
        next.parentBranch?.parentChatId === conversationId ||
        next.branchOrigin?.conversationId === conversationId
      ) {
        delete next.parentBranch;
        delete next.branchOrigin;
        changed = true;
      }
      if (Array.isArray(next.branches)) {
        const branches = next.branches.filter(
          (branch: any) => branch?.childChatId !== conversationId
        );
        if (branches.length !== next.branches.length) {
          next.branches = branches;
          changed = true;
        }
      }
      if (Array.isArray(next.branchTargets)) {
        const targets = next.branchTargets.filter(
          (target: any) => target?.conversationId !== conversationId
        );
        if (targets.length !== next.branchTargets.length) {
          next.branchTargets = targets;
          changed = true;
        }
      }
      if (changed) await updateMessage(message.id, { metadata: next });
    }
  }
}

export const conversationRouter = router({
  createSharedAnswer: protectedProcedure
    .input(z.object({ content: z.string().trim().min(1).max(64_000) }))
    .mutation(async ({ ctx, input }) => {
      const token = Buffer.from(crypto.getRandomValues(new Uint8Array(18))).toString(
        "base64url"
      );
      await createSharedAnswerForUser({
        token,
        userId: ctx.user.id,
        content: input.content,
      });
      return { token };
    }),
  getSharedAnswer: publicProcedure
    .input(z.object({ token: z.string().min(16).max(64) }))
    .query(async ({ input }) => {
      const answer = await getSharedAnswerByToken(input.token);
      if (!answer) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Shared answer not found.",
        });
      }
      return answer;
    }),
  list: protectedProcedure
    .input(
      z
        .object({
          scope: z.enum(["active", "archived", "trash", "shared"]).default("active"),
        })
        .optional()
    )
    .query(({ ctx, input }) =>
      listConversationsForUser(ctx.user.id, input?.scope ?? "active")
    ),
  create: protectedProcedure
    .input(
      z.object({
        conversationType: z.enum(["text", "voice", "mixed"]).default("text"),
      })
    )
    .mutation(({ ctx, input }) =>
      createConversationForUser({
        id: crypto.randomUUID(),
        userId: ctx.user.id,
        conversationType: input.conversationType,
      })
    ),
  get: publicProcedure
    .input(z.object({ id: conversationId }))
    .query(async ({ ctx, input }) => {
      let conversation: any = undefined;
      const user = ctx.user;
      if (user) {
        conversation = await getConversationForUser(input.id, user.id);
      }
      if (!conversation) {
        const candidate = await getConversationById(input.id);
        if (candidate && candidate.isPublic) {
          conversation = candidate;
        }
      }
      if (!conversation) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Conversation not found",
        });
      }
      const isOwner = Boolean(user && conversation.userId === user.id);
      let items = await listMessagesForConversation(conversation.id);

      // Older Supabase projects can be missing messages.metadata, which means
      // the branch operation's relationship data was dropped even though the
      // copied branch chat was created. Recover that lineage from the exact
      // copied message prefix so existing branches still get navigable links.
      if (isOwner && user && conversation.title) {
        const [activeConversations, archivedConversations] = await Promise.all([
          listConversationsForUser(user.id, "active"),
          listConversationsForUser(user.id, "archived"),
        ]);
        const conversationsById = new Map(
          [...activeConversations, ...archivedConversations].map(item => [
            item.id,
            item,
          ])
        );
        const branchMessages = items as BranchHistoryMessage[];

        if (conversation.title.startsWith("Branch: ")) {
          const parentTitle = conversation.title.replace(/^Branch:\s*/, "");
          const parents = [...conversationsById.values()].filter(
            item => item.id !== conversation.id && item.title === parentTitle
          );
          const matches = await Promise.all(
            parents.map(async parent => {
              const parentMessages = (await listMessagesForConversation(
                parent.id
              )) as BranchHistoryMessage[];
              return {
                parent,
                parentMessages,
                sharedLength: sharedBranchHistoryLength(
                  parentMessages,
                  branchMessages
                ),
              };
            })
          );
          matches.sort((a, b) => b.sharedLength - a.sharedLength);
          const best = matches[0];
          const isAmbiguous =
            best &&
            (matches[1]?.sharedLength ?? 0) === best.sharedLength &&
            best.sharedLength > 0;
          const alreadyLinked = branchMessages.some(
            message => message.metadata?.parentBranch
          );
          if (best && best.sharedLength > 0 && !isAmbiguous && !alreadyLinked) {
            const branchPoint = best.sharedLength - 1;
            items = items.map((message, index) =>
              index === branchPoint
                ? (addMessageMetadata(message as BranchHistoryMessage, {
                    parentBranch: {
                      parentChatId: best.parent.id,
                      parentChatTitle: best.parent.title,
                      branchedAtMessageId: best.parentMessages[branchPoint].id,
                    },
                  }) as typeof message)
                : message
            );
          }
        } else {
          const existingBranches = new Set(
            branchMessages.flatMap(message => {
              const metadata = message.metadata as
                | { branches?: Array<{ childChatId?: string }> }
                | null
                | undefined;
              return (metadata?.branches ?? [])
                .map(branch => branch.childChatId)
                .filter((id): id is string => typeof id === "string");
            })
          );
          const children = [...conversationsById.values()].filter(
            item =>
              item.id !== conversation.id &&
              item.title === `Branch: ${conversation.title}` &&
              !existingBranches.has(item.id)
          );
          const matches = await Promise.all(
            children.map(async child => {
              const childMessages = (await listMessagesForConversation(
                child.id
              )) as BranchHistoryMessage[];
              return {
                child,
                sharedLength: sharedBranchHistoryLength(
                  branchMessages,
                  childMessages
                ),
              };
            })
          );
          items = items.map((message, index) => {
            const branches = matches
              .filter(match => match.sharedLength === index + 1)
              .map(match => ({
                targetMessageId: message.id,
                childChatId: match.child.id,
                childTitle: match.child.title,
              }));
            if (!branches.length) return message;
            const metadata = (message as BranchHistoryMessage).metadata ?? {};
            const existingValue = (metadata as { branches?: unknown }).branches;
            const existing = Array.isArray(existingValue)
              ? (existingValue as Array<{ childChatId?: string }>)
              : [];
            return addMessageMetadata(message as BranchHistoryMessage, {
              branches: [
                ...existing,
                ...branches.filter(
                  branch =>
                    !existing.some(
                      item => item.childChatId === branch.childChatId
                    )
                ),
              ],
            }) as typeof message;
          });
        }
      }
      const versionsByMessageId: Record<string, MessageVersion[]> =
        isOwner && user
          ? await listMessageVersionsForMessages(
              items.map(message => message.id),
              user.id
            )
          : {};
      return {
        conversation: {
          ...conversation,
          isOwner,
        },
        messages: await Promise.all(
          items.map(async message => ({
            ...message,
            versions: versionsByMessageId[message.id] ?? [],
            attachments:
              isOwner && user
                ? await listMessageFilesForUser(message.id, user.id)
                : [],
          }))
        ),
      };
    }),
  rename: protectedProcedure
    .input(
      z.object({ id: conversationId, title: z.string().trim().min(1).max(120) })
    )
    .mutation(async ({ ctx, input }) => {
      const conversation = await requireConversation(input.id, ctx.user.id);
      const isPrivate = conversation.title.startsWith(EPHEMERAL_TITLE_PREFIX);
      const untaggedTitle = isPrivate
        ? conversation.title.slice(EPHEMERAL_TITLE_PREFIX.length)
        : conversation.title;
      const branchPrefix = untaggedTitle.startsWith("Branch: ") ? "Branch: " : "";
      const renamedTitle = branchPrefix
        ? `Branch: ${input.title.replace(/^Branch:\s*/, "").slice(0, 112)}`
        : input.title;
      const title = `${isPrivate ? EPHEMERAL_TITLE_PREFIX : ""}${renamedTitle}`;
      return updateConversationForUser(input.id, ctx.user.id, {
        title,
      });
    }),
  moveToPrivate: protectedProcedure
    .input(z.object({ id: conversationId }))
    .mutation(async ({ ctx, input }) => {
      const conversation = await requireConversation(input.id, ctx.user.id);
      const title = conversation.title.startsWith(EPHEMERAL_TITLE_PREFIX)
        ? conversation.title
        : `${EPHEMERAL_TITLE_PREFIX}${conversation.title}`;
      const updated = await updateConversationForUser(input.id, ctx.user.id, {
        title,
        isPinned: false,
        isArchived: false,
        isPublic: false,
        shareToken: null,
      });
      if (!updated) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Conversation not found" });
      }
      return { success: true } as const;
    }),
  setPinned: protectedProcedure
    .input(z.object({ id: conversationId, isPinned: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      await requireConversation(input.id, ctx.user.id);
      return updateConversationForUser(input.id, ctx.user.id, {
        isPinned: input.isPinned,
      });
    }),
  setArchived: protectedProcedure
    .input(z.object({ id: conversationId, isArchived: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      await requireConversation(input.id, ctx.user.id);
      return updateConversationForUser(input.id, ctx.user.id, {
        isArchived: input.isArchived,
        isPinned: input.isArchived ? false : undefined,
      });
    }),
  trash: protectedProcedure
    .input(z.object({ id: conversationId }))
    .mutation(async ({ ctx, input }) => {
      await requireConversation(input.id, ctx.user.id);
      await moveConversationToTrash(input.id, ctx.user.id);
      return { success: true } as const;
    }),
  restore: protectedProcedure
    .input(z.object({ id: conversationId }))
    .mutation(async ({ ctx, input }) => {
      await requireConversation(input.id, ctx.user.id);
      await restoreConversationForUser(input.id, ctx.user.id);
      return { success: true } as const;
    }),
  remove: protectedProcedure
    .input(z.object({ id: conversationId }))
    .mutation(async ({ ctx, input }) => {
      await requireConversation(input.id, ctx.user.id);
      await removeConversationBranchLinks(input.id, ctx.user.id);
      await deleteConversationForUser(input.id, ctx.user.id);
      return { success: true } as const;
    }),
  removeAll: protectedProcedure.mutation(async ({ ctx }) => {
    const removed = await deleteAllConversationsForUser(ctx.user.id);
    return { success: true, removed } as const;
  }),
  archiveAll: protectedProcedure.mutation(async ({ ctx }) => {
    const archived = await archiveAllConversationsForUser(ctx.user.id);
    return { success: true, archived } as const;
  }),
  duplicate: protectedProcedure
    .input(z.object({ id: conversationId }))
    .mutation(async ({ ctx, input }) => {
      const original = await requireConversation(input.id, ctx.user.id);
      const duplicate = await createConversationForUser({
        id: crypto.randomUUID(),
        userId: ctx.user.id,
        title: `${original.title.slice(0, 105)} (copy)`,
        conversationType: original.conversationType,
      });
      if (!duplicate)
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Conversation could not be duplicated.",
        });
      const originalMessages = await listMessagesForConversation(original.id);
      for (const message of originalMessages) {
        await createMessage({
          id: crypto.randomUUID(),
          conversationId: duplicate.id,
          role: message.role,
          content: message.content,
          model: message.model,
          status: message.status === "streaming" ? "cancelled" : message.status,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }
      return duplicate;
    }),
  branch: protectedProcedure
    .input(
      z.object({
        id: conversationId,
        messageId: z.string().min(1).max(128),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const original = await requireConversation(input.id, ctx.user.id);
      const originalMessages = await listMessagesForConversation(original.id);
      const selectedIndex = originalMessages.findIndex(
        message => message.id === input.messageId
      );
      if (
        selectedIndex < 0 ||
        !["assistant", "user"].includes(originalMessages[selectedIndex].role) ||
        originalMessages[selectedIndex].status === "streaming"
      ) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "The selected message is no longer available to branch.",
        });
      }

      const branch = await createConversationForUser({
        id: crypto.randomUUID(),
        userId: ctx.user.id,
        title: `Branch: ${original.title.slice(0, 112)}`,
        conversationType: original.conversationType,
      });
      if (!branch) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "A branch conversation could not be created.",
        });
      }

      const historyToClone = originalMessages.slice(0, selectedIndex + 1);
      try {
        if (original.projectId) {
          await updateConversationForUser(branch.id, ctx.user.id, {
            projectId: original.projectId,
          });
        }
        for (const message of historyToClone) {
          const clonedMessageId = crypto.randomUUID();
          let clonedMetadata = message.metadata
            ? structuredClone(message.metadata)
            : undefined;
          if (clonedMetadata) {
            // Branch relationships belong to their original message IDs. Keep
            // all message data, but do not copy graph edges into a new branch.
            delete clonedMetadata.branches;
            delete clonedMetadata.branchTargets;
            delete clonedMetadata.parentBranch;
            delete clonedMetadata.branchOrigin;
          }
          if (message.id === input.messageId) {
            clonedMetadata = {
              ...(clonedMetadata ?? {}),
              parentBranch: {
                parentChatId: original.id,
                parentChatTitle: original.title,
                branchedAtMessageId: message.id,
              },
            };
          }
          await createMessage({
            id: clonedMessageId,
            conversationId: branch.id,
            role: message.role,
            content: message.content,
            model: message.model,
            metadata: clonedMetadata,
            status: message.status,
            createdAt: message.createdAt,
            updatedAt: message.updatedAt,
          });

          const files = await listMessageFilesForUser(message.id, ctx.user.id);
          for (const file of files) {
            // Keep the same file record and URL when copying a message into a
            // branch. Re-uploading here created a second storage URL for each
            // attachment, which could fail to load for image previews in the
            // branched chat even though the source message rendered correctly.
            await attachFileToMessageForUser({
              id: crypto.randomUUID(),
              fileId: file.id,
              messageId: clonedMessageId,
              conversationId: branch.id,
              userId: ctx.user.id,
            });
          }
        }
        const sourceMessage = originalMessages[selectedIndex];
        const sourceMetadata = sourceMessage.metadata
          ? structuredClone(sourceMessage.metadata)
          : {};
        const existingBranches = Array.isArray(sourceMetadata.branches)
          ? sourceMetadata.branches.filter(
              (target): target is {
                targetMessageId: string;
                childChatId: string;
                childTitle: string;
              } =>
                Boolean(
                  target &&
                    typeof target.targetMessageId === "string" &&
                    typeof target.childChatId === "string" &&
                    typeof target.childTitle === "string"
                )
            )
          : [];
        await updateMessage(sourceMessage.id, {
          metadata: {
            ...sourceMetadata,
            branches: [
              ...existingBranches,
              {
                targetMessageId: sourceMessage.id,
                childChatId: branch.id,
                childTitle: branch.title,
              },
            ],
          },
        });
      } catch (error) {
        await deleteConversationForUser(branch.id, ctx.user.id).catch(
          cleanupError =>
            console.error("Failed to clean up an incomplete chat branch:", cleanupError)
        );
        throw error;
      }
      return branch;
    }),
  export: protectedProcedure
    .input(z.object({ id: conversationId }))
    .query(async ({ ctx, input }) => {
      const conversation = await requireConversation(input.id, ctx.user.id);
      const items = await listMessagesForConversation(conversation.id);
      return {
        conversation,
        messages: await Promise.all(
          items.map(async message => ({
            ...message,
            attachments: await listMessageFilesForUser(message.id, ctx.user.id),
          }))
        ),
      };
    }),
  configurePublicShare: protectedProcedure
    .input(z.object({ id: conversationId, isPublic: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const conversation = await requireConversation(input.id, ctx.user.id);
      // Reuse a token only while a link is already active. Re-sharing after a
      // revoke gets a new token so previously copied URLs stay invalid.
      const shareToken = input.isPublic
        ? conversation.isPublic && conversation.shareToken
          ? conversation.shareToken
          : Array.from(crypto.getRandomValues(new Uint8Array(18)))
              .map(b => b.toString(36).padStart(2, "0"))
              .join("")
              .slice(0, 24)
        : conversation.shareToken;
      const updated = await updateConversationForUser(input.id, ctx.user.id, {
        isPublic: input.isPublic,
        shareToken: shareToken,
      });
      return {
        isPublic: Boolean(updated?.isPublic),
        shareToken: updated?.shareToken ?? shareToken,
      };
    }),
  getPublic: publicProcedure
    .input(z.object({ token: z.string().min(16).max(64) }))
    .query(async ({ ctx, input }) => {
      let shared = await getPublicConversationByToken(input.token);
      // If conversation is not public, but current user is authenticated owner, still allow them to access it
      if (!shared && ctx.user) {
        const candidate = await getConversationByShareToken(input.token);
        if (candidate && candidate.userId === ctx.user.id) {
          const items = await listMessagesForConversation(candidate.id);
          shared = {
            id: candidate.id,
            userId: candidate.userId,
            title: candidate.title,
            conversation_type: candidate.conversationType,
            created_at: candidate.createdAt,
            messages: items,
          };
        }
      }
      if (!shared)
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Shared conversation not found",
        });

      const userId = ctx.user?.id;
      const convUserId = shared.userId ?? shared.user_id;
      const isOwner = Boolean(userId && convUserId && userId === convUserId);

      return {
        conversation: {
          id: shared.id,
          title: shared.title,
          conversationType: shared.conversation_type,
          createdAt: new Date(shared.created_at),
          isOwner,
        },
        messages: (shared.messages || [])
          .filter(
            (message: any) =>
              message.role === "user" || message.role === "assistant"
          )
          .map((message: any) => ({
            id: message.id,
            role: message.role,
            content: message.content,
            createdAt: new Date(message.created_at),
          })),
      };
    }),
  forkShared: protectedProcedure
    .input(
      z.object({
        token: z.string().min(16).max(64).optional(),
        id: conversationId.optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      let shared: any = null;
      if (input.token) {
        shared = await getPublicConversationByToken(input.token);
      } else if (input.id) {
        const candidate = await getConversationById(input.id);
        if (
          candidate &&
          (candidate.isPublic || candidate.userId === ctx.user.id)
        ) {
          const msgs = await listMessagesForConversation(candidate.id);
          shared = {
            id: candidate.id,
            title: candidate.title,
            conversation_type: candidate.conversationType,
            messages: msgs,
          };
        }
      }
      if (!shared) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Conversation not found or is not public",
        });
      }
      const duplicate = await createConversationForUser({
        id: crypto.randomUUID(),
        userId: ctx.user.id,
        title: shared.title || "Shared Chat",
        conversationType: shared.conversation_type || "text",
      });
      if (!duplicate) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Could not continue conversation.",
        });
      }
      for (const msg of shared.messages || []) {
        if (msg.role === "user" || msg.role === "assistant") {
          await createMessage({
            id: crypto.randomUUID(),
            conversationId: duplicate.id,
            role: msg.role,
            content: msg.content,
            model: msg.model || null,
            status: "completed",
            createdAt: new Date(),
            updatedAt: new Date(),
          });
        }
      }
      return { conversationId: duplicate.id };
    }),
  search: protectedProcedure
    .input(z.object({ query: z.string().trim().min(1).max(120) }))
    .query(async ({ ctx, input }) => {
      const [messageMatches, titleMatches] = await Promise.all([
        searchConversationMessages(ctx.user.id, input.query),
        searchConversationTitles(ctx.user.id, input.query),
      ]);

      // Get latest message preview for title matches
      const titleMatchesWithPreviews = await Promise.all(
        titleMatches.map(async (conversation: any) => {
          const messages = await listMessagesForConversation(conversation.id);
          const latestMessage = messages.length > 0 ? messages[messages.length - 1] : null;
          return {
            conversationId: conversation.id,
            conversationTitle: conversation.title,
            createdAt: conversation.updatedAt,
            messagePreview: latestMessage ? {
              content: latestMessage.content,
              role: latestMessage.role,
            } : null,
          };
        })
      );

      return {
        chats: titleMatchesWithPreviews,
        messages: messageMatches.slice(0, 30),
      };
    }),
  getAllConversations: protectedProcedure
    .query(async ({ ctx }) => {
      const conversations = await listConversationsForUser(ctx.user.id, "active");
      
      // Get latest message preview for all conversations
      const conversationsWithPreviews = await Promise.all(
        conversations.map(async (conversation) => {
          const messages = await listMessagesForConversation(conversation.id);
          const latestMessage = messages.length > 0 ? messages[messages.length - 1] : null;
          return {
            conversationId: conversation.id,
            conversationTitle: conversation.title,
            createdAt: conversation.updatedAt,
            isPinned: conversation.isPinned,
            messagePreview: latestMessage ? {
              content: latestMessage.content,
              role: latestMessage.role,
            } : null,
          };
        })
      );

      return conversationsWithPreviews;
    }),
});

export const preferenceRouter = router({
  get: protectedProcedure.query(async ({ ctx }) => {
    const preferences = await getUserPreferences(ctx.user.id);
    if (!preferences) return null;
    return {
      ...preferences,
      selectedModel: resolveModelName(preferences.selectedModel ?? undefined),
    };
  }),
  update: protectedProcedure
    .input(preferenceInput)
    .mutation(({ ctx, input }) => upsertUserPreferences(ctx.user.id, input)),
  models: protectedProcedure.query(async () => {
    try {
      const catalog = await listLLMModels();
      return catalog.data
        .map(model => ({
          id: model.id.replace(/^models\//, ""),
          label: model.id.replace(/^models\//, ""),
        }))
        .filter(
          model =>
            /^(?:models\/)?(?:gemini-|kimi-|glm-|gemma|deepseek-|gpt-oss|minimax-|mistral-|nemotron-)/i.test(
              model.id
            ) &&
            !/tts|image|embedding|veo|lyria|robotics|aqa|native-audio|computer-use|live/.test(
              model.id
            )
        );
    } catch (error) {
      console.error("[KSEMO] model catalogue unavailable", error);
      return [];
    }
  }),
});

export const feedbackRouter = router({
  send: protectedProcedure
    .input(
      z.object({
        category: z.enum(["bug", "idea", "question", "praise"]),
        message: z.string().trim().min(10).max(4_000),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (!isMailerConfigured())
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message:
            "Feedback delivery is not configured. Please email us instead.",
        });
      try {
        await sendFeedbackEmail({
          fromName: ctx.user.name?.trim() || "KSEMO user",
          fromEmail: ctx.user.email ?? "",
          category: input.category,
          message: input.message,
        });
      } catch (error) {
        console.error("[KSEMO] feedback delivery failed:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "KSEMO could not send that feedback right now.",
        });
      }
      return { success: true } as const;
    }),
});

export const messageRouter = router({
  saveInterrupted: protectedProcedure
    .input(
      z.object({
        id: z.string().min(8).max(36),
        content: z.string().max(1_000_000),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const existing = await getMessageForUser(input.id, ctx.user.id);
      if (!existing)
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Message not found",
        });
      if (existing.role !== "assistant")
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only assistant responses can be saved as interrupted.",
        });

      setInterruptedResponseOverride(input.id, input.content);
      await updateMessage(input.id, {
        content: input.content,
        status: "cancelled",
      });
      return { success: true } as const;
    }),
  remove: protectedProcedure
    .input(z.object({ id: z.string().min(8).max(36) }))
    .mutation(async ({ ctx, input }) => {
      const removed = await deleteMessageForUser(input.id, ctx.user.id);
      if (!removed)
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Message not found",
        });
      return { success: true } as const;
    }),
  edit: protectedProcedure
    .input(
      z.object({
        id: z.string().min(8).max(36),
        content: z.string().trim().min(1).max(16_000),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const existing = await getMessageForUser(input.id, ctx.user.id);
      if (!existing)
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Message not found",
        });
      if (existing.role !== "user")
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only your own messages can be edited.",
        });
      return editMessageForUser({
        id: input.id,
        userId: ctx.user.id,
        versionId: crypto.randomUUID(),
        content: input.content,
      });
    }),
  history: protectedProcedure
    .input(z.object({ id: z.string().min(8).max(36) }))
    .query(async ({ ctx, input }) => {
      const versions = await listMessageVersionsForUser(input.id, ctx.user.id);
      if (!versions)
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Message not found",
        });
      return versions;
    }),
  restoreVersion: protectedProcedure
    .input(
      z.object({
        id: z.string().min(8).max(36),
        versionId: z.string().min(8).max(36),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const existing = await getMessageForUser(input.id, ctx.user.id);
      if (!existing)
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Message not found",
        });
      if (existing.role !== "user")
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only your own messages can be restored.",
        });
      const versions = await listMessageVersionsForUser(input.id, ctx.user.id);
      const version = versions?.find(item => item.id === input.versionId);
      if (!version)
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Message version not found",
        });
      return editMessageForUser({
        id: input.id,
        userId: ctx.user.id,
        versionId: crypto.randomUUID(),
        content: version.content,
      });
    }),
  feedback: protectedProcedure
    .input(
      z.object({
        messageId: z.string().min(8).max(36),
        // null clears the rating — the client toggles the active thumb off.
        value: z.enum(["up", "down"]).nullable(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const message = await getMessageForUser(input.messageId, ctx.user.id);
      if (!message)
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Message not found",
        });
      if (input.value === null) {
        await clearMessageFeedbackForUser({
          messageId: input.messageId,
          userId: ctx.user.id,
        });
        return { value: null };
      }
      await setMessageFeedbackForUser({
        id: crypto.randomUUID(),
        messageId: input.messageId,
        userId: ctx.user.id,
        value: input.value,
      });
      return { value: input.value };
    }),
  feedbackList: protectedProcedure
    .input(
      z.object({
        messageIds: z.array(z.string().min(8).max(36)).max(500),
      })
    )
    .query(({ ctx, input }) =>
      listMessageFeedbackForUser({
        userId: ctx.user.id,
        messageIds: input.messageIds,
      })
    ),
});

const supportedAudioTypes = new Set([
  "audio/webm",
  "audio/ogg",
  "audio/mpeg",
  "audio/wav",
  "audio/mp4",
]);

export const fileGenerationRouter = router({
  generate: protectedProcedure
    .input(
      z.object({
        format: z.enum(["pdf", "docx", "xlsx", "pptx", "txt"]),
        content: z.string().min(1),
        title: z.string().optional(),
        description: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const result = await generateFile({
          format: input.format as FileFormat,
          content: input.content,
          title: input.title,
          description: input.description,
        });

        const fileId = crypto.randomUUID();
        const safeFilename = result.filename
          .replace(/[<>:"/\\|?*]/g, "_")
          .replace(/\s+/g, "_")
          .substring(0, 200);
        const storagePath = `generated/${ctx.user.id}/${fileId}-${safeFilename}`;

        const saved = await storagePut(
          storagePath,
          result.data,
          result.mimeType
        );

        const fileRecord: KsemoFile = {
          id: fileId,
          userId: ctx.user.id,
          projectId: null,
          storageKey: saved.key,
          url: saved.url,
          filename: result.filename,
          mimeType: result.mimeType,
          sizeBytes: result.size,
          status: "ready",
          contentText: result.code ? JSON.stringify({ code: result.code, format: input.format }) : null,
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        await createFileForUser(fileRecord);

        return {
          success: true,
          file: {
            fileId,
            filename: result.filename,
            url: saved.url,
            storageKey: saved.key,
            mimeType: result.mimeType,
            sizeBytes: result.size,
            code: result.code,
          },
        };
      } catch (error) {
        console.error("File generation error:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to generate file",
        });
      }
    }),

  // ── Presentation outline mutations (two-phase PPT flow) ─────────────────

  /**
   * Regenerate the entire presentation outline for an assistant message. The
   * updated outline is persisted to the message's metadata and returned so the
   * client editor re-renders with the fresh plan.
   */
  regenerateOutline: protectedProcedure
    .input(
      z.object({
        assistantMessageId: z.string().min(8).max(36),
        prompt: z.string().min(1).max(4000),
        pptConfig: z.record(z.string(), z.unknown()).optional(),
        pptStyle: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const message = await getMessageForUser(input.assistantMessageId, ctx.user.id);
      if (!message)
        throw new TRPCError({ code: "NOT_FOUND", message: "Message not found" });

      let history: Message[] = [];
      try {
        const conversationMessages = await listMessagesForConversation(message.conversationId);
        history = conversationMessages
          .filter(m => m.role === "user" || m.role === "assistant")
          .filter(m => m.content.trim().length > 0)
          .map(m => ({
            role: m.role === "assistant" ? "assistant" as const : "user" as const,
            content: m.content,
          }));
      } catch {}

      const outline = await planPresentationOutline({
        userMessage: input.prompt,
        history,
        presentationConfig: input.pptConfig,
        presentationStyle: input.pptStyle,
      });

      await updateMessage(input.assistantMessageId, {
        metadata: {
          pptOutline: buildOutlineMetadata(outline, input.prompt),
        },
      });

      return outline;
    }),

  /**
   * Regenerate a single slide within an existing outline. Accepts the current
   * (possibly user-edited) outline, replaces the target slide via the LLM, then
   * persists and returns the updated outline.
   */
  regenerateSlide: protectedProcedure
    .input(
      z.object({
        assistantMessageId: z.string().min(8).max(36),
        slideId: z.string().min(1),
        outline: z.unknown(),
        instruction: z.string().max(800).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (!input.outline || typeof input.outline !== "object")
        throw new TRPCError({ code: "BAD_REQUEST", message: "An outline is required" });

      const message = await getMessageForUser(input.assistantMessageId, ctx.user.id);
      if (!message)
        throw new TRPCError({ code: "NOT_FOUND", message: "Message not found" });

      const baseOutline = input.outline as Parameters<typeof regenerateSingleSlide>[0]["outline"];
      const updated = await regenerateSingleSlide({
        outline: baseOutline,
        slideId: input.slideId,
        instruction: input.instruction,
      });

      await updateMessage(input.assistantMessageId, {
        metadata: {
          pptOutline: buildOutlineMetadata(updated, "Slide regeneration"),
        },
      });

      return updated;
    }),
});

export const voiceRouter = router({
  sessionStart: protectedProcedure
    .input(z.object({ conversationId: conversationId.optional() }))
    .mutation(async ({ ctx, input }) => {
      let conversation = input.conversationId
        ? await requireConversation(input.conversationId, ctx.user.id)
        : await createConversationForUser({
            id: crypto.randomUUID(),
            userId: ctx.user.id,
            conversationType: "voice",
          });
      if (!conversation)
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Unable to create a voice session.",
        });
      const nextType = typeAfterVoiceSession(conversation.conversationType);
      if (nextType !== conversation.conversationType) {
        const updated = await updateConversationForUser(
          conversation.id,
          ctx.user.id,
          { conversationType: nextType }
        );
        if (updated) conversation = updated;
      }
      if (!conversation)
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Unable to update the conversation voice mode.",
        });
      const session = await createVoiceSession({
        id: crypto.randomUUID(),
        userId: ctx.user.id,
        conversationId: conversation.id,
      });
      return { session, conversation };
    }),
  sessionStatus: protectedProcedure
    .input(
      z.object({
        id: z.string().min(8).max(36),
        status: z.enum([
          "connecting",
          "listening",
          "speaking",
          "processing",
          "interrupted",
          "ended",
          "error",
        ]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await updateVoiceSessionForUser(input.id, ctx.user.id, input.status);
      return { success: true } as const;
    }),
  transcribe: protectedProcedure
    .input(
      z.object({
        audioBase64: z.string().min(1),
        mimeType: z
          .string()
          .refine(
            type => supportedAudioTypes.has(type),
            "Unsupported audio format"
          ),
        language: z.string().length(2).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const buffer = Buffer.from(input.audioBase64, "base64");
      if (!buffer.length || buffer.length > 24 * 1024 * 1024) {
        throw new TRPCError({
          code: "PAYLOAD_TOO_LARGE",
          message: "Recordings must be smaller than 24 MB.",
        });
      }
      const result = await transcribeAudio({
        audio: buffer,
        mimeType: input.mimeType,
        language: input.language,
        prompt: "Transcribe the user's KSEMO message faithfully.",
      });
      if ("error" in result) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: result.error,
          cause: result,
        });
      }
      return {
        text: result.text,
        language: result.language,
        duration: result.duration,
      };
    }),
});
