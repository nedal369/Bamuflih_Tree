const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../db/database');
const { authenticateToken, optionalAuth, requireAdmin } = require('../middleware/auth');
const { parseGedcom } = require('../utils/gedcom-parser');

// Multer config for GEDCOM files
const gedcomStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '..', '..', 'uploads'));
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'general-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const gedcomFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  if (ext === '.ged' || ext === '.gedcom' || file.mimetype === 'text/plain' || file.mimetype === 'application/octet-stream') {
    cb(null, true);
  } else {
    cb(new Error('نوع الملف غير مدعوم - يرجى رفع ملف GEDCOM (.ged)'), false);
  }
};

const upload = multer({
  storage: gedcomStorage,
  fileFilter: gedcomFilter,
  limits: { fileSize: 20 * 1024 * 1024 }
});

const router = express.Router();

// ---------------------------------------------------------------------------
// GET /families - List all general family branches
// ---------------------------------------------------------------------------
router.get('/families', optionalAuth, (req, res) => {
  try {
    const families = db.prepare(`
      SELECT * FROM general_families ORDER BY created_at DESC
    `).all();
    res.json(families);
  } catch (err) {
    console.error('[General Tree] List families error:', err);
    res.status(500).json({ error: 'حدث خطأ أثناء جلب الأُسر' });
  }
});

// ---------------------------------------------------------------------------
// GET /families/:id/tree - Get hierarchical tree for a family
// ---------------------------------------------------------------------------
router.get('/families/:id/tree', optionalAuth, (req, res) => {
  try {
    const familyId = parseInt(req.params.id);
    const family = db.prepare('SELECT * FROM general_families WHERE id = ?').get(familyId);
    if (!family) return res.status(404).json({ error: 'الأسرة غير موجودة' });

    const members = db.prepare('SELECT * FROM general_members WHERE family_id = ? ORDER BY id').all(familyId);
    const marriages = db.prepare('SELECT * FROM general_marriages WHERE family_id = ? ORDER BY marriage_order').all(familyId);

    // Build tree
    const tree = buildTree(members, marriages);

    res.json({ family, tree });
  } catch (err) {
    console.error('[General Tree] Get tree error:', err);
    res.status(500).json({ error: 'حدث خطأ أثناء جلب الشجرة' });
  }
});

// ---------------------------------------------------------------------------
// GET /families/:id/members - Get flat member list
// ---------------------------------------------------------------------------
router.get('/families/:id/members', optionalAuth, (req, res) => {
  try {
    const familyId = parseInt(req.params.id);
    const members = db.prepare('SELECT * FROM general_members WHERE family_id = ? ORDER BY generation, name').all(familyId);
    const marriages = db.prepare('SELECT * FROM general_marriages WHERE family_id = ?').all(familyId);

    // Attach marriages to members
    const memberList = members.map(m => ({
      ...m,
      marriages: marriages.filter(mar => mar.husband_id === m.id)
    }));

    res.json(memberList);
  } catch (err) {
    console.error('[General Tree] Get members error:', err);
    res.status(500).json({ error: 'حدث خطأ أثناء جلب الأفراد' });
  }
});

// ---------------------------------------------------------------------------
// GET /members/:id - Get single member details
// ---------------------------------------------------------------------------
router.get('/members/:id', optionalAuth, (req, res) => {
  try {
    const memberId = parseInt(req.params.id);
    const member = db.prepare('SELECT * FROM general_members WHERE id = ?').get(memberId);
    if (!member) return res.status(404).json({ error: 'العضو غير موجود' });

    const marriages = db.prepare('SELECT * FROM general_marriages WHERE husband_id = ? OR wife_id = ?').all(memberId, memberId);
    const father = member.father_id ? db.prepare('SELECT id, name FROM general_members WHERE id = ?').get(member.father_id) : null;
    const mother = member.mother_id ? db.prepare('SELECT id, name FROM general_members WHERE id = ?').get(member.mother_id) : null;
    const children = db.prepare('SELECT id, name, gender, birth_date, death_date FROM general_members WHERE father_id = ? OR mother_id = ?').all(memberId, memberId);

    res.json({ ...member, marriages, father, mother, children });
  } catch (err) {
    console.error('[General Tree] Get member error:', err);
    res.status(500).json({ error: 'حدث خطأ أثناء جلب بيانات العضو' });
  }
});

