const XLSX = require('xlsx');
const path = require('path');
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');

const dbPath = path.join(__dirname, '..', '..', 'family.db');
const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Recreate members table with new columns
db.exec(`DROP TABLE IF EXISTS members`);
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
    spouse_name TEXT,
    generation INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// Ensure admin user exists
const passwordHash = bcrypt.hashSync('admin123', 10);
const existingUser = db.prepare('SELECT id FROM users WHERE username = ?').get('admin');
if (!existingUser) {
  db.prepare('INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)').run('admin', passwordHash, 'admin');
  console.log('Admin user created (admin / admin123)');
}

// Read Excel file
const xlsxPath = path.join(__dirname, '..', '..', 'شجرة_عائلة_بامفلح_ثلاثي.xlsx');
const workbook = XLSX.readFile(xlsxPath);
const sheet = workbook.Sheets[workbook.SheetNames[0]];
const rows = XLSX.utils.sheet_to_json(sheet);

console.log(`Read ${rows.length} rows from Excel`);

// Map Arabic column names
const mapped = rows.map(row => ({
  name: row['الاسم'],
  father_name: row['اسم الأب'] || null,
  mother_name: row['الأم'] || null,
  spouse_name: row['الزوج/الزوجة'] || null,
  gender: row['الجنس'] === 'أنثى' ? 'female' : 'male',
  birth_date: row['تاريخ الميلاد'] || null,
  death_date: row['تاريخ الوفاة'] === 'متوفى' ? 'متوفى' : (row['تاريخ الوفاة'] || null),
  bio: row['ملاحظات'] || null,
  phone: row['الهاتف'] ? String(Math.round(row['الهاتف'])) : null,
  generation: row['الجيل'] || 1,
}));

// Pass 1: Insert all members without father_id
const insert = db.prepare(`
  INSERT INTO members (name, gender, birth_date, death_date, bio, phone, mother_name, spouse_name, generation)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const insertMany = db.transaction(() => {
  for (const m of mapped) {
    insert.run(
      m.name,
      m.gender,
      m.birth_date,
      m.death_date,
      m.bio,
      m.phone,
      m.mother_name,
      m.spouse_name,
      m.generation
    );
  }
});

insertMany();
console.log(`Inserted ${mapped.length} members`);

// Pass 2: Link father_id by matching father_name
const allMembers = db.prepare('SELECT id, name FROM members').all();
const nameToId = new Map();
for (const m of allMembers) {
  nameToId.set(m.name, m.id);
}

const updateFather = db.prepare('UPDATE members SET father_id = ? WHERE id = ?');

const linkParents = db.transaction(() => {
  let linked = 0;
  for (const m of mapped) {
    if (!m.father_name) continue;

    const memberId = nameToId.get(m.name);
    const fatherId = nameToId.get(m.father_name);

    if (memberId && fatherId) {
      updateFather.run(fatherId, memberId);
      linked++;
    } else if (memberId && !fatherId) {
      console.log(`  Warning: parent "${m.father_name}" not found for "${m.name}"`);
    }
  }
  console.log(`Linked ${linked} parent-child relationships`);
});

linkParents();

// Verify
const total = db.prepare('SELECT COUNT(*) as count FROM members').get().count;
const withParent = db.prepare('SELECT COUNT(*) as count FROM members WHERE father_id IS NOT NULL').get().count;
const roots = db.prepare('SELECT name, generation FROM members WHERE father_id IS NULL ORDER BY generation').all();

console.log(`\nSummary:`);
console.log(`  Total members: ${total}`);
console.log(`  With parent link: ${withParent}`);
console.log(`  Root members (no parent): ${roots.length}`);
roots.forEach(r => console.log(`    - ${r.name} (Gen ${r.generation})`));

console.log('\nDone!');
