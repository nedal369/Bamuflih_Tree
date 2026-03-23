const db = require('./database');
const bcrypt = require('bcryptjs');

console.log('Seeding database...');

// Create admin user
const passwordHash = bcrypt.hashSync('admin123', 10);
const existingUser = db.prepare('SELECT id FROM users WHERE username = ?').get('admin');
if (!existingUser) {
  db.prepare('INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)').run('admin', passwordHash, 'admin');
  console.log('Admin user created (admin / admin123)');
}

// Check if members already seeded
const memberCount = db.prepare('SELECT COUNT(*) as count FROM members').get().count;
if (memberCount > 0) {
  console.log('Members already seeded. Skipping.');
  process.exit(0);
}

// Seed Bamuflih family tree
const insert = db.prepare(`
  INSERT INTO members (id, name, father_id, gender, birth_date, death_date, bio, generation)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`);

const members = [
  // Generation 1 - الجد الأكبر
  [1, 'مفلح بن سالم بامفلح', null, 'male', '1880', '1960', 'الجد المؤسس لعائلة آل بامفلح', 1],

  // Generation 2 - الأبناء
  [2, 'سالم بن مفلح بامفلح', 1, 'male', '1910', '1985', 'الابن الأكبر', 2],
  [3, 'عبدالله بن مفلح بامفلح', 1, 'male', '1915', '1990', '', 2],
  [4, 'محمد بن مفلح بامفلح', 1, 'male', '1920', '1995', '', 2],
  [5, 'أحمد بن مفلح بامفلح', 1, 'male', '1925', '2000', '', 2],

  // Generation 3 - أبناء سالم
  [6, 'مفلح بن سالم بامفلح', 2, 'male', '1940', null, '', 3],
  [7, 'عمر بن سالم بامفلح', 2, 'male', '1943', null, '', 3],
  [8, 'خالد بن سالم بامفلح', 2, 'male', '1946', '2020', '', 3],

  // Generation 3 - أبناء عبدالله
  [9, 'سعيد بن عبدالله بامفلح', 3, 'male', '1942', null, '', 3],
  [10, 'فهد بن عبدالله بامفلح', 3, 'male', '1945', null, '', 3],
  [11, 'نورة بنت عبدالله بامفلح', 3, 'female', '1948', null, '', 3],

  // Generation 3 - أبناء محمد
  [12, 'علي بن محمد بامفلح', 4, 'male', '1948', null, '', 3],
  [13, 'حسن بن محمد بامفلح', 4, 'male', '1950', null, '', 3],
  [14, 'فاطمة بنت محمد بامفلح', 4, 'female', '1952', null, '', 3],

  // Generation 3 - أبناء أحمد
  [15, 'يوسف بن أحمد بامفلح', 5, 'male', '1950', null, '', 3],
  [16, 'إبراهيم بن أحمد بامفلح', 5, 'male', '1953', null, '', 3],

  // Generation 4 - أبناء مفلح بن سالم
  [17, 'سالم بن مفلح بامفلح', 6, 'male', '1965', null, '', 4],
  [18, 'ناصر بن مفلح بامفلح', 6, 'male', '1968', null, '', 4],
  [19, 'عائشة بنت مفلح بامفلح', 6, 'female', '1970', null, '', 4],

  // Generation 4 - أبناء عمر
  [20, 'سالم بن عمر بامفلح', 7, 'male', '1968', null, '', 4],
  [21, 'محمد بن عمر بامفلح', 7, 'male', '1971', null, '', 4],

  // Generation 4 - أبناء سعيد
  [22, 'عبدالله بن سعيد بامفلح', 9, 'male', '1968', null, '', 4],
  [23, 'خالد بن سعيد بامفلح', 9, 'male', '1970', null, '', 4],
  [24, 'مريم بنت سعيد بامفلح', 9, 'female', '1972', null, '', 4],

  // Generation 4 - أبناء علي
  [25, 'محمد بن علي بامفلح', 12, 'male', '1975', null, '', 4],
  [26, 'أحمد بن علي بامفلح', 12, 'male', '1978', null, '', 4],

  // Generation 4 - أبناء يوسف
  [27, 'أحمد بن يوسف بامفلح', 15, 'male', '1975', null, '', 4],
  [28, 'سارة بنت يوسف بامفلح', 15, 'female', '1978', null, '', 4],

  // Generation 5 - أبناء سالم بن مفلح
  [29, 'مفلح بن سالم بامفلح', 17, 'male', '1990', null, '', 5],
  [30, 'عبدالرحمن بن سالم بامفلح', 17, 'male', '1993', null, '', 5],
  [31, 'نوف بنت سالم بامفلح', 17, 'female', '1995', null, '', 5],

  // Generation 5 - أبناء عبدالله بن سعيد
  [32, 'سعيد بن عبدالله بامفلح', 22, 'male', '1993', null, '', 5],
  [33, 'فيصل بن عبدالله بامفلح', 22, 'male', '1996', null, '', 5],

  // Generation 5 - أبناء محمد بن علي
  [34, 'علي بن محمد بامفلح', 25, 'male', '2000', null, '', 5],
  [35, 'عمر بن محمد بامفلح', 25, 'male', '2003', null, '', 5],
];

const insertMany = db.transaction((members) => {
  for (const m of members) {
    insert.run(...m);
  }
});

insertMany(members);
console.log(`Seeded ${members.length} family members`);
console.log('Done!');
