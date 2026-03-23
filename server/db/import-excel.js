const XLSX = require('xlsx');
const path = require('path');
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');

const dbPath = path.join(__dirname, '..', '..', 'family.db');
const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Recreate tables
db.exec(`DROP TABLE IF EXISTS marriages`);
db.exec(`DROP TABLE IF EXISTS members`);
db.exec(`
  CREATE TABLE members (
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
  CREATE TABLE marriages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    husband_id INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    wife_id INTEGER REFERENCES members(id) ON DELETE SET NULL,
    wife_name TEXT,
    status TEXT CHECK(status IN ('married', 'divorced', 'widowed', 'deceased')) DEFAULT 'married',
    marriage_order INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX idx_marriages_husband ON marriages(husband_id);
`);

// Ensure users table and admin
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    full_name TEXT,
    password_hash TEXT NOT NULL,
    role TEXT DEFAULT 'pending',
    member_id INTEGER,
    status TEXT DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// Add columns if missing
const userCols = db.prepare("PRAGMA table_info(users)").all().map(c => c.name);
if (!userCols.includes('full_name')) db.exec('ALTER TABLE users ADD COLUMN full_name TEXT');
if (!userCols.includes('member_id')) db.exec('ALTER TABLE users ADD COLUMN member_id INTEGER');
if (!userCols.includes('status')) db.exec("ALTER TABLE users ADD COLUMN status TEXT DEFAULT 'pending'");

const passwordHash = bcrypt.hashSync('admin123', 10);
const existingUser = db.prepare('SELECT id FROM users WHERE username = ?').get('admin');
if (!existingUser) {
  db.prepare('INSERT INTO users (username, password_hash, full_name, role, status) VALUES (?, ?, ?, ?, ?)').run('admin', passwordHash, 'مدير النظام', 'admin', 'approved');
  console.log('Admin user created (admin / admin123)');
} else {
  // Ensure admin is approved
  db.prepare('UPDATE users SET role = ?, status = ? WHERE username = ?').run('admin', 'approved', 'admin');
}

// Find Excel file (prefer newest)
const files = ['Full tree.xlsx', 'شجرة_عائلة_بامفلح_كاملة_1.xlsx', 'شجرة_عائلة_بامفلح_ثلاثي.xlsx'];
let xlsxPath;
for (const f of files) {
  const p = path.join(__dirname, '..', '..', f);
  try { require('fs').accessSync(p); xlsxPath = p; break; } catch {}
}

if (!xlsxPath) {
  console.log('No Excel file found. Skipping import.');
  process.exit(0);
}

console.log(`Importing from: ${path.basename(xlsxPath)}`);

const workbook = XLSX.readFile(xlsxPath);
const sheet = workbook.Sheets[workbook.SheetNames[0]];
const rows = XLSX.utils.sheet_to_json(sheet);

console.log(`Read ${rows.length} rows`);

// Parse bio field to extract city, nationality, occupation
function parseBio(bio) {
  if (!bio) return { occupation: null, city: null, nationality: null, cleanBio: null };
  const parts = bio.split(' - ').map(s => s.trim()).filter(Boolean);
  // Common pattern: "occupation - city - nationality"
  let occupation = null, city = null, nationality = null;
  if (parts.length >= 3) {
    occupation = parts[0] === 'لا يعمل' ? null : parts[0];
    city = parts[1];
    nationality = parts[2];
  } else if (parts.length === 2) {
    city = parts[0];
    nationality = parts[1];
  }
  return { occupation, city, nationality, cleanBio: bio };
}

