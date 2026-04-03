const express = require('express');
const multer = require('multer');
const path = require('path');
const db = require('../db/database');
const { authenticateToken } = require('../middleware/auth');
const fs = require('fs');

// Custom multer for GEDCOM files (.ged, .gedcom, plain text)
const gedcomStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '..', '..', 'uploads'));
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
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
  limits: { fileSize: 20 * 1024 * 1024 } // 20MB
});

const { parseGedcom } = require('../utils/gedcom-parser');

const router = express.Router();

// ---------------------------------------------------------------------------
// GET /gedcom/download - Export family data as GEDCOM 5.5.1
// ---------------------------------------------------------------------------
router.get('/download', authenticateToken, (req, res) => {
  try {
    const members = db.prepare('SELECT * FROM members ORDER BY id').all();
    const marriages = db.prepare('SELECT * FROM marriages ORDER BY id').all();

    const lines = [];

    // HEAD
    lines.push('0 HEAD');
    lines.push('1 SOUR Bamuflih_Tree');
    lines.push('2 VERS 1.0');
    lines.push('2 NAME Bamuflih Family Tree');
    lines.push('1 DEST ANY');
    lines.push('1 DATE ' + formatGedcomDate(new Date()));
    lines.push('1 GEDC');
    lines.push('2 VERS 5.5.1');
    lines.push('2 FORM LINEAGE-LINKED');
    lines.push('1 CHAR UTF-8');
    lines.push('1 LANG Arabic');

    // Build a map of member id -> family ids (as child, as spouse)
    // We need FAM records for: each marriage + each parent-children group
    // Strategy: one FAM per marriage row, plus implied FAMs for father-child
    // relationships not covered by marriages.

    // Collect all FAM records we need:
    // Each marriage row becomes a FAM. Children whose father_id == husband_id
    // are attached to that FAM.
    // For fathers with children but no marriage record, create a synthetic FAM.

    const famRecords = []; // { id, husbandId, wifeId, childIds[] }
    const childAssigned = new Set(); // track which children are assigned to a FAM

    // First pass: marriage-based families
    for (const mar of marriages) {
      const childIds = members
        .filter(m => m.father_id === mar.husband_id)
        .map(m => m.id);

      // If the wife is a member, try to match children whose mother_name
      // matches (best effort) -- but since mother_name is free text, we
      // simply attach all children of the husband to his first family and
      // let subsequent families have no children unless we can disambiguate.
      // For simplicity: attach children to the first FAM for this husband
      // if not already assigned.
      const unassignedChildren = childIds.filter(id => !childAssigned.has(id));

      famRecords.push({
        id: `F${mar.id}`,
        husbandId: mar.husband_id,
        wifeId: mar.wife_id || null,
        wifeName: mar.wife_name || null,
        childIds: unassignedChildren,
      });

      for (const cid of unassignedChildren) {
        childAssigned.add(cid);
      }
    }

    // Second pass: fathers with children but no marriage record
    const fathersWithMarriage = new Set(marriages.map(m => m.husband_id));
    const fatherIds = [...new Set(members.filter(m => m.father_id).map(m => m.father_id))];
    let syntheticFamCounter = marriages.length + 1;

    for (const fid of fatherIds) {
      if (fathersWithMarriage.has(fid)) {
        // Check for unassigned children of this father
        const unassigned = members
          .filter(m => m.father_id === fid && !childAssigned.has(m.id))
          .map(m => m.id);
        if (unassigned.length > 0) {
          famRecords.push({
            id: `F${syntheticFamCounter++}`,
            husbandId: fid,
            wifeId: null,
            wifeName: null,
            childIds: unassigned,
          });
          for (const cid of unassigned) childAssigned.add(cid);
        }
        continue;
      }
      const childIds = members
        .filter(m => m.father_id === fid)
        .map(m => m.id);
      famRecords.push({
        id: `F${syntheticFamCounter++}`,
        husbandId: fid,
        wifeId: null,
        wifeName: null,
        childIds: childIds,
      });
      for (const cid of childIds) childAssigned.add(cid);
    }

    // Build reverse lookups: memberId -> FAMS (spouse in family), FAMC (child in family)
    const memberFAMS = new Map(); // memberId -> [famId, ...]
    const memberFAMC = new Map(); // memberId -> [famId, ...]

    for (const fam of famRecords) {
      // Husband as spouse
      if (fam.husbandId) {
        if (!memberFAMS.has(fam.husbandId)) memberFAMS.set(fam.husbandId, []);
        memberFAMS.get(fam.husbandId).push(fam.id);
      }
      // Wife as spouse (only if she's a member)
      if (fam.wifeId) {
        if (!memberFAMS.has(fam.wifeId)) memberFAMS.set(fam.wifeId, []);
        memberFAMS.get(fam.wifeId).push(fam.id);
      }
      // Children
      for (const cid of fam.childIds) {
        if (!memberFAMC.has(cid)) memberFAMC.set(cid, []);
        memberFAMC.get(cid).push(fam.id);
      }
    }

    // INDI records
    for (const m of members) {
      lines.push(`0 @I${m.id}@ INDI`);
      lines.push(`1 NAME ${m.name}`);
      lines.push(`1 SEX ${m.gender === 'female' ? 'F' : 'M'}`);

      if (m.birth_date) {
        lines.push('1 BIRT');
        lines.push(`2 DATE ${m.birth_date}`);
      }

      if (m.death_date) {
        lines.push('1 DEAT');
        lines.push(`2 DATE ${m.death_date}`);
      }

      if (m.city) {
        lines.push('1 RESI');
        lines.push(`2 PLAC ${m.city}`);
      }

      if (m.occupation) {
        lines.push(`1 OCCU ${m.occupation}`);
      }

      if (m.bio) {
        lines.push(`1 NOTE ${m.bio}`);
      }

      if (m.phone) {
        lines.push(`1 PHON ${m.phone}`);
      }

      if (m.mother_name) {
        lines.push(`1 NOTE MOTHER_NAME: ${m.mother_name}`);
      }

      if (m.nationality) {
        lines.push(`1 NOTE NATIONALITY: ${m.nationality}`);
      }

      if (m.work_type) {
        lines.push(`1 NOTE WORK_TYPE: ${m.work_type}`);
      }

      if (m.work_place) {
        lines.push(`1 NOTE WORK_PLACE: ${m.work_place}`);
      }

      // FAMS links
      const famsLinks = memberFAMS.get(m.id) || [];
      for (const fid of famsLinks) {
        lines.push(`1 FAMS @${fid}@`);
      }

      // FAMC links
      const famcLinks = memberFAMC.get(m.id) || [];
      for (const fid of famcLinks) {
        lines.push(`1 FAMC @${fid}@`);
      }
    }

    // FAM records
    for (const fam of famRecords) {
      lines.push(`0 @${fam.id}@ FAM`);
      if (fam.husbandId) {
        lines.push(`1 HUSB @I${fam.husbandId}@`);
      }
      if (fam.wifeId) {
        lines.push(`1 WIFE @I${fam.wifeId}@`);
      } else if (fam.wifeName) {
        lines.push(`1 NOTE WIFE_NAME: ${fam.wifeName}`);
      }
      for (const cid of fam.childIds) {
        lines.push(`1 CHIL @I${cid}@`);
      }
    }

    // TRLR
    lines.push('0 TRLR');

    const gedcomContent = lines.join('\r\n') + '\r\n';

    res.setHeader('Content-Type', 'text/x-gedcom; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="bamuflih_tree.ged"');
    res.send(gedcomContent);
  } catch (err) {
    console.error('[GEDCOM Export]', err);
    res.status(500).json({ error: 'حدث خطأ أثناء تصدير البيانات' });
  }
});

