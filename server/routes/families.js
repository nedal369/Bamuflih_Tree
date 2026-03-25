const express = require('express');
const db = require('../db/database');
const { authenticateToken } = require('../middleware/auth');
const { logActivity } = require('./activityLog');

const router = express.Router();

// Get all allied families with member counts
router.get('/', (req, res) => {
  const families = db.prepare(`
    SELECT af.*, COUNT(m.id) as member_count
    FROM allied_families af
    LEFT JOIN members m ON m.family_id = af.id
    GROUP BY af.id
    ORDER BY af.name
  `).all();
  res.json(families);
});

// Get single family with its members
router.get('/:id', (req, res) => {
  const family = db.prepare('SELECT * FROM allied_families WHERE id = ?').get(req.params.id);
  if (!family) return res.status(404).json({ error: 'العائلة غير موجودة' });

  const members = db.prepare('SELECT * FROM members WHERE family_id = ? ORDER BY generation, name').all(req.params.id);

  // Find marriage connections to our main tree (family_id IS NULL = main tree)
  const connections = db.prepare(`
    SELECT m.name as allied_member, m.id as allied_id,
           CASE
             WHEN mar.husband_id = m.id THEN (SELECT name FROM members WHERE id = mar.wife_id)
             ELSE (SELECT name FROM members WHERE id = mar.husband_id)
           END as main_member,
           CASE
             WHEN mar.husband_id = m.id THEN mar.wife_id
             ELSE mar.husband_id
           END as main_id,
           mar.status as marriage_status
    FROM marriages mar
    JOIN members m ON (m.id = mar.husband_id OR m.id = mar.wife_id) AND m.family_id = ?
    WHERE EXISTS (
      SELECT 1 FROM members m2 WHERE (m2.id = mar.husband_id OR m2.id = mar.wife_id) AND m2.id != m.id AND (m2.family_id IS NULL OR m2.family_id != ?)
    )
  `).all(req.params.id, req.params.id);

  res.json({ ...family, members, connections, member_count: members.length });
});

// Create allied family
router.post('/', authenticateToken, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'غير مصرح' });

  const { name, description } = req.body;
  if (!name) return res.status(400).json({ error: 'اسم العائلة مطلوب' });

  const result = db.prepare('INSERT INTO allied_families (name, description) VALUES (?, ?)').run(name, description || null);
  const family = db.prepare('SELECT * FROM allied_families WHERE id = ?').get(result.lastInsertRowid);

  logActivity('create', 'family', family.id, name, `إنشاء عائلة حليفة: ${name}`, null, JSON.stringify(family), req.user);
  res.status(201).json(family);
});

// Update allied family
router.put('/:id', authenticateToken, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'غير مصرح' });

  const existing = db.prepare('SELECT * FROM allied_families WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'العائلة غير موجودة' });

  const { name, description } = req.body;
  db.prepare('UPDATE allied_families SET name = ?, description = ? WHERE id = ?').run(
    name || existing.name, description !== undefined ? description : existing.description, req.params.id
  );

  const updated = db.prepare('SELECT * FROM allied_families WHERE id = ?').get(req.params.id);
  logActivity('update', 'family', updated.id, updated.name, `تعديل عائلة: ${updated.name}`, JSON.stringify(existing), JSON.stringify(updated), req.user);
  res.json(updated);
});

// Delete allied family (moves members to orphaned state, not delete them)
router.delete('/:id', authenticateToken, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'غير مصرح' });

  const existing = db.prepare('SELECT * FROM allied_families WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'العائلة غير موجودة' });

  // Unlink members from this family
  db.prepare('UPDATE members SET family_id = NULL WHERE family_id = ?').run(req.params.id);
  db.prepare('DELETE FROM allied_families WHERE id = ?').run(req.params.id);

  logActivity('delete', 'family', existing.id, existing.name, `حذف عائلة: ${existing.name}`, JSON.stringify(existing), null, req.user);
  res.json({ message: 'تم حذف العائلة بنجاح' });
});

// Add member to family
router.post('/:id/members', authenticateToken, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'غير مصرح' });

  const family = db.prepare('SELECT * FROM allied_families WHERE id = ?').get(req.params.id);
  if (!family) return res.status(404).json({ error: 'العائلة غير موجودة' });

  const { name, father_id, gender, birth_date, death_date, bio, phone, mother_name, city, nationality, occupation, work_type, work_place } = req.body;

  if (!name) return res.status(400).json({ error: 'الاسم مطلوب' });

  let gen = 1;
  if (father_id) {
    const father = db.prepare('SELECT generation FROM members WHERE id = ?').get(father_id);
    if (father) gen = father.generation + 1;
  }

  const result = db.prepare(`
    INSERT INTO members (name, father_id, gender, birth_date, death_date, bio, phone, mother_name, city, nationality, occupation, work_type, work_place, generation, family_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(name, father_id || null, gender || 'male', birth_date || null, death_date || null, bio || null, phone || null, mother_name || null, city || null, nationality || null, occupation || null, work_type || null, work_place || null, gen, req.params.id);

  const member = db.prepare('SELECT * FROM members WHERE id = ?').get(result.lastInsertRowid);
  logActivity('create', 'member', member.id, member.name, `إضافة عضو لعائلة ${family.name}: ${member.name}`, null, JSON.stringify(member), req.user);
  res.status(201).json(member);
});

module.exports = router;