// ---------------------------------------------------------------------------
// POST /families/import - Import GEDCOM file as a new family branch
// ---------------------------------------------------------------------------
router.post('/families/import', authenticateToken, requireAdmin, upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'يرجى رفع ملف GEDCOM' });
    }

    const familyName = req.body.name;
    if (!familyName) {
      return res.status(400).json({ error: 'يرجى إدخال اسم الأسرة' });
    }

    const filePath = req.file.path;
    let content;
    try {
      content = fs.readFileSync(filePath, 'utf-8');
    } catch (readErr) {
      return res.status(400).json({ error: 'تعذر قراءة الملف المرفوع' });
    } finally {
      try { fs.unlinkSync(filePath); } catch (_) { /* ignore */ }
    }

    // Parse GEDCOM
    const { individuals, families, errors } = parseGedcom(content);

    if (individuals.size === 0) {
      return res.status(400).json({
        error: 'لم يتم العثور على أفراد في ملف GEDCOM',
        errors,
      });
    }

    // Import into database
    const result = importGeneralGedcom(
      individuals,
      families,
      errors,
      familyName,
      req.body.description || null,
      req.file.originalname,
      req.user.id
    );

    res.json({
      message: 'تم استيراد البيانات بنجاح',
      family_id: result.familyId,
      imported: result.importedCount,
      marriages: result.marriagesCount,
      errors: result.errors,
    });
  } catch (err) {
    console.error('[General Tree] Import error:', err);
    res.status(500).json({ error: 'حدث خطأ أثناء استيراد البيانات' });
  }
});

