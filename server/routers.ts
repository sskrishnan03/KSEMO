import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { authCredentialsRouterProcedures } from "./routers/authCredentials";
import {
  conversationRouter,
  feedbackRouter,
  messageRouter,
  preferenceRouter,
  voiceRouter,
} from "./routers/ksemo";
import { workspaceRouter } from "./routers/product";

export const appRouter = router({
  // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      console.log("[Auth] Logout - clearing cookie with options:", cookieOptions);
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
  voice: voiceRouter,
  workspace: workspaceRouter,
});

export type AppRouter = typeof appRouter;
