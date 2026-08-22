import 'dotenv/config';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { users } from '../drizzle/schema';

async function testDatabase() {
  console.log('Testing database connection...');
  
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is required');
  }

  const client = postgres(connectionString);
  const db = drizzle(client);

  try {
    // Test basic connection
    const result = await client`SELECT NOW()`;
    console.log('✓ Database connected:', result[0]);

    // Test users table exists and is accessible
    const allUsers = await db.select().from(users);
    console.log('✓ Users table accessible, current user count:', allUsers.length);

    // Test inserting a user
    console.log('Testing user insertion...');
    const testUser = await db.insert(users).values({
      openId: 'test_user_123',
      name: 'Test User',
      email: 'test@example.com',
      loginMethod: 'password',
      passwordHash: 'test_hash',
      lastSignedIn: new Date(),
    }).returning();
    console.log('✓ User inserted:', testUser[0]);

    // Test querying by email
    const foundUser = await db.select().from(users).where(eq(users.email, 'test@example.com'));
    console.log('✓ User found by email:', foundUser[0]);

    // Clean up test user
    await db.delete(users).where(eq(users.openId, 'test_user_123'));
    console.log('✓ Test user cleaned up');

    console.log('\n✅ All database tests passed!');
  } catch (error) {
    console.error('❌ Database test failed:', error);
    throw error;
  } finally {
    await client.end();
  }
}

import { eq } from 'drizzle-orm';
testDatabase().catch(console.error);
