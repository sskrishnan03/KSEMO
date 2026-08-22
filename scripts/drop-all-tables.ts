import 'dotenv/config';
import postgres from 'postgres';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL is required');
}

const sql = postgres(connectionString);

async function dropAllTables() {
  console.log('Dropping all tables...');
  
  // Drop all tables in the correct order (respecting foreign keys)
  const tables = [
    'task_activities',
    'task_agents',
    'tasks',
    'message_feedback',
    'message_versions',
    'message_files',
    'attachments',
    'memories',
    'voice_sessions',
    'user_preferences',
    'messages',
    'conversations',
    'files',
    'projects',
    'users'
  ];

  for (const table of tables) {
    try {
      await sql`DROP TABLE IF EXISTS ${sql(table)} CASCADE`;
      console.log(`Dropped table: ${table}`);
    } catch (error) {
      console.error(`Failed to drop table ${table}:`, error);
    }
  }

  // Drop enums
  const enums = [
    'userRole',
    'conversationType',
    'messageRole',
    'messageStatus',
    'persona',
    'feedbackValue',
    'fileStatus',
    'memoryCategory',
    'taskStatus',
    'taskPriority',
    'taskAgentRole',
    'taskAgentStatus',
    'taskActivityStatus',
    'voiceSessionStatus'
  ];

  for (const enumName of enums) {
    try {
      await sql`DROP TYPE IF EXISTS ${sql(enumName)}`;
      console.log(`Dropped enum: ${enumName}`);
    } catch (error) {
      console.error(`Failed to drop enum ${enumName}:`, error);
    }
  }

  console.log('All tables and enums dropped successfully!');
  await sql.end();
}

dropAllTables().catch(console.error);
