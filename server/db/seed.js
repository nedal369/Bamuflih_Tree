const db = require('./database');
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');

console.log('Seeding database...');

// Create admin user
const passwordHash = bcrypt.hashSync('admin123', 10);
const existingUser = db.prepare('SELECT id FROM users WHERE username = ?').get('admin');
if (!existingUser) {
  db.prepare('INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)').run('admin', passwordHash, 'admin');
  console.log('Admin user created (admin / admin123)');
}

// Check if members already exist
const memberCount = db.prepare('SELECT COUNT(*) as count FROM members').get().count;
if (memberCount > 0) {
  console.log(`Members already exist (${memberCount}). Skipping.`);
  process.exit(0);
}

// Try to import from Excel file if it exists
const xlsxPath = path.join(__dirname, '..', '..', 'شجرة_عائلة_بامفلح_ثلاثي.xlsx');
if (fs.existsSync(xlsxPath)) {
  console.log('Found Excel file, importing...');
  require('./import-excel');
} else {
  console.log('No Excel file found. Run import-excel.js manually to import data.');
}

console.log('Done!');
