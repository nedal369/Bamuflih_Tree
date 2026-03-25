const express = require('express');
const XLSX = require('xlsx');
const path = require('path');
const db = require('../db/database');
const { authenticateToken } = require('../middleware/auth');
const upload = require('../middleware/upload');
const { logActivity } = require('./activityLog');

const router = express.Router();

// Download all data as Excel
router.get('/excel/download', authenticateToken, (req, res) => {
  try {
    const members = db.prepare('SELECT * FROM members ORDER BY generation, id').all();
    const allMarriages = db.prepare('SELECT * FROM marriages ORDER BY marriage_order').all();

    // Build marriage map: husband_id -> wife names
    const marriageMap = new Map();
    for (const m of allMarriages) {
      if (!marriageMap.has(m.husband_id)) marriageMap.set(m.husband_id, []);
      marriageMap.get(m.husband_id).push(m);
    }

    // Build id->name map for father lookup
    const idToName = new Map();
    for (const m of members) idToName.set(m.id, m.name);

    const rows = members.map(m => {
      const marriages = marriageMap.get(m.id) || [];
      // For females, find their husband
      let spouseName = '';
      if (m.gender === 'female') {
        const asWife = allMarriages.find(mr => mr.wife_id === m.id);
        if (asWife) spouseName = idToName.get(asWife.husband_id) || '';
      } else {
        spouseName = marriages.map(mr => mr.wife_name).filter(Boolean).join('، ');
      }

      return {
        'الاسم': m.name,
        'اسم الأب': idToName.get(m.father_id) || '',
        'الأم': m.mother_name || '',
        'الزوج/الزوجة': spouseName,
        'الجنس': m.gender === 'female' ? 'أنثى' : 'ذكر',
        'تاريخ الميلاد': m.birth_date || '',
        'تاريخ الوفاة': m.death_date || '',
        'الحالة': m.bio || '',
        'مكان الإقامة': m.city || '',
        'الجنسية': m.nationality || '',
        'الهاتف': m.phone || '',
        'نوع العمل': m.work_type || '',
        'جهة العمل': m.work_place || '',
        'الجيل': m.generation,
      };
    });

    const ws = XLSX.utils.json_to_sheet(rows);

    // Set RTL and column widths
    ws['!cols'] = [
      { wch: 30 }, // الاسم
      { wch: 30 }, // اسم الأب
      { wch: 20 }, // الأم
      { wch: 25 }, // الزوج/الزوجة
      { wch: 8 },  // الجنس
      { wch: 14 }, // تاريخ الميلاد
      { wch: 14 }, // تاريخ الوفاة
      { wch: 15 }, // الحالة
      { wch: 15 }, // مكان الإقامة
      { wch: 10 }, // الجنسية
      { wch: 14 }, // الهاتف
      { wch: 15 }, // نوع العمل
      { wch: 20 }, // جهة العمل
      { wch: 6 },  // الجيل
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'شجرة العائلة');

    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Disposition', 'attachment; filename=family_tree.xlsx');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buffer);
  } catch (error) {
    res.status(500).json({ error: 'خطأ في إنشاء الملف: ' + error.message });
  }
});

// Upload Excel file and parse
router.post('/excel', authenticateToken, upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'لم يتم رفع ملف' });
  }

  try {
    const workbook = XLSX.readFile(req.file.path);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet);

    // Save upload record
    db.prepare(
      'INSERT INTO uploads (filename, original_name, file_type, uploaded_by) VALUES (?, ?, ?, ?)'
    ).run(req.file.filename, req.file.originalname, 'excel', req.user.id);

    // Map Arabic column names to English
    const columnMap = {
      'الاسم': 'name',
      'name': 'name',
      'اسم الأب': 'father_name',
      'father_name': 'father_name',
      'الأم': 'mother_name',
      'mother_name': 'mother_name',
      'الزوج/الزوجة': 'spouse_name',
      'الجنس': 'gender',
      'gender': 'gender',
      'تاريخ الميلاد': 'birth_date',
      'birth_date': 'birth_date',
      'تاريخ الوفاة': 'death_date',
      'death_date': 'death_date',
      'الحالة': 'bio',
      'ملاحظات': 'bio',
      'bio': 'bio',
      'الهاتف': 'phone',
      'phone': 'phone',
      'مكان الإقامة': 'city',
      'city': 'city',
      'الجنسية': 'nationality',
      'nationality': 'nationality',
      'نوع العمل': 'work_type',
      'work_type': 'work_type',
      'جهة العمل': 'work_place',
      'work_place': 'work_place',
      'الجيل': 'generation',
      'generation': 'generation',
    };

    const mappedData = data.map(row => {
      const mapped = {};
      for (const [key, value] of Object.entries(row)) {
        const mappedKey = columnMap[key.trim()] || key;
        mapped[mappedKey] = value;
      }
      return mapped;
    });

    res.json({
      message: `تم قراءة ${mappedData.length} سجل من الملف`,
      data: mappedData,
      columns: Object.keys(data[0] || {}),
      filename: req.file.filename
    });
  } catch (error) {
    res.status(500).json({ error: 'خطأ في قراءة الملف: ' + error.message });
  }
});

