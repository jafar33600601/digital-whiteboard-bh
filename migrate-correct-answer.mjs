import { createConnection } from "mysql2/promise";

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  console.error("DATABASE_URL not found in environment");
  process.exit(1);
}

const conn = await createConnection(dbUrl);

try {
  // التحقق من وجود العمود أولاً
  const [rows] = await conn.execute(
    "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'wheel_questions' AND COLUMN_NAME = 'correctAnswer'"
  );
  
  if (rows.length === 0) {
    await conn.execute("ALTER TABLE wheel_questions ADD COLUMN correctAnswer int");
    console.log("✅ Migration applied: correctAnswer column added");
  } else {
    console.log("ℹ️ Column correctAnswer already exists, skipping");
  }
} catch (err) {
  console.error("Migration error:", err.message);
} finally {
  await conn.end();
  process.exit(0);
}
