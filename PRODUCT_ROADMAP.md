# KSEMO Product Roadmap

## Durable domain model

| Domain        | Records                                                           | Ownership and behavior                                                                                                                                                                                             |
| ------------- | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Conversations | `conversations`, `messages`, `messageVersions`, `messageFeedback` | Every record remains user-owned. Conversations can be pinned, archived, trashed, restored, duplicated, exported, and attached to a project without creating visual duplicates.                                     |
| Projects      | `projects`                                                        | A user-owned workspace carries a name, optional description, instructions, and archived state. A conversation belongs to zero or one project; project instructions are included server-side in generation context. |
| Files         | `files`, `attachments`                                            | Bytes live in configured object storage; the database holds owner-scoped metadata, processing state, optional project/conversation links, and message attachment references.                                       |
| Memory        | `memories`                                                        | Memory is explicit and user-controlled. It contains a concise content item, category, active state, optional project/conversation source, and deletion control; it is not inferred from every conversation.        |
| Tasks         | `tasks`                                                           | A user-owned task can link to a project or conversation, has explicit status and priority, and remains a real organizational record rather than an implied autonomous action.                                      |
| Voice         | `voiceSessions`                                                   | Voice sessions retain lifecycle metadata only and attach to the same canonical conversation; raw microphone audio is not retained as history.                                                                      |

## Capability boundaries

KSEMO will provide actual database-backed interfaces only where the corresponding backend contract exists. The current AI service supports text streaming, configured model selection, system instructions, and Whisper transcription. Files are uploaded to storage only after validation and are not asserted to be AI-readable unless a configured provider can process their type. The task area is a durable planner in this increment; autonomous background agent execution requires a separate provider and scheduling boundary and will not be implied by a decorative button.

## Delivery order

First, KSEMO adds archive, trash, restore, duplicate, export, message edits, regeneration, feedback, and project membership to conversations. Second, it introduces user-owned project, file, memory, and task records with protected APIs and usable management views. Third, it expands global search and sidebar discovery, then reinforces the result with accessibility, keyboard behavior, error states, ownership tests, responsive inspection, and production validation.