// Import parsed Excel data (two-pass: 1. create/update members, 2. link relationships)
router.post('/excel/import', authenticateToken, (req, res) => {
  const { data } = req.body;

  if (!data || !Array.isArray(data)) {
    return res.status(400).json({ error: 'البيانات غير صالحة' });
  }

  let imported = 0;
  let updated = 0;
  let relationshipsLinked = 0;
  let marriagesCreated = 0;
  let errors = [];
  const createdMemberIds = [];

  const importMany = db.transaction((records) => {
    // ─── PASS 1: Create/update all members without father_id ───
    const nameToRecord = new Map();
    for (const record of records) {
      try {
        if (!record.name) {
          errors.push({ name: '(فارغ)', error: 'الاسم مطلوب' });
          continue;
        }
        nameToRecord.set(record.name.trim(), record);

        const gender = record.gender === 'أنثى' || record.gender === 'female' ? 'female' : 'male';

        // Check if member already exists (exact name match)
        const existing = db.prepare('SELECT id FROM members WHERE name = ?').get(record.name.trim());

        if (existing) {
          db.prepare(`
            UPDATE members SET gender = ?,
            birth_date = COALESCE(?, birth_date), death_date = COALESCE(?, death_date),
            bio = COALESCE(?, bio), phone = COALESCE(?, phone),
            mother_name = COALESCE(?, mother_name), city = COALESCE(?, city),
            nationality = COALESCE(?, nationality), occupation = COALESCE(?, occupation),
            work_type = COALESCE(?, work_type), work_place = COALESCE(?, work_place),
            updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
          `).run(
            gender,
            record.birth_date || null, record.death_date || null,
            record.bio || null, record.phone || null,
            record.mother_name || null, record.city || null,
            record.nationality || null, record.occupation || null,
            record.work_type || null, record.work_place || null,
            existing.id
          );
          updated++;
        } else {
          const result = db.prepare(`
            INSERT INTO members (name, gender, birth_date, death_date, bio, phone, mother_name, city, nationality, occupation, work_type, work_place, generation)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
          `).run(
            record.name.trim(), gender,
            record.birth_date || null, record.death_date || null,
            record.bio || null, record.phone || null,
            record.mother_name || null, record.city || null,
            record.nationality || null, record.occupation || null,
            record.work_type || null, record.work_place || null
          );
          createdMemberIds.push(result.lastInsertRowid);
          imported++;
        }
      } catch (err) {
        errors.push({ name: record.name || '(فارغ)', error: err.message });
      }
    }

    // ─── PASS 2: Link father-child relationships ───
    for (const record of records) {
      try {
        if (!record.name || !record.father_name) continue;

        const member = db.prepare('SELECT id FROM members WHERE name = ?').get(record.name.trim());
        if (!member) continue;

        // Try exact match first, then fuzzy
        let father = db.prepare('SELECT id, generation FROM members WHERE name = ?').get(record.father_name.trim());
        if (!father) {
          father = db.prepare('SELECT id, generation FROM members WHERE name LIKE ?').get(`%${record.father_name.trim()}%`);
        }
        if (father) {
          const gen = father.generation + 1;
          db.prepare('UPDATE members SET father_id = ?, generation = ? WHERE id = ?').run(father.id, gen, member.id);
          relationshipsLinked++;
        }
      } catch (err) {
        errors.push({ name: record.name || '?', error: 'خطأ في ربط العلاقة: ' + err.message });
      }
    }

    // ─── PASS 3: Recalculate generations from roots downward ───
    function recalcGenerations(parentId, generation) {
      const children = db.prepare('SELECT id FROM members WHERE father_id = ?').all(parentId);
      for (const child of children) {
        db.prepare('UPDATE members SET generation = ? WHERE id = ?').run(generation, child.id);
        recalcGenerations(child.id, generation + 1);
      }
    }
    // Find root members (no father) and recalculate
    const roots = db.prepare('SELECT id FROM members WHERE father_id IS NULL').all();
    for (const root of roots) {
      db.prepare('UPDATE members SET generation = 1 WHERE id = ?').run(root.id);
      recalcGenerations(root.id, 2);
    }

    // ─── PASS 4: Link marriages/spouses ───
    for (const record of records) {
      try {
        if (!record.name || !record.spouse_name) continue;

        const spouseNames = record.spouse_name.split(/[,،]/).map(s => s.trim()).filter(Boolean);
        const member = db.prepare('SELECT id, gender FROM members WHERE name = ?').get(record.name.trim());
        if (!member) continue;

        for (const spouseName of spouseNames) {
          // Determine husband/wife based on gender
          let husbandId, wifeId, wifeName;
          const spouse = db.prepare('SELECT id FROM members WHERE name = ?').get(spouseName);

          if (member.gender === 'male') {
            husbandId = member.id;
            wifeId = spouse?.id || null;
            wifeName = spouseName;
          } else {
            // Female: spouse is husband
            if (spouse) {
              husbandId = spouse.id;
              wifeId = member.id;
              wifeName = record.name.trim();
            } else {
              continue; // Can't create marriage without husband in DB
            }
          }

          // Check if this marriage already exists
          const existingMarriage = db.prepare(
            'SELECT id FROM marriages WHERE husband_id = ? AND (wife_name = ? OR wife_id = ?)'
          ).get(husbandId, wifeName, wifeId || -1);

          if (!existingMarriage) {
            const order = (db.prepare('SELECT MAX(marriage_order) as max FROM marriages WHERE husband_id = ?').get(husbandId)?.max || 0) + 1;
            db.prepare('INSERT INTO marriages (husband_id, wife_id, wife_name, status, marriage_order) VALUES (?, ?, ?, ?, ?)').run(
              husbandId, wifeId, wifeName, 'married', order
            );
            marriagesCreated++;
          }
        }
      } catch (err) {
        errors.push({ name: record.name || '?', error: 'خطأ في ربط الزواج: ' + err.message });
      }
    }
  });

  importMany(data);

  // Log the import activity
  logActivity('import', 'member', null, null,
    `استيراد Excel: ${imported} جديد، ${updated} تحديث، ${relationshipsLinked} علاقة، ${marriagesCreated} زواج`,
    null, JSON.stringify({ member_ids: createdMemberIds, imported, updated, relationshipsLinked, marriagesCreated }), req.user);

  res.json({
    message: `تم استيراد ${imported} سجل جديد وتحديث ${updated} سجل وربط ${relationshipsLinked} علاقة و ${marriagesCreated} زواج`,
    imported,
    updated,
    relationshipsLinked,
    marriagesCreated,
    errors
  });
});

// Upload general file (image/pdf)
router.post('/file', authenticateToken, upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'لم يتم رفع ملف' });
  }

  db.prepare(
    'INSERT INTO uploads (filename, original_name, file_type, uploaded_by) VALUES (?, ?, ?, ?)'
  ).run(req.file.filename, req.file.originalname, req.file.mimetype, req.user.id);

  res.json({
    message: 'تم رفع الملف بنجاح',
    file: {
      filename: req.file.filename,
      originalName: req.file.originalname,
      size: req.file.size
    }
  });
});

// Get uploaded files
router.get('/files', authenticateToken, (req, res) => {
  const files = db.prepare('SELECT * FROM uploads ORDER BY created_at DESC').all();
  res.json(files);
});

module.exports = router;
