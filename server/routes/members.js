const express = require('express');
const db = require('../db/database');
const { authenticateToken } = require('../middleware/auth');
const upload = require('../middleware/upload');
const { logActivity } = require('./activityLog');

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

// Advanced search with filtering and facets
router.get('/search/advanced', (req, res) => {
  const { q, city, work_place, work_type, occupation, nationality, gender, generation, alive } = req.query;

  const conditions = [];
  const params = [];

  // General text search across name, bio, phone
  if (q) {
    conditions.push('(name LIKE ? OR bio LIKE ? OR phone LIKE ?)');
    const pattern = `%${q}%`;
    params.push(pattern, pattern, pattern);
  }

  // Partial match filters
  if (city) {
    conditions.push('city LIKE ?');
    params.push(`%${city}%`);
  }
  if (work_place) {
    conditions.push('work_place LIKE ?');
    params.push(`%${work_place}%`);
  }
  if (occupation) {
    conditions.push('occupation LIKE ?');
    params.push(`%${occupation}%`);
  }
  if (nationality) {
    conditions.push('nationality LIKE ?');
    params.push(`%${nationality}%`);
  }

  // Exact match filters
  if (work_type) {
    conditions.push('work_type = ?');
    params.push(work_type);
  }
  if (gender) {
    conditions.push('gender = ?');
    params.push(gender);
  }
  if (generation) {
    conditions.push('generation = ?');
    params.push(Number(generation));
  }

  // Alive/deceased filter: alive=true means death_date IS NULL, alive=false means death_date IS NOT NULL
  if (alive !== undefined) {
    if (alive === 'true') {
      conditions.push('death_date IS NULL');
    } else if (alive === 'false') {
      conditions.push('death_date IS NOT NULL');
    }
  }

  const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';
  const sql = `SELECT * FROM members ${whereClause} ORDER BY generation, name`;

  const members = db.prepare(sql).all(...params);
  const results = attachMarriages(members);

  // Build facets/aggregations from the matched results
  const facets = {
    city: {},
    work_type: {},
    occupation: {},
    nationality: {}
  };

  for (const member of members) {
    if (member.city) {
      facets.city[member.city] = (facets.city[member.city] || 0) + 1;
    }
    if (member.work_type) {
      facets.work_type[member.work_type] = (facets.work_type[member.work_type] || 0) + 1;
    }
    if (member.occupation) {
      facets.occupation[member.occupation] = (facets.occupation[member.occupation] || 0) + 1;
    }
    if (member.nationality) {
      facets.nationality[member.nationality] = (facets.nationality[member.nationality] || 0) + 1;
    }
  }

  res.json({
    total: results.length,
    members: results,
    facets
  });
});