// Map rows - support both old and new column formats
const mapped = rows.map(row => {
  // New format has separate columns; old format has combined 'ملاحظات'
  const bio = row['ملاحظات'] || row['الحالة'] || null;
  const parsed = parseBio(bio);
  const phone = row['الهاتف'] ? String(Math.round(row['الهاتف'])) : null;

  return {
    name: row['الاسم'],
    father_name: row['اسم الأب'] || null,
    mother_name: row['الأم'] || null,
    spouse_name: row['الزوج/الزوجة'] || null,
    gender: row['الجنس'] === 'أنثى' ? 'female' : 'male',
    birth_date: row['تاريخ الميلاد'] || null,
    death_date: row['تاريخ الوفاة'] === 'متوفى' || row['تاريخ الوفاة'] === 'متوفي' ? 'متوفى' : (row['تاريخ الوفاة'] || null),
    bio: row['الحالة'] || parsed.cleanBio,
    phone,
    city: row['مكان الإقامة'] || row['المدينة'] || parsed.city || null,
    nationality: row['الجنسية'] || parsed.nationality || null,
    occupation: row['العمل'] || parsed.occupation || null,
    generation: row['الجيل'] || 1,
  };
});

// Pass 1: Insert all members without father_id
const insert = db.prepare(`
  INSERT INTO members (name, gender, birth_date, death_date, bio, phone, mother_name, city, nationality, occupation, generation)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const insertMany = db.transaction(() => {
  for (const m of mapped) {
    insert.run(m.name, m.gender, m.birth_date, m.death_date, m.bio, m.phone, m.mother_name, m.city, m.nationality, m.occupation, m.generation);
  }
});
insertMany();
console.log(`Inserted ${mapped.length} members`);

// Pass 2: Link father_id
const allMembers = db.prepare('SELECT id, name FROM members').all();
const nameToId = new Map();
for (const m of allMembers) nameToId.set(m.name, m.id);

const updateFather = db.prepare('UPDATE members SET father_id = ? WHERE id = ?');
const linkParents = db.transaction(() => {
  let linked = 0;
  for (const m of mapped) {
    if (!m.father_name) continue;
    const memberId = nameToId.get(m.name);
    const fatherId = nameToId.get(m.father_name);
    if (memberId && fatherId) { updateFather.run(fatherId, memberId); linked++; }
  }
  console.log(`Linked ${linked} parent-child relationships`);
});
linkParents();

// Pass 3: Create marriages from spouse_name data
const insertMarriage = db.prepare('INSERT INTO marriages (husband_id, wife_id, wife_name, status, marriage_order) VALUES (?, ?, ?, ?, ?)');
const createMarriages = db.transaction(() => {
  let count = 0;
  const processed = new Set();

  for (const m of mapped) {
    if (!m.spouse_name || m.gender !== 'male') continue;
    const husbandId = nameToId.get(m.name);
    if (!husbandId || processed.has(husbandId)) continue;

    // Find all wives for this husband
    const wives = mapped.filter(w => w.spouse_name === m.name && w.gender === 'female');
    wives.forEach((wife, i) => {
      const wifeId = nameToId.get(wife.name) || null;
      const isDeceased = wife.death_date ? 'deceased' : 'married';
      insertMarriage.run(husbandId, wifeId, wife.name, isDeceased, i + 1);
      count++;
    });

    // Also check if someone listed this male as their spouse
    if (wives.length === 0) {
      const wifeId = nameToId.get(m.spouse_name) || null;
      const wife = mapped.find(w => w.name === m.spouse_name);
      const isDeceased = wife?.death_date ? 'deceased' : 'married';
      insertMarriage.run(husbandId, wifeId, m.spouse_name, isDeceased, 1);
      count++;
    }

    processed.add(husbandId);
  }
  console.log(`Created ${count} marriages`);
});
createMarriages();

// Verify
const total = db.prepare('SELECT COUNT(*) as count FROM members').get().count;
const marriages = db.prepare('SELECT COUNT(*) as count FROM marriages').get().count;
const cities = db.prepare("SELECT city, COUNT(*) as c FROM members WHERE city IS NOT NULL AND city != '' GROUP BY city ORDER BY c DESC").all();

console.log(`\nSummary:`);
console.log(`  Total members: ${total}`);
console.log(`  Total marriages: ${marriages}`);
console.log(`  Cities: ${cities.map(c => `${c.city}(${c.c})`).join(', ')}`);
console.log('Done!');