// ---------------------------------------------------------------------------
// POST /gedcom/import - Import a GEDCOM file
// ---------------------------------------------------------------------------
router.post('/import', authenticateToken, upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'يرجى رفع ملف GEDCOM' });
    }

    const filePath = req.file.path;
    let content;
    try {
      content = fs.readFileSync(filePath, 'utf-8');
    } catch (readErr) {
      return res.status(400).json({ error: 'تعذر قراءة الملف المرفوع' });
    } finally {
      // Clean up uploaded file
      try { fs.unlinkSync(filePath); } catch (_) { /* ignore */ }
    }

    // Parse GEDCOM
    const { individuals, families, errors } = parseGedcom(content);

    if (individuals.length === 0) {
      return res.status(400).json({
        error: 'لم يتم العثور على أفراد في ملف GEDCOM',
        errors,
      });
    }

    // Import into database inside a transaction
    const importResult = importGedcomData(individuals, families, errors);

    res.json({
      message: 'تم استيراد البيانات بنجاح',
      imported: importResult.importedCount,
      families: importResult.familiesCount,
      errors: importResult.errors,
    });
  } catch (err) {
    console.error('[GEDCOM Import]', err);
    res.status(500).json({ error: 'حدث خطأ أثناء استيراد البيانات' });
  }
});

