import { COOKIE_NAME } from "@shared/const";
import { TRPCError } from "@trpc/server";
import { getSessionCookieOptions } from "./_core/cookies";
import { sdk } from "./_core/sdk";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { authCredentialsRouterProcedures } from "./routers/authCredentials";
import {
  conversationRouter,
  feedbackRouter,
  fileGenerationRouter,
  messageRouter,
  preferenceRouter,
  voiceRouter,
} from "./routers/ksemo";
import { memoryRouter } from "./routers/memory";
import { workspaceRouter } from "./routers/product";

export const appRouter = router({
  // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => {
      if (opts.ctx.authUnavailable) {
        // The session could not be verified because the data store/OAuth
        // server is down. Raising a server error (instead of returning null)
        // lets the client tell "temporarily unavailable" apart from
        // "signed out", so it keeps the session instead of redirecting.
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "KSEMO's data store is temporarily unavailable.",
        });
      }
      const user = opts.ctx.user;
      return user
        ? { id: user.id, name: user.name, email: user.email }
        : null;
    }),
    logout: publicProcedure.mutation(async ({ ctx }) => {
      // Revoke the presented session BEFORE clearing the cookie, so neither
      // the stale cookie nor the Authorization-header fallback can ever
      // re-authenticate this user after sign-out.
      const token = ctx.req
        ? sdk.extractSessionToken(ctx.req)
        : undefined;
      if (token) {
        await sdk.revokeSession(token);
      }
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, cookieOptions);
      return {
        success: true,
      } as const;
    }),
    ...authCredentialsRouterProcedures,
  }),
  conversation: conversationRouter,
  feedback: feedbackRouter,
  message: messageRouter,
  preferences: preferenceRouter,
  memory: memoryRouter,
  voice: voiceRouter,
  fileGeneration: fileGenerationRouter,
  workspace: workspaceRouter,
});

export type AppRouter = typeof appRouter;