// ---------------------------------------------------------------------------
// PUT /families/:id - Update family name/description
// ---------------------------------------------------------------------------
router.put('/families/:id', authenticateToken, requireAdmin, (req, res) => {
  try {
    const familyId = parseInt(req.params.id);
    const family = db.prepare('SELECT * FROM general_families WHERE id = ?').get(familyId);
    if (!family) return res.status(404).json({ error: 'الأسرة غير موجودة' });

    const { name, description } = req.body;
    db.prepare('UPDATE general_families SET name = COALESCE(?, name), description = COALESCE(?, description), updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run(name || null, description !== undefined ? description : null, familyId);

    const updated = db.prepare('SELECT * FROM general_families WHERE id = ?').get(familyId);
    res.json(updated);
  } catch (err) {
    console.error('[General Tree] Update family error:', err);
    res.status(500).json({ error: 'حدث خطأ أثناء تحديث الأسرة' });
  }
});

// ---------------------------------------------------------------------------
// DELETE /families/:id - Rollback: delete a family and all its data
// ---------------------------------------------------------------------------
router.delete('/families/:id', authenticateToken, requireAdmin, (req, res) => {
  try {
    const familyId = parseInt(req.params.id);
    const family = db.prepare('SELECT * FROM general_families WHERE id = ?').get(familyId);
    if (!family) return res.status(404).json({ error: 'الأسرة غير موجودة' });

    const deleteFamilyTransaction = db.transaction(() => {
      // CASCADE handles general_members and general_marriages deletion
      db.prepare('DELETE FROM general_marriages WHERE family_id = ?').run(familyId);
      db.prepare('DELETE FROM general_members WHERE family_id = ?').run(familyId);
      db.prepare('DELETE FROM general_families WHERE id = ?').run(familyId);
    });

    deleteFamilyTransaction();

    res.json({ message: `تم حذف أسرة "${family.name}" وجميع بياناتها بنجاح` });
  } catch (err) {
    console.error('[General Tree] Delete family error:', err);
    res.status(500).json({ error: 'حدث خطأ أثناء حذف الأسرة' });
  }
});

// ---------------------------------------------------------------------------
// Helper: Build hierarchical tree from flat members + marriages
// ---------------------------------------------------------------------------
function buildTree(members, marriages) {
  const memberMap = new Map();
  for (const m of members) {
    memberMap.set(m.id, { ...m, children: [], marriages: [] });
  }

  // Attach marriages
  for (const mar of marriages) {
    const husband = memberMap.get(mar.husband_id);
    if (husband) {
      husband.marriages.push(mar);
    }
  }

  // Build parent-child relationships
  const roots = [];
  for (const [, node] of memberMap) {
    if (node.father_id && memberMap.has(node.father_id)) {
      memberMap.get(node.father_id).children.push(node);
    } else if (node.mother_id && memberMap.has(node.mother_id) && !node.father_id) {
      // Only attach to mother if no father
      memberMap.get(node.mother_id).children.push(node);
    } else {
      roots.push(node);
    }
  }

  // Sort children by id (roughly by birth order)
  for (const [, node] of memberMap) {
    node.children.sort((a, b) => a.id - b.id);
  }

  return roots;
}

// ---------------------------------------------------------------------------
// Helper: Import GEDCOM data into general tree tables
// ---------------------------------------------------------------------------
function importGeneralGedcom(individuals, families, errors, familyName, description, sourceFilename, uploadedBy) {
  const insertFamily = db.prepare(`
    INSERT INTO general_families (name, description, source_filename, uploaded_by)
    VALUES (?, ?, ?, ?)
  `);

  const insertMember = db.prepare(`
    INSERT INTO general_members (family_id, gedcom_id, name, gender, birth_date, death_date, bio, phone, mother_name, city, nationality, occupation, work_type, work_place, generation)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertMarriage = db.prepare(`
    INSERT INTO general_marriages (family_id, husband_id, wife_id, wife_name, status, marriage_order)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  let familyId;
  let importedCount = 0;
  let marriagesCount = 0;

  const gedcomToDbId = new Map();

  const doImport = db.transaction(() => {
    // Create the family record
    const familyResult = insertFamily.run(familyName, description, sourceFilename, uploadedBy);
    familyId = Number(familyResult.lastInsertRowid);

    // First pass: insert all individuals
    for (const [gedcomId, data] of individuals) {
      try {
        const gender = data.sex === 'F' ? 'female' : 'male';
        const result = insertMember.run(
          familyId,
          gedcomId,
          data.name || 'غير معروف',
          gender,
          data.birthDate || null,
          data.deathDate || null,
          data.bio || null,
          data.phone || null,
          data.motherName || null,
          data.city || null,
          data.nationality || null,
          data.occupation || null,
          data.workType || null,
          data.workPlace || null,
          1 // generation set later
        );
        gedcomToDbId.set(gedcomId, Number(result.lastInsertRowid));
        importedCount++;
      } catch (err) {
        errors.push(`خطأ في استيراد الفرد ${data.name || gedcomId}: ${err.message}`);
      }
    }

    // Second pass: set father_id and mother_id from FAM records
    const updateFather = db.prepare('UPDATE general_members SET father_id = ? WHERE id = ?');
    const updateMother = db.prepare('UPDATE general_members SET mother_id = ? WHERE id = ?');

    for (const [, famData] of families) {
      const husbandDbId = famData.husband ? gedcomToDbId.get(famData.husband) : null;
      const wifeDbId = famData.wife ? gedcomToDbId.get(famData.wife) : null;

      // Set father_id and mother_id for children
      for (const childGedcomId of famData.children) {
        const childDbId = gedcomToDbId.get(childGedcomId);
        if (childDbId) {
          if (husbandDbId) {
            try { updateFather.run(husbandDbId, childDbId); } catch (err) {
              errors.push(`خطأ في ربط الابن ${childGedcomId} بالأب: ${err.message}`);
            }
          }
          if (wifeDbId) {
            try { updateMother.run(wifeDbId, childDbId); } catch (err) {
              errors.push(`خطأ في ربط الابن ${childGedcomId} بالأم: ${err.message}`);
            }
          }
        }
      }

      // Create marriage record
      if (husbandDbId) {
        try {
          const existing = db.prepare(
            'SELECT COUNT(*) as cnt FROM general_marriages WHERE husband_id = ? AND family_id = ?'
          ).get(husbandDbId, familyId);
          const order = (existing?.cnt || 0) + 1;

          insertMarriage.run(
            familyId,
            husbandDbId,
            wifeDbId || null,
            famData.wifeName || null,
            'married',
            order
          );
          marriagesCount++;
        } catch (err) {
          errors.push(`خطأ في استيراد الزواج: ${err.message}`);
        }
      }
    }

    // Third pass: calculate generations via BFS
    calculateGeneralGenerations(familyId);

    // Update member count
    const count = db.prepare('SELECT COUNT(*) as cnt FROM general_members WHERE family_id = ?').get(familyId);
    db.prepare('UPDATE general_families SET member_count = ? WHERE id = ?').run(count.cnt, familyId);
  });

  doImport();

  return { familyId, importedCount, marriagesCount, errors };
}

// ---------------------------------------------------------------------------
// Helper: Calculate generations for general tree members
// ---------------------------------------------------------------------------
function calculateGeneralGenerations(familyId) {
  const allMembers = db.prepare('SELECT id, father_id FROM general_members WHERE family_id = ?').all(familyId);

  const childrenMap = new Map();
  for (const m of allMembers) {
    if (m.father_id) {
      if (!childrenMap.has(m.father_id)) childrenMap.set(m.father_id, []);
      childrenMap.get(m.father_id).push(m.id);
    }
  }

  // Find roots (no father_id)
  const roots = allMembers.filter(m => !m.father_id);
  const updateGen = db.prepare('UPDATE general_members SET generation = ? WHERE id = ?');

  // BFS from roots
  const queue = [];
  for (const root of roots) {
    queue.push({ id: root.id, gen: 1 });
  }

  const visited = new Set();
  while (queue.length > 0) {
    const { id, gen } = queue.shift();
    if (visited.has(id)) continue;
    visited.add(id);

    updateGen.run(gen, id);
    const children = childrenMap.get(id) || [];
    for (const childId of children) {
      queue.push({ id: childId, gen: gen + 1 });
    }
  }
}

module.exports = router;
