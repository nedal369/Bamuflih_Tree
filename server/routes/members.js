const express = require('express');
const db = require('../db/database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Attach marriages to members
function attachMarriages(members) {
  const allMarriages = db.prepare('SELECT * FROM marriages ORDER BY marriage_order').all();
  const marriageMap = new Map();
  for (const m of allMarriages) {
    if (!marriageMap.has(m.husband_id)) marriageMap.set(m.husband_id, []);
    marriageMap.get(m.husband_id).push(m);
  }
  return members.map(m => ({ ...m, marriages: marriageMap.get(m.id) || [] }));
}

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
  const withMarriages = attachMarriages(members);

  if (req.query.format === 'tree') {
    const tree = buildTree(withMarriages);
    return res.json(tree);
  }
  res.json(withMarriages);
});

// Get single member
router.get('/:id', (req, res) => {
  const member = db.prepare('SELECT * FROM members WHERE id = ?').get(req.params.id);
  if (!member) {
    return res.status(404).json({ error: 'العضو غير موجود' });
  }
  const marriages = db.prepare('SELECT * FROM marriages WHERE husband_id = ? OR wife_id = ? ORDER BY marriage_order').all(member.id, member.id);
  res.json({ ...member, marriages });
});

// Get member's subtree (descendants)
router.get('/:id/subtree', (req, res) => {
  const member = db.prepare('SELECT * FROM members WHERE id = ?').get(req.params.id);
  if (!member) {
    return res.status(404).json({ error: 'العضو غير موجود' });
  }

  const allMembers = attachMarriages(db.prepare('SELECT * FROM members').all());

  function getDescendants(parentId) {
    return allMembers
      .filter(m => m.father_id === parentId)
      .map(m => ({
        ...m,
        children: getDescendants(m.id)
      }));
  }

  function getAncestors(memberId) {
    const ancestors = [];
    let current = allMembers.find(m => m.id === memberId);
    while (current && current.father_id) {
      const parent = allMembers.find(m => m.id === current.father_id);
      if (parent) {
        ancestors.unshift(parent);
        current = parent;
      } else break;
    }
    return ancestors;
  }

  const memberWithMarriages = allMembers.find(m => m.id === member.id) || member;

  res.json({
    member: memberWithMarriages,
    ancestors: getAncestors(member.id),
    tree: {
      ...memberWithMarriages,
      children: getDescendants(member.id)
    }
  });
});

// Create member (admin only)
router.post('/', authenticateToken, (req, res) => {
  const { name, father_id, gender, birth_date, death_date, bio, phone, mother_name, city, nationality, occupation, work_type, work_place, generation } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'الاسم مطلوب' });
  }

  let gen = generation || 1;
  if (father_id && !generation) {
    const father = db.prepare('SELECT generation FROM members WHERE id = ?').get(father_id);
    if (father) gen = father.generation + 1;
  }

  const result = db.prepare(`
    INSERT INTO members (name, father_id, gender, birth_date, death_date, bio, phone, mother_name, city, nationality, occupation, work_type, work_place, generation)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(name, father_id || null, gender || 'male', birth_date || null, death_date || null, bio || null, phone || null, mother_name || null, city || null, nationality || null, occupation || null, work_type || null, work_place || null, gen);

  const newMember = db.prepare('SELECT * FROM members WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(newMember);
});

// Update member (admin or own member)
router.put('/:id', authenticateToken, (req, res) => {
  const { name, father_id, gender, birth_date, death_date, bio, phone, mother_name, city, nationality, occupation, work_type, work_place, generation } = req.body;

  // Allow admin or member editing their own subtree
  if (req.user.role !== 'admin' && req.user.member_id) {
    // Check if target member is in user's subtree
    const canEdit = isInSubtree(req.user.member_id, parseInt(req.params.id));
    if (!canEdit) return res.status(403).json({ error: 'غير مصرح بتعديل هذا العضو' });
  } else if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'غير مصرح' });
  }

  const existing = db.prepare('SELECT * FROM members WHERE id = ?').get(req.params.id);
  if (!existing) {
    return res.status(404).json({ error: 'العضو غير موجود' });
  }

  db.prepare(`
    UPDATE members SET name = ?, father_id = ?, gender = ?, birth_date = ?, death_date = ?,
    bio = ?, phone = ?, mother_name = ?, city = ?, nationality = ?, occupation = ?, work_type = ?, work_place = ?, generation = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(
    name || existing.name,
    father_id !== undefined ? father_id : existing.father_id,
    gender || existing.gender,
    birth_date !== undefined ? birth_date : existing.birth_date,
    death_date !== undefined ? death_date : existing.death_date,
    bio !== undefined ? bio : existing.bio,
    phone !== undefined ? phone : existing.phone,
    mother_name !== undefined ? mother_name : existing.mother_name,
    city !== undefined ? city : existing.city,
    nationality !== undefined ? nationality : existing.nationality,
    occupation !== undefined ? occupation : existing.occupation,
    work_type !== undefined ? work_type : existing.work_type,
    work_place !== undefined ? work_place : existing.work_place,
    generation || existing.generation,
    req.params.id
  );

  const updated = db.prepare('SELECT * FROM members WHERE id = ?').get(req.params.id);
  res.json(updated);
});

