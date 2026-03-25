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
    work_type TEXT,
    work_place TEXT,
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
    permission_type TEXT DEFAULT 'own_subtree',
    allowed_subtrees TEXT,
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

  CREATE TABLE IF NOT EXISTS activity_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id INTEGER,
    entity_name TEXT,
    details TEXT,
    old_data TEXT,
    new_data TEXT,
    user_id INTEGER REFERENCES users(id),
    username TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS allied_families (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// Add columns if they don't exist (for existing databases)
const memberCols = db.prepare("PRAGMA table_info(members)").all().map(c => c.name);
if (!memberCols.includes('city')) db.exec('ALTER TABLE members ADD COLUMN city TEXT');
if (!memberCols.includes('nationality')) db.exec('ALTER TABLE members ADD COLUMN nationality TEXT');
if (!memberCols.includes('occupation')) db.exec('ALTER TABLE members ADD COLUMN occupation TEXT');
if (!memberCols.includes('work_type')) db.exec('ALTER TABLE members ADD COLUMN work_type TEXT');
if (!memberCols.includes('work_place')) db.exec('ALTER TABLE members ADD COLUMN work_place TEXT');
if (memberCols.includes('spouse_name')) {
  // Migrate old spouse_name data to marriages table if needed
}
if (!memberCols.includes('photo')) db.exec('ALTER TABLE members ADD COLUMN photo TEXT');
if (!memberCols.includes('whatsapp')) db.exec('ALTER TABLE members ADD COLUMN whatsapp TEXT');
if (!memberCols.includes('twitter')) db.exec('ALTER TABLE members ADD COLUMN twitter TEXT');
if (!memberCols.includes('instagram')) db.exec('ALTER TABLE members ADD COLUMN instagram TEXT');
if (!memberCols.includes('snapchat')) db.exec('ALTER TABLE members ADD COLUMN snapchat TEXT');
if (!memberCols.includes('tiktok')) db.exec('ALTER TABLE members ADD COLUMN tiktok TEXT');
if (!memberCols.includes('family_id')) db.exec('ALTER TABLE members ADD COLUMN family_id INTEGER REFERENCES allied_families(id) ON DELETE SET NULL');

const userCols = db.prepare("PRAGMA table_info(users)").all().map(c => c.name);
if (!userCols.includes('full_name')) db.exec('ALTER TABLE users ADD COLUMN full_name TEXT');
if (!userCols.includes('member_id')) db.exec('ALTER TABLE users ADD COLUMN member_id INTEGER REFERENCES members(id) ON DELETE SET NULL');
if (!userCols.includes('status')) db.exec('ALTER TABLE users ADD COLUMN status TEXT DEFAULT \'pending\'');
if (!userCols.includes('permission_type')) db.exec("ALTER TABLE users ADD COLUMN permission_type TEXT DEFAULT 'own_subtree'");
if (!userCols.includes('allowed_subtrees')) db.exec('ALTER TABLE users ADD COLUMN allowed_subtrees TEXT');

// Create marriages table index
db.exec('CREATE INDEX IF NOT EXISTS idx_marriages_husband ON marriages(husband_id)');
db.exec('CREATE INDEX IF NOT EXISTS idx_marriages_wife ON marriages(wife_id)');
db.exec('CREATE INDEX IF NOT EXISTS idx_members_city ON members(city)');
db.exec('CREATE INDEX IF NOT EXISTS idx_activity_log_created ON activity_log(created_at)');
db.exec('CREATE INDEX IF NOT EXISTS idx_members_family ON members(family_id)');

// Auto-seed data if members table is empty
const memberCount = db.prepare('SELECT COUNT(*) as count FROM members').get().count;
if (memberCount === 0) {
  const seedPath = path.join(__dirname, 'seed-data.json');
  const fs = require('fs');
  if (fs.existsSync(seedPath)) {
    console.log('[DB] Members table empty, seeding from seed-data.json...');
    const seedData = JSON.parse(fs.readFileSync(seedPath, 'utf8'));

    const insertMember = db.prepare(`
      INSERT INTO members (id, name, father_id, gender, birth_date, death_date, bio, phone, mother_name, city, nationality, occupation, work_type, work_place, generation)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const insertMarriage = db.prepare(`
      INSERT INTO marriages (id, husband_id, wife_id, wife_name, status, marriage_order)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    const seedAll = db.transaction(() => {
      for (const m of seedData.members) {
        insertMember.run(m.id, m.name, m.father_id, m.gender, m.birth_date, m.death_date, m.bio, m.phone, m.mother_name, m.city, m.nationality, m.occupation, m.work_type || null, m.work_place || null, m.generation);
      }
      for (const mar of seedData.marriages) {
        insertMarriage.run(mar.id, mar.husband_id, mar.wife_id, mar.wife_name, mar.status, mar.marriage_order);
      }
    });
    seedAll();
    console.log(`[DB] Seeded ${seedData.members.length} members and ${seedData.marriages.length} marriages`);
  } else {
    console.log('[DB] No seed-data.json found, starting with empty database');
  }
}

// Ensure admin user exists and is approved
const bcrypt = require('bcryptjs');
const existingAdmin = db.prepare('SELECT id, status, role FROM users WHERE username = ?').get('admin');
if (!existingAdmin) {
  const passwordHash = bcrypt.hashSync('admin123', 10);
  db.prepare('INSERT INTO users (username, password_hash, full_name, role, status) VALUES (?, ?, ?, ?, ?)').run(
    'admin', passwordHash, 'مدير النظام', 'admin', 'approved'
  );
  console.log('[DB] Admin user created (admin/admin123)');
} else {
  // Always force admin to be approved with admin role
  db.prepare('UPDATE users SET role = ?, status = ? WHERE username = ?').run('admin', 'approved', 'admin');
  console.log('[DB] Admin user ensured approved, was:', existingAdmin.role, existingAdmin.status);
}

module.exports = db;
