CREATE TYPE "public"."conversationType" AS ENUM('text', 'voice', 'mixed');--> statement-breakpoint
CREATE TYPE "public"."feedbackValue" AS ENUM('up', 'down');--> statement-breakpoint
CREATE TYPE "public"."fileStatus" AS ENUM('ready', 'failed');--> statement-breakpoint
CREATE TYPE "public"."memoryCategory" AS ENUM('preference', 'fact', 'project', 'instruction');--> statement-breakpoint
CREATE TYPE "public"."messageRole" AS ENUM('user', 'assistant', 'system', 'tool');--> statement-breakpoint
CREATE TYPE "public"."messageStatus" AS ENUM('sending', 'streaming', 'completed', 'failed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."persona" AS ENUM('balanced', 'concise', 'creative', 'analytical');--> statement-breakpoint
CREATE TYPE "public"."taskActivityStatus" AS ENUM('queued', 'running', 'completed', 'failed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."taskAgentRole" AS ENUM('assistant', 'specialist', 'custom');--> statement-breakpoint
CREATE TYPE "public"."taskAgentStatus" AS ENUM('active', 'disabled');--> statement-breakpoint
CREATE TYPE "public"."taskPriority" AS ENUM('low', 'medium', 'high');--> statement-breakpoint
CREATE TYPE "public"."taskStatus" AS ENUM('inbox', 'planned', 'in_progress', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."userRole" AS ENUM('user', 'admin');--> statement-breakpoint
CREATE TYPE "public"."voiceSessionStatus" AS ENUM('connecting', 'listening', 'speaking', 'processing', 'interrupted', 'ended', 'error');--> statement-breakpoint
CREATE TABLE "attachments" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"fileId" varchar(36) NOT NULL,
	"conversationId" varchar(36),
	"messageId" varchar(36),
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "conversations" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"projectId" varchar(36),
	"title" varchar(120) DEFAULT 'New conversation' NOT NULL,
	"conversationType" "conversationType" DEFAULT 'text' NOT NULL,
	"isPinned" boolean DEFAULT false NOT NULL,
	"isArchived" boolean DEFAULT false NOT NULL,
	"isPublic" boolean DEFAULT false NOT NULL,
	"shareToken" varchar(64),
	"deletedAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "files" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"projectId" varchar(36),
	"storageKey" varchar(512) NOT NULL,
	"url" varchar(1024) NOT NULL,
	"filename" varchar(255) NOT NULL,
	"mimeType" varchar(160) NOT NULL,
	"sizeBytes" integer NOT NULL,
	"status" "fileStatus" DEFAULT 'ready' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "memories" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"projectId" varchar(36),
	"category" "memoryCategory" DEFAULT 'fact' NOT NULL,
	"content" text NOT NULL,
	"isActive" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "messageFeedback" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"messageId" varchar(36) NOT NULL,
	"userId" integer NOT NULL,
	"value" "feedbackValue" NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "messageVersions" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"messageId" varchar(36) NOT NULL,
	"content" text NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"conversationId" varchar(36) NOT NULL,
	"role" "messageRole" NOT NULL,
	"content" text NOT NULL,
	"model" varchar(160),
	"status" "messageStatus" DEFAULT 'completed' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"name" varchar(120) NOT NULL,
	"description" text,
	"instructions" text,
	"isArchived" boolean DEFAULT false NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "taskActivities" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"taskId" varchar(36) NOT NULL,
	"status" "taskActivityStatus" DEFAULT 'queued' NOT NULL,
	"summary" varchar(500) NOT NULL,
	"detail" text,
	"startedAt" timestamp,
	"completedAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "taskAgents" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"name" varchar(120) NOT NULL,
	"role" "taskAgentRole" DEFAULT 'assistant' NOT NULL,
	"status" "taskAgentStatus" DEFAULT 'active' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tasks" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"agentId" varchar(36),
	"projectId" varchar(36),
	"conversationId" varchar(36),
	"title" varchar(180) NOT NULL,
	"details" text,
	"status" "taskStatus" DEFAULT 'inbox' NOT NULL,
	"priority" "taskPriority" DEFAULT 'medium' NOT NULL,
	"dueAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "userPreferences" (
	"userId" integer PRIMARY KEY NOT NULL,
	"selectedModel" varchar(160),
	"persona" "persona" DEFAULT 'balanced' NOT NULL,
	"customInstructions" text,
	"speechRate" integer DEFAULT 100 NOT NULL,
	"autoPlayResponses" boolean DEFAULT false NOT NULL,
	"reduceMotion" boolean DEFAULT false NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"openId" varchar(64) NOT NULL,
	"name" text,
	"email" varchar(320),
	"loginMethod" varchar(64),
	"passwordHash" text,
	"resetTokenHash" varchar(128),
	"resetTokenExpiresAt" timestamp,
	"role" "userRole" DEFAULT 'user' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"lastSignedIn" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_openId_unique" UNIQUE("openId")
);
--> statement-breakpoint
CREATE TABLE "voiceSessions" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"conversationId" varchar(36) NOT NULL,
	"status" "voiceSessionStatus" DEFAULT 'connecting' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_fileId_files_id_fk" FOREIGN KEY ("fileId") REFERENCES "public"."files"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_conversationId_conversations_id_fk" FOREIGN KEY ("conversationId") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_messageId_messages_id_fk" FOREIGN KEY ("messageId") REFERENCES "public"."messages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_projectId_projects_id_fk" FOREIGN KEY ("projectId") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "files" ADD CONSTRAINT "files_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "files" ADD CONSTRAINT "files_projectId_projects_id_fk" FOREIGN KEY ("projectId") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memories" ADD CONSTRAINT "memories_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memories" ADD CONSTRAINT "memories_projectId_projects_id_fk" FOREIGN KEY ("projectId") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messageFeedback" ADD CONSTRAINT "messageFeedback_messageId_messages_id_fk" FOREIGN KEY ("messageId") REFERENCES "public"."messages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messageFeedback" ADD CONSTRAINT "messageFeedback_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messageVersions" ADD CONSTRAINT "messageVersions_messageId_messages_id_fk" FOREIGN KEY ("messageId") REFERENCES "public"."messages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversationId_conversations_id_fk" FOREIGN KEY ("conversationId") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "taskActivities" ADD CONSTRAINT "taskActivities_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "taskActivities" ADD CONSTRAINT "taskActivities_taskId_tasks_id_fk" FOREIGN KEY ("taskId") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "taskAgents" ADD CONSTRAINT "taskAgents_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_agentId_taskAgents_id_fk" FOREIGN KEY ("agentId") REFERENCES "public"."taskAgents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_projectId_projects_id_fk" FOREIGN KEY ("projectId") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_conversationId_conversations_id_fk" FOREIGN KEY ("conversationId") REFERENCES "public"."conversations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "userPreferences" ADD CONSTRAINT "userPreferences_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "voiceSessions" ADD CONSTRAINT "voiceSessions_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "voiceSessions" ADD CONSTRAINT "voiceSessions_conversationId_conversations_id_fk" FOREIGN KEY ("conversationId") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "attachments_conversation_idx" ON "attachments" USING btree ("conversationId");--> statement-breakpoint
CREATE INDEX "attachments_message_idx" ON "attachments" USING btree ("messageId");--> statement-breakpoint
CREATE INDEX "conversations_user_updated_idx" ON "conversations" USING btree ("userId","updatedAt");--> statement-breakpoint
CREATE INDEX "conversations_user_pinned_idx" ON "conversations" USING btree ("userId","isPinned");--> statement-breakpoint
CREATE UNIQUE INDEX "conversations_share_token_uq" ON "conversations" USING btree ("shareToken");--> statement-breakpoint
CREATE INDEX "conversations_user_deleted_idx" ON "conversations" USING btree ("userId","deletedAt","updatedAt");--> statement-breakpoint
CREATE INDEX "conversations_project_updated_idx" ON "conversations" USING btree ("projectId","updatedAt");--> statement-breakpoint
CREATE INDEX "files_user_created_idx" ON "files" USING btree ("userId","createdAt");--> statement-breakpoint
CREATE INDEX "files_project_created_idx" ON "files" USING btree ("projectId","createdAt");--> statement-breakpoint
CREATE INDEX "memories_user_active_idx" ON "memories" USING btree ("userId","isActive","updatedAt");--> statement-breakpoint
CREATE UNIQUE INDEX "message_feedback_user_message_uidx" ON "messageFeedback" USING btree ("userId","messageId");--> statement-breakpoint
CREATE INDEX "message_versions_message_created_idx" ON "messageVersions" USING btree ("messageId","createdAt");--> statement-breakpoint
CREATE INDEX "messages_conversation_created_idx" ON "messages" USING btree ("conversationId","createdAt");--> statement-breakpoint
CREATE INDEX "projects_user_updated_idx" ON "projects" USING btree ("userId","updatedAt");--> statement-breakpoint
CREATE INDEX "task_activities_task_created_idx" ON "taskActivities" USING btree ("taskId","createdAt");--> statement-breakpoint
CREATE INDEX "task_activities_user_status_updated_idx" ON "taskActivities" USING btree ("userId","status","updatedAt");--> statement-breakpoint
CREATE INDEX "task_agents_user_status_updated_idx" ON "taskAgents" USING btree ("userId","status","updatedAt");--> statement-breakpoint
CREATE INDEX "tasks_user_status_updated_idx" ON "tasks" USING btree ("userId","status","updatedAt");--> statement-breakpoint
CREATE INDEX "tasks_project_updated_idx" ON "tasks" USING btree ("projectId","updatedAt");--> statement-breakpoint
CREATE INDEX "tasks_agent_updated_idx" ON "tasks" USING btree ("agentId","updatedAt");--> statement-breakpoint
CREATE INDEX "users_email_idx" ON "users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "voice_sessions_user_updated_idx" ON "voiceSessions" USING btree ("userId","updatedAt");--> statement-breakpoint
CREATE INDEX "voice_sessions_conversation_idx" ON "voiceSessions" USING btree ("conversationId");