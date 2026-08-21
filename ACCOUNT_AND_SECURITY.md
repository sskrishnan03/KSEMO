# KSEMO Account, Security, and Search Boundaries

KSEMO authenticates through **KSEMO OAuth**. The browser receives a signed session through the platform authentication flow; application routes derive the active identity on the server. The application does not place model, storage, speech-to-text, or database credentials in client source code.

| Area                       | Implemented boundary                                                                                                                                                                          |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Account control            | The profile control exposes authenticated settings and secure sign-out. Preferences such as model, voice, autoplay, reduced motion, and custom instructions are stored per signed-in account. |
| Conversations and messages | Protected procedures scope conversations, message edits, version history, exports, feedback, and deletes to the authenticated owner.                                                          |
| Files and media            | Library files are private per account. A selected file must be owned by the active account before it can be linked to a message or provided to an eligible server-side model request.         |
| Tasks and agents           | Tasks, task activities, and reusable task agents are owner-scoped; active agents are validated before a task can be assigned to them.                                                         |
| Streaming and voice        | The server authenticates each stream request. Browser microphone data is transcribed through the configured server path; raw microphone recordings are not persisted by KSEMO.                |
| Input safety               | Request contracts validate IDs, text limits, lifecycle values, attachment types, and file-size limits before database or provider access.                                                     |

## Search Scope

The server-side workspace search remains ownership-scoped across projects, files, tasks, task activities, and memories. In the visible KSEMO search interface, the direct filters intentionally show **Chats, Files, Tasks, and Memories** only. This preserves the user-requested focused interface: Projects and Activity are not exposed as standalone visible filters or result groups.

## Recoverability

Edited user turns retain version history. Restoring a prior version preserves the current version, replaces the associated assistant response in its original slot, and starts a fresh generation. Failed assistant messages expose a distinct retry action, while successful responses retain a separate regenerate action.
