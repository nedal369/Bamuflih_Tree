const express = require('express');
const db = require('../db/database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Build tree structure from flat list
function buildTree(members, parentId = null) {
  return members
    .filter(m => m.father_id === parentId)
    .map(member => ({
      ...member,
      children: buildTree(members, member.id)
    }));
}

// Get all members (flat or tree)
router.get('/', (req, res) => {
  const members = db.prepare('SELECT * FROM members ORDER BY generation, name').all();
  if (req.query.format === 'tree') {
    const tree = buildTree(members);
    return res.json(tree);
  }
  res.json(members);
});

// Get single member
router.get('/:id', (req, res) => {
  const member = db.prepare('SELECT * FROM members WHERE id = ?').get(req.params.id);
  if (!member) {
    return res.status(404).json({ error: 'العضو غير موجود' });
  }
  res.json(member);
});

// Get member's subtree (descendants)
router.get('/:id/subtree', (req, res) => {
  const member = db.prepare('SELECT * FROM members WHERE id = ?').get(req.params.id);
  if (!member) {
    return res.status(404).json({ error: 'العضو غير موجود' });
  }

  const allMembers = db.prepare('SELECT * FROM members').all();

  function getDescendants(parentId) {
    return allMembers
      .filter(m => m.father_id === parentId)
      .map(m => ({
        ...m,
        children: getDescendants(m.id)
      }));
  }

  // Get ancestors path
  function getAncestors(memberId) {
    const ancestors = [];
    let current = allMembers.find(m => m.id === memberId);
    while (current && current.father_id) {
      const parent = allMembers.find(m => m.id === current.father_id);
      if (parent) {
        ancestors.unshift(parent);
        current = parent;
      } else {
        break;
      }
    }
    return ancestors;
  }

  res.json({
    member,
    ancestors: getAncestors(member.id),
    tree: {
      ...member,
      children: getDescendants(member.id)
    }
  });
});

// Create member (admin only)
router.post('/', authenticateToken, (req, res) => {
  const { name, father_id, gender, birth_date, death_date, bio, phone, generation } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'الاسم مطلوب' });
  }

  // Calculate generation
  let gen = generation || 1;
  if (father_id && !generation) {
    const father = db.prepare('SELECT generation FROM members WHERE id = ?').get(father_id);
    if (father) gen = father.generation + 1;
  }

  const result = db.prepare(`
    INSERT INTO members (name, father_id, gender, birth_date, death_date, bio, phone, generation)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(name, father_id || null, gender || 'male', birth_date || null, death_date || null, bio || null, phone || null, gen);

  const newMember = db.prepare('SELECT * FROM members WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(newMember);
});

// Update member (admin only)
router.put('/:id', authenticateToken, (req, res) => {
  const { name, father_id, gender, birth_date, death_date, bio, phone, generation } = req.body;

  const existing = db.prepare('SELECT * FROM members WHERE id = ?').get(req.params.id);
  if (!existing) {
    return res.status(404).json({ error: 'العضو غير موجود' });
  }

  db.prepare(`
    UPDATE members SET name = ?, father_id = ?, gender = ?, birth_date = ?, death_date = ?,
    bio = ?, phone = ?, generation = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(
    name || existing.name,
    father_id !== undefined ? father_id : existing.father_id,
    gender || existing.gender,
    birth_date !== undefined ? birth_date : existing.birth_date,
    death_date !== undefined ? death_date : existing.death_date,
    bio !== undefined ? bio : existing.bio,
    phone !== undefined ? phone : existing.phone,
    generation || existing.generation,
    req.params.id
  );

  const updated = db.prepare('SELECT * FROM members WHERE id = ?').get(req.params.id);
  res.json(updated);
});

// Delete member (admin only)
router.delete('/:id', authenticateToken, (req, res) => {
  const existing = db.prepare('SELECT * FROM members WHERE id = ?').get(req.params.id);
  if (!existing) {
    return res.status(404).json({ error: 'العضو غير موجود' });
  }

  // Update children to have no father
  db.prepare('UPDATE members SET father_id = NULL WHERE father_id = ?').run(req.params.id);
  db.prepare('DELETE FROM members WHERE id = ?').run(req.params.id);

  res.json({ message: 'تم حذف العضو بنجاح' });
});

module.exports = router;
