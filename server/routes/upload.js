const express = require('express');
const XLSX = require('xlsx');
const path = require('path');
const db = require('../db/database');
const { authenticateToken } = require('../middleware/auth');
const upload = require('../middleware/upload');

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

// Import parsed Excel data (update existing + add new)
router.post('/excel/import', authenticateToken, (req, res) => {
  const { data } = req.body;

  if (!data || !Array.isArray(data)) {
    return res.status(400).json({ error: 'البيانات غير صالحة' });
  }

  let imported = 0;
  let updated = 0;
  let errors = [];

  const importMany = db.transaction((records) => {
    for (const record of records) {
      try {
        if (!record.name) {
          errors.push({ name: '(فارغ)', error: 'الاسم مطلوب' });
          continue;
        }

        // Try to find father by name
        let fatherId = null;
        if (record.father_name) {
          const father = db.prepare('SELECT id FROM members WHERE name = ?').get(record.father_name);
          if (!father) {
            const fuzzy = db.prepare('SELECT id FROM members WHERE name LIKE ?').get(`%${record.father_name}%`);
            if (fuzzy) fatherId = fuzzy.id;
          } else {
            fatherId = father.id;
          }
        }

        let gen = record.generation ? parseInt(record.generation) : null;
        if (fatherId && !gen) {
          const father = db.prepare('SELECT generation FROM members WHERE id = ?').get(fatherId);
          if (father) gen = father.generation + 1;
        }
        if (!gen) gen = 1;

        const gender = record.gender === 'أنثى' || record.gender === 'female' ? 'female' : 'male';

        // Check if member already exists (exact name match)
        const existing = db.prepare('SELECT id FROM members WHERE name = ?').get(record.name);

        if (existing) {
          // Update existing member
          db.prepare(`
            UPDATE members SET father_id = COALESCE(?, father_id), gender = ?,
            birth_date = COALESCE(?, birth_date), death_date = COALESCE(?, death_date),
            bio = COALESCE(?, bio), phone = COALESCE(?, phone),
            mother_name = COALESCE(?, mother_name), city = COALESCE(?, city),
            nationality = COALESCE(?, nationality), work_type = COALESCE(?, work_type),
            work_place = COALESCE(?, work_place), generation = ?,
            updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
          `).run(
            fatherId, gender,
            record.birth_date || null, record.death_date || null,
            record.bio || null, record.phone || null,
            record.mother_name || null, record.city || null,
            record.nationality || null, record.work_type || null,
            record.work_place || null, gen,
            existing.id
          );
          updated++;
        } else {
          // Insert new member
          db.prepare(`
            INSERT INTO members (name, father_id, gender, birth_date, death_date, bio, phone, mother_name, city, nationality, work_type, work_place, generation)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).run(
            record.name, fatherId, gender,
            record.birth_date || null, record.death_date || null,
            record.bio || null, record.phone || null,
            record.mother_name || null, record.city || null,
            record.nationality || null, record.work_type || null,
            record.work_place || null, gen
          );
          imported++;
        }

        // Handle spouse/marriage if provided
        if (record.spouse_name && gender === 'male') {
          const existingMarriage = db.prepare(
            'SELECT id FROM marriages WHERE husband_id = (SELECT id FROM members WHERE name = ?) AND wife_name = ?'
          ).get(record.name, record.spouse_name);
          if (!existingMarriage) {
            const memberId = db.prepare('SELECT id FROM members WHERE name = ?').get(record.name);
            if (memberId) {
              const order = (db.prepare('SELECT MAX(marriage_order) as max FROM marriages WHERE husband_id = ?').get(memberId.id)?.max || 0) + 1;
              const wifeId = db.prepare('SELECT id FROM members WHERE name = ?').get(record.spouse_name);
              db.prepare('INSERT INTO marriages (husband_id, wife_id, wife_name, status, marriage_order) VALUES (?, ?, ?, ?, ?)').run(
                memberId.id, wifeId?.id || null, record.spouse_name, 'married', order
              );
            }
          }
        }
      } catch (err) {
        errors.push({ name: record.name || '(فارغ)', error: err.message });
      }
    }
  });

  importMany(data);

  res.json({
    message: `تم استيراد ${imported} سجل جديد وتحديث ${updated} سجل`,
    imported,
    updated,
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