// Delete member (admin only)
router.delete('/:id', authenticateToken, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'غير مصرح' });

  const existing = db.prepare('SELECT * FROM members WHERE id = ?').get(req.params.id);
  if (!existing) {
    return res.status(404).json({ error: 'العضو غير موجود' });
  }

  db.prepare('UPDATE members SET father_id = NULL WHERE father_id = ?').run(req.params.id);
  db.prepare('DELETE FROM marriages WHERE husband_id = ? OR wife_id = ?').run(req.params.id, req.params.id);
  db.prepare('DELETE FROM members WHERE id = ?').run(req.params.id);

  res.json({ message: 'تم حذف العضو بنجاح' });
});

// Marriages CRUD
router.post('/:id/marriages', authenticateToken, (req, res) => {
  const { wife_name, wife_id, status, marriage_order } = req.body;

  const order = marriage_order || (db.prepare('SELECT MAX(marriage_order) as max FROM marriages WHERE husband_id = ?').get(req.params.id)?.max || 0) + 1;

  const result = db.prepare(
    'INSERT INTO marriages (husband_id, wife_id, wife_name, status, marriage_order) VALUES (?, ?, ?, ?, ?)'
  ).run(req.params.id, wife_id || null, wife_name || null, status || 'married', order);

  const marriage = db.prepare('SELECT * FROM marriages WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(marriage);
});

router.put('/marriages/:id', authenticateToken, (req, res) => {
  const { wife_name, wife_id, status } = req.body;
  const existing = db.prepare('SELECT * FROM marriages WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'غير موجود' });

  db.prepare('UPDATE marriages SET wife_name = ?, wife_id = ?, status = ? WHERE id = ?').run(
    wife_name !== undefined ? wife_name : existing.wife_name,
    wife_id !== undefined ? wife_id : existing.wife_id,
    status || existing.status,
    req.params.id
  );
  res.json(db.prepare('SELECT * FROM marriages WHERE id = ?').get(req.params.id));
});

router.delete('/marriages/:id', authenticateToken, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'غير مصرح' });
  db.prepare('DELETE FROM marriages WHERE id = ?').run(req.params.id);
  res.json({ message: 'تم الحذف' });
});

// Helper: check if targetId is in subtree of rootId
function isInSubtree(rootId, targetId) {
  if (rootId === targetId) return true;
  const children = db.prepare('SELECT id FROM members WHERE father_id = ?').all(rootId);
  for (const child of children) {
    if (isInSubtree(child.id, targetId)) return true;
  }
  return false;
}

module.exports = router;