// ---------------------------------------------------------------------------
// Import GEDCOM data into database
// ---------------------------------------------------------------------------
function importGedcomData(individuals, families, errors) {
  const insertMember = db.prepare(`
    INSERT INTO members (name, father_id, gender, birth_date, death_date, bio, phone, mother_name, city, nationality, occupation, work_type, work_place, generation)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertMarriage = db.prepare(`
    INSERT INTO marriages (husband_id, wife_id, wife_name, status, marriage_order)
    VALUES (?, ?, ?, ?, ?)
  `);

  let importedCount = 0;
  let familiesCount = 0;

  // Map GEDCOM IDs to new database IDs
  const gedcomToDbId = new Map();

  const doImport = db.transaction(() => {
    // First pass: insert all individuals without father_id
    for (const [gedcomId, data] of individuals) {
      try {
        const gender = data.sex === 'F' ? 'female' : 'male';
        const result = insertMember.run(
          data.name || 'غير معروف',
          null,  // father_id set later
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
          1  // generation set later
        );
        gedcomToDbId.set(gedcomId, Number(result.lastInsertRowid));
        importedCount++;
      } catch (err) {
        errors.push(`خطأ في استيراد الفرد ${data.name || gedcomId}: ${err.message}`);
      }
    }

    // Second pass: set father_id from family records (CHIL -> HUSB)
    const updateFather = db.prepare('UPDATE members SET father_id = ? WHERE id = ?');

    for (const [, famData] of families) {
      const husbandDbId = famData.husband ? gedcomToDbId.get(famData.husband) : null;

      // Set father_id for children
      if (husbandDbId) {
        for (const childGedcomId of famData.children) {
          const childDbId = gedcomToDbId.get(childGedcomId);
          if (childDbId) {
            try {
              updateFather.run(husbandDbId, childDbId);
            } catch (err) {
              errors.push(`خطأ في ربط الابن ${childGedcomId} بالأب: ${err.message}`);
            }
          }
        }
      }

      // Create marriage record
      const wifeDbId = famData.wife ? gedcomToDbId.get(famData.wife) : null;
      if (husbandDbId) {
        try {
          // Determine marriage order for this husband
          const existing = db.prepare(
            'SELECT COUNT(*) as cnt FROM marriages WHERE husband_id = ?'
          ).get(husbandDbId);
          const order = (existing?.cnt || 0) + 1;

          insertMarriage.run(
            husbandDbId,
            wifeDbId || null,
            famData.wifeName || null,
            'married',
            order
          );
          familiesCount++;
        } catch (err) {
          errors.push(`خطأ في استيراد الزواج: ${err.message}`);
        }
      }
    }

    // Third pass: calculate generations from tree structure
    calculateGenerations();
  });

  doImport();

  return { importedCount, familiesCount, errors };
}

// ---------------------------------------------------------------------------
// Recalculate generations for all members based on tree depth
// ---------------------------------------------------------------------------
function calculateGenerations() {
  const allMembers = db.prepare('SELECT id, father_id FROM members').all();
  const memberMap = new Map();
  for (const m of allMembers) {
    memberMap.set(m.id, m);
  }

  // Find roots (no father_id)
  const roots = allMembers.filter(m => !m.father_id);
  const childrenMap = new Map();
  for (const m of allMembers) {
    if (m.father_id) {
      if (!childrenMap.has(m.father_id)) childrenMap.set(m.father_id, []);
      childrenMap.get(m.father_id).push(m.id);
    }
  }

  const updateGen = db.prepare('UPDATE members SET generation = ? WHERE id = ?');

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

  // Handle orphans (members not reached by BFS) - keep generation = 1
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function formatGedcomDate(date) {
  const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN',
                  'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
}

module.exports = router;