// Find relationship between two members
router.get('/relationship/:id1/:id2', (req, res) => {
  const id1 = parseInt(req.params.id1);
  const id2 = parseInt(req.params.id2);

  if (isNaN(id1) || isNaN(id2)) {
    return res.status(400).json({ error: 'معرفات الأعضاء غير صالحة' });
  }

  if (id1 === id2) {
    const member = db.prepare('SELECT * FROM members WHERE id = ?').get(id1);
    if (!member) return res.status(404).json({ error: 'العضو غير موجود' });
    return res.json({
      person1: { id: member.id, name: member.name },
      person2: { id: member.id, name: member.name },
      relationship: 'نفس الشخص',
      lca: { id: member.id, name: member.name },
      path: [{ id: member.id, name: member.name }]
    });
  }

  const allMembers = db.prepare('SELECT * FROM members').all();
  const memberMap = new Map(allMembers.map(m => [m.id, m]));

  const person1 = memberMap.get(id1);
  const person2 = memberMap.get(id2);

  if (!person1) return res.status(404).json({ error: 'العضو الأول غير موجود' });
  if (!person2) return res.status(404).json({ error: 'العضو الثاني غير موجود' });

  // Check direct marriage relationship
  const marriage = db.prepare(
    'SELECT * FROM marriages WHERE (husband_id = ? AND wife_id = ?) OR (husband_id = ? AND wife_id = ?)'
  ).get(id1, id2, id2, id1);

  if (marriage) {
    // Determine who is the husband and who is the wife
    const p1IsWife = marriage.husband_id === id2 && marriage.wife_id === id1;
    const relationship = p1IsWife ? 'زوجة' : 'زوج';
    return res.json({
      person1: { id: person1.id, name: person1.name },
      person2: { id: person2.id, name: person2.name },
      relationship,
      lca: null,
      path: [{ id: person1.id, name: person1.name }, { id: person2.id, name: person2.name }]
    });
  }

  // Build ancestor chain (from member up to root)
  function getAncestorChain(memberId) {
    const chain = [];
    let currentId = memberId;
    const visited = new Set();
    while (currentId != null) {
      if (visited.has(currentId)) break;
      visited.add(currentId);
      const member = memberMap.get(currentId);
      if (!member) break;
      chain.push({ id: member.id, name: member.name });
      currentId = member.father_id;
    }
    return chain;
  }

  // Helper for great- prefixes
  function repeatPrefix(count, base) {
    if (count <= 0) return base;
    let prefix = '';
    for (let i = 0; i < count; i++) {
      prefix += 'أب ';
    }
    return prefix + base;
  }

  // Compute blood relationship label given distances g1, g2 and person1's gender
  function computeRelationLabel(g1, g2, p1Gender) {
    if (g1 === 0 && g2 === 1) {
      return p1Gender === 'female' ? 'أم' : 'أب';
    } else if (g1 === 1 && g2 === 0) {
      return p1Gender === 'female' ? 'ابنة' : 'ابن';
    } else if (g1 === 0 && g2 > 1) {
      if (g2 === 2) {
        return p1Gender === 'female' ? 'جدة' : 'جد';
      }
      const greats = g2 - 2;
      const base = p1Gender === 'female' ? 'جدة' : 'جد';
      return repeatPrefix(greats, base);
    } else if (g1 > 1 && g2 === 0) {
      if (g1 === 2) {
        return p1Gender === 'female' ? 'حفيدة' : 'حفيد';
      }
      const levels = g1 - 2;
      const base = p1Gender === 'female' ? 'حفيدة' : 'حفيد';
      let prefix = '';
      for (let i = 0; i < levels; i++) prefix += 'ابن ';
      return prefix + base;
    } else if (g1 === 1 && g2 === 1) {
      return p1Gender === 'female' ? 'أخت' : 'أخ';
    } else if (g1 === 1 && g2 === 2) {
      return p1Gender === 'female' ? 'عمة' : 'عم';
    } else if (g1 === 2 && g2 === 1) {
      return p1Gender === 'female' ? 'ابنة أخ' : 'ابن أخ';
    } else if (g1 === 1 && g2 > 2) {
      const greats = g2 - 2;
      const base = p1Gender === 'female' ? 'عمة' : 'عم';
      if (greats === 1) return base + ' الأب';
      return base + ' ' + repeatPrefix(greats - 1, 'الأب').trim();
    } else if (g1 > 2 && g2 === 1) {
      const levels = g1 - 2;
      const base = p1Gender === 'female' ? 'ابنة' : 'ابن';
      if (levels === 1) return base + ' ابن أخ';
      let prefix = '';
      for (let i = 0; i < levels - 1; i++) prefix += 'ابن ';
      return base + ' ' + prefix + 'ابن أخ';
    } else if (g1 === g2 && g1 > 1) {
      const degree = g1 - 1;
      if (degree === 1) return p1Gender === 'female' ? 'بنت عم' : 'ابن عم';
      return (p1Gender === 'female' ? 'بنت عم' : 'ابن عم') + ' درجة ' + degree;
    } else {
      const minG = Math.min(g1, g2);
      const removal = Math.abs(g1 - g2);
      if (minG === 1) {
        return 'قريب بدرجة ' + g1 + '/' + g2 + ' من الجد المشترك';
      }
      const cousinDegree = minG - 1;
      return 'ابن عم درجة ' + cousinDegree + ' مع فارق ' + removal + ' ' + (removal === 1 ? 'جيل' : 'أجيال');
    }
  }

  // Find blood relation between two members, returning {lca, g1, g2, path} or null
  function findBloodRelation(fromId, toId) {
    const chain1 = getAncestorChain(fromId);
    const chain2 = getAncestorChain(toId);
    const ancestors2Set = new Set(chain2.map(a => a.id));
    let lca = null;
    let g1 = -1;
    for (let i = 0; i < chain1.length; i++) {
      if (ancestors2Set.has(chain1[i].id)) {
        lca = chain1[i];
        g1 = i;
        break;
      }
    }
    if (!lca) return null;
    const g2 = chain2.findIndex(a => a.id === lca.id);
    const pathUp = chain1.slice(0, g1 + 1);
    const pathDown = chain2.slice(0, g2).reverse();
    return { lca, g1, g2, path: [...pathUp, ...pathDown] };
  }

  const bloodRel = findBloodRelation(id1, id2);

  if (bloodRel) {
    const relationship = computeRelationLabel(bloodRel.g1, bloodRel.g2, person1.gender);
    return res.json({
      person1: { id: person1.id, name: person1.name },
      person2: { id: person2.id, name: person2.name },
      relationship,
      lca: { id: bloodRel.lca.id, name: bloodRel.lca.name },
      path: bloodRel.path
    });
  }

  // No direct blood relation found - check marriage-based relations
  // Map blood relation label of husband to wife relation label seen from person1
  function mapToWifeRelation(husbandRelLabel) {
    const map = {
      'أب': 'أم',
      'جد': 'جدة الزوج',
      'عم': 'مرت العم',
      'أخ': 'زوجة الأخ',
      'ابن': 'زوجة الابن',
      'ابن أخ': 'زوجة ابن الأخ',
      'بنت عم': null, // shouldn't apply
      'ابن عم': 'زوجة ابن العم',
      'عمة': null,
    };
    if (map[husbandRelLabel] !== undefined) return map[husbandRelLabel];
    if (husbandRelLabel && husbandRelLabel.startsWith('عم ')) return 'زوجة ' + husbandRelLabel;
    if (husbandRelLabel && husbandRelLabel.startsWith('ابن عم')) return 'زوجة ' + husbandRelLabel;
    if (husbandRelLabel) return 'زوجة ' + husbandRelLabel;
    return null;
  }

  // Map blood relation label of wife's husband to how person1 relates to the husband
  // and derive person1's relation to the wife
  function mapToHusbandWifeRelation(p1RelToHusband) {
    const map = {
      'ابن': 'أم',          // husband is p1's son → wife is p1's زوجة الابن
      'أب': 'أم',           // husband is p1's father → wife is p1's أم / زوجة الأب
      'أخ': 'زوجة أخيك',
      'عم': 'مرت عمك',
      'ابن أخ': 'زوجة ابن أخيك',
      'ابن عم': 'زوجة ابن عمك',
    };
    if (map[p1RelToHusband] !== undefined) return map[p1RelToHusband];
    if (p1RelToHusband && p1RelToHusband.startsWith('عم ')) return 'زوجة ' + p1RelToHusband;
    if (p1RelToHusband && p1RelToHusband.startsWith('ابن عم')) return 'زوجة ' + p1RelToHusband;
    if (p1RelToHusband) return 'زوجة ' + p1RelToHusband;
    return null;
  }

  // Case A: person2 is a wife of someone related by blood to person1
  const p2AsWife = db.prepare('SELECT husband_id FROM marriages WHERE wife_id = ?').all(id2);
  for (const { husband_id } of p2AsWife) {
    if (husband_id === id1) continue; // direct marriage already checked
    const rel = findBloodRelation(id1, husband_id);
    if (rel) {
      const husbandLabel = computeRelationLabel(rel.g1, rel.g2, 'male');
      const wifeRelation = mapToWifeRelation(husbandLabel);
      if (wifeRelation) {
        const husband = memberMap.get(husband_id);
        return res.json({
          person1: { id: person1.id, name: person1.name },
          person2: { id: person2.id, name: person2.name },
          relationship: wifeRelation,
          lca: { id: rel.lca.id, name: rel.lca.name },
          path: rel.path,
          via: husband ? husband.name : null
        });
      }
    }
  }

  // Case B: person1 is a wife of someone related by blood to person2
  const p1AsWife = db.prepare('SELECT husband_id FROM marriages WHERE wife_id = ?').all(id1);
  for (const { husband_id } of p1AsWife) {
    if (husband_id === id2) continue; // direct marriage already checked
    const rel = findBloodRelation(id2, husband_id);
    if (rel) {
      // person1 is the wife of husband, and husband is related to person2 by rel
      // so from person1's point of view: person2 is [blood-relation of husband]
      const p2RelToHusband = computeRelationLabel(rel.g1, rel.g2, 'male');
      // person1 is "زوجة [p2RelToHusband]" of person2
      // e.g. husband is person2's عم → person1 is "زوجة العم" → person2 sees person1 as "مرت العم"
      const reverseMap = {
        'أب': 'مرت عمك / زوجة الابن',
        'ابن': 'زوجة الابن',
        'أخ': 'زوجة الأخ',
        'عم': 'مرت العم',
        'ابن أخ': 'زوجة ابن الأخ',
        'ابن عم': 'زوجة ابن العم',
      };
      let relationship = reverseMap[p2RelToHusband];
      if (!relationship) relationship = 'زوجة ' + p2RelToHusband;
      const husband = memberMap.get(husband_id);
      return res.json({
        person1: { id: person1.id, name: person1.name },
        person2: { id: person2.id, name: person2.name },
        relationship,
        lca: { id: rel.lca.id, name: rel.lca.name },
        path: rel.path,
        via: husband ? husband.name : null
      });
    }
  }

  return res.json({
    person1: { id: person1.id, name: person1.name },
    person2: { id: person2.id, name: person2.name },
    relationship: 'لا توجد صلة قرابة مباشرة',
    lca: null,
    path: []
  });
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
  const { name, father_id, gender, birth_date, death_date, bio, phone, mother_name, city, nationality, occupation, work_type, work_place, generation, photo, whatsapp, twitter, instagram, snapchat, tiktok } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'الاسم مطلوب' });
  }

  let gen = generation || 1;
  if (father_id && !generation) {
    const father = db.prepare('SELECT generation FROM members WHERE id = ?').get(father_id);
    if (father) gen = father.generation + 1;
  }

  const result = db.prepare(`
    INSERT INTO members (name, father_id, gender, birth_date, death_date, bio, phone, mother_name, city, nationality, occupation, work_type, work_place, generation, photo, whatsapp, twitter, instagram, snapchat, tiktok)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(name, father_id || null, gender || 'male', birth_date || null, death_date || null, bio || null, phone || null, mother_name || null, city || null, nationality || null, occupation || null, work_type || null, work_place || null, gen, photo || null, whatsapp || null, twitter || null, instagram || null, snapchat || null, tiktok || null);

  const newMember = db.prepare('SELECT * FROM members WHERE id = ?').get(result.lastInsertRowid);
  logActivity('create', 'member', newMember.id, newMember.name, `إضافة عضو: ${newMember.name}`, null, JSON.stringify(newMember), req.user);
  res.status(201).json(newMember);
});

// Update member (admin or own member)
router.put('/:id', authenticateToken, (req, res) => {
  const { name, father_id, gender, birth_date, death_date, bio, phone, mother_name, city, nationality, occupation, work_type, work_place, generation, photo, whatsapp, twitter, instagram, snapchat, tiktok } = req.body;

  // Permission check
  if (req.user.role !== 'admin') {
    const user = db.prepare('SELECT permission_type, allowed_subtrees, member_id FROM users WHERE id = ?').get(req.user.id);
    if (!user) return res.status(403).json({ error: 'غير مصرح' });

    const targetId = parseInt(req.params.id);

    if (user.permission_type === 'full_tree') {
      // Can edit any member
    } else if (user.permission_type === 'custom_subtrees') {
      // Can edit members in specific subtrees
      const subtrees = user.allowed_subtrees ? JSON.parse(user.allowed_subtrees) : [];
      const canEdit = subtrees.some(rootId => isInSubtree(rootId, targetId));
      if (!canEdit) return res.status(403).json({ error: 'غير مصرح بتعديل هذا العضو' });
    } else {
      // own_subtree: can only edit own subtree
      if (!user.member_id) return res.status(403).json({ error: 'غير مصرح' });
      if (!isInSubtree(user.member_id, targetId)) return res.status(403).json({ error: 'غير مصرح بتعديل هذا العضو' });
    }
  }

  const existing = db.prepare('SELECT * FROM members WHERE id = ?').get(req.params.id);
  if (!existing) {
    return res.status(404).json({ error: 'العضو غير موجود' });
  }

  db.prepare(`
    UPDATE members SET name = ?, father_id = ?, gender = ?, birth_date = ?, death_date = ?,
    bio = ?, phone = ?, mother_name = ?, city = ?, nationality = ?, occupation = ?, work_type = ?, work_place = ?, generation = ?,
    photo = ?, whatsapp = ?, twitter = ?, instagram = ?, snapchat = ?, tiktok = ?, updated_at = CURRENT_TIMESTAMP
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
    photo !== undefined ? photo : existing.photo,
    whatsapp !== undefined ? whatsapp : existing.whatsapp,
    twitter !== undefined ? twitter : existing.twitter,
    instagram !== undefined ? instagram : existing.instagram,
    snapchat !== undefined ? snapchat : existing.snapchat,
    tiktok !== undefined ? tiktok : existing.tiktok,
    req.params.id
  );

  const updated = db.prepare('SELECT * FROM members WHERE id = ?').get(req.params.id);
  logActivity('update', 'member', updated.id, updated.name, `تعديل عضو: ${updated.name}`, JSON.stringify(existing), JSON.stringify(updated), req.user);
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

  logActivity('delete', 'member', existing.id, existing.name, `حذف عضو: ${existing.name}`, JSON.stringify(existing), null, req.user);
  res.json({ message: 'تم حذف العضو بنجاح' });
});

