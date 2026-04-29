import { drizzle } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  console.error('DATABASE_URL not set');
  process.exit(1);
}

const connection = await mysql.createConnection(dbUrl);
const db = drizzle(connection);

const sql = [
  'ALTER TABLE `classrooms` MODIFY COLUMN `userId` int NOT NULL',
  'ALTER TABLE `wheel_questions` MODIFY COLUMN `userId` int NOT NULL',
  'ALTER TABLE `wheel_questions` MODIFY COLUMN `options` longtext NOT NULL',
];

try {
  for (const statement of sql) {
    console.log('Executing:', statement);
    await connection.execute(statement);
  }
  console.log('✓ Migration applied successfully');
} catch (error) {
  console.error('✗ Migration failed:', error.message);
  process.exit(1);
} finally {
  await connection.end();
}
