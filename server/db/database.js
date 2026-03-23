const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '..', '..', 'family.db');
const db = new Database(dbPath);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS members (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    father_id INTEGER REFERENCES members(id) ON DELETE SET NULL,
    gender TEXT CHECK(gender IN ('male', 'female')) DEFAULT 'male',
    birth_date TEXT,
    death_date TEXT,
    bio TEXT,
    phone TEXT,
    mother_name TEXT,
    city TEXT,
    nationality TEXT,
    occupation TEXT,
    generation INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS marriages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    husband_id INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    wife_id INTEGER REFERENCES members(id) ON DELETE SET NULL,
    wife_name TEXT,
    status TEXT CHECK(status IN ('married', 'divorced', 'widowed', 'deceased')) DEFAULT 'married',
    marriage_order INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    full_name TEXT,
    password_hash TEXT NOT NULL,
    role TEXT CHECK(role IN ('admin', 'member', 'pending')) DEFAULT 'pending',
    member_id INTEGER REFERENCES members(id) ON DELETE SET NULL,
    status TEXT CHECK(status IN ('approved', 'pending', 'rejected')) DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS uploads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    filename TEXT NOT NULL,
    original_name TEXT NOT NULL,
    file_type TEXT,
    uploaded_by INTEGER REFERENCES users(id),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// Add columns if they don't exist (for existing databases)
const memberCols = db.prepare("PRAGMA table_info(members)").all().map(c => c.name);
if (!memberCols.includes('city')) db.exec('ALTER TABLE members ADD COLUMN city TEXT');
if (!memberCols.includes('nationality')) db.exec('ALTER TABLE members ADD COLUMN nationality TEXT');
if (!memberCols.includes('occupation')) db.exec('ALTER TABLE members ADD COLUMN occupation TEXT');
if (memberCols.includes('spouse_name')) {
  // Migrate old spouse_name data to marriages table if needed
}

const userCols = db.prepare("PRAGMA table_info(users)").all().map(c => c.name);
if (!userCols.includes('full_name')) db.exec('ALTER TABLE users ADD COLUMN full_name TEXT');
if (!userCols.includes('member_id')) db.exec('ALTER TABLE users ADD COLUMN member_id INTEGER REFERENCES members(id) ON DELETE SET NULL');
if (!userCols.includes('status')) db.exec('ALTER TABLE users ADD COLUMN status TEXT DEFAULT \'pending\'');

// Create marriages table index
db.exec('CREATE INDEX IF NOT EXISTS idx_marriages_husband ON marriages(husband_id)');
db.exec('CREATE INDEX IF NOT EXISTS idx_marriages_wife ON marriages(wife_id)');
db.exec('CREATE INDEX IF NOT EXISTS idx_members_city ON members(city)');

// Ensure admin user exists and is approved
const bcrypt = require('bcryptjs');
const existingAdmin = db.prepare('SELECT id, status, role FROM users WHERE username = ?').get('admin');
if (!existingAdmin) {
  const passwordHash = bcrypt.hashSync('admin123', 10);
  db.prepare('INSERT INTO users (username, password_hash, full_name, role, status) VALUES (?, ?, ?, ?, ?)').run(
    'admin', passwordHash, 'مدير النظام', 'admin', 'approved'
  );
} else if (existingAdmin.status !== 'approved' || existingAdmin.role !== 'admin') {
  db.prepare('UPDATE users SET role = ?, status = ? WHERE username = ?').run('admin', 'approved', 'admin');
}

module.exports = db;