// Upload member photo
router.post('/:id/photo', authenticateToken, upload.single('photo'), (req, res) => {
  const member = db.prepare('SELECT * FROM members WHERE id = ?').get(req.params.id);
  if (!member) return res.status(404).json({ error: 'العضو غير موجود' });
  if (!req.file) return res.status(400).json({ error: 'لم يتم رفع صورة' });

  const photoPath = '/uploads/' + req.file.filename;
  db.prepare('UPDATE members SET photo = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(photoPath, req.params.id);
  res.json({ photo: photoPath });
});

// Marriages CRUD
router.post('/:id/marriages', authenticateToken, (req, res) => {
  const { wife_name, wife_id, status, marriage_order } = req.body;

  const order = marriage_order || (db.prepare('SELECT MAX(marriage_order) as max FROM marriages WHERE husband_id = ?').get(req.params.id)?.max || 0) + 1;

  const result = db.prepare(
    'INSERT INTO marriages (husband_id, wife_id, wife_name, status, marriage_order) VALUES (?, ?, ?, ?, ?)'
  ).run(req.params.id, wife_id || null, wife_name || null, status || 'married', order);

  const marriage = db.prepare('SELECT * FROM marriages WHERE id = ?').get(result.lastInsertRowid);
  logActivity('create', 'marriage', marriage.id, wife_name, `إضافة زواج: ${wife_name}`, null, JSON.stringify(marriage), req.user);
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
  const existing = db.prepare('SELECT * FROM marriages WHERE id = ?').get(req.params.id);
  db.prepare('DELETE FROM marriages WHERE id = ?').run(req.params.id);
  if (existing) logActivity('delete', 'marriage', existing.id, existing.wife_name, `حذف زواج: ${existing.wife_name}`, JSON.stringify(existing), null, req.user);
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
