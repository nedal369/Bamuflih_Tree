const express = require('express');
const XLSX = require('xlsx');
const path = require('path');
const db = require('../db/database');
const { authenticateToken } = require('../middleware/auth');
const upload = require('../middleware/upload');

const router = express.Router();

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
      'الجنس': 'gender',
      'gender': 'gender',
      'تاريخ الميلاد': 'birth_date',
      'birth_date': 'birth_date',
      'تاريخ الوفاة': 'death_date',
      'death_date': 'death_date',
      'ملاحظات': 'bio',
      'bio': 'bio',
      'الهاتف': 'phone',
      'phone': 'phone',
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

// Import parsed Excel data
router.post('/excel/import', authenticateToken, (req, res) => {
  const { data } = req.body;

  if (!data || !Array.isArray(data)) {
    return res.status(400).json({ error: 'البيانات غير صالحة' });
  }

  const insert = db.prepare(`
    INSERT INTO members (name, father_id, gender, birth_date, death_date, bio, phone, generation)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  let imported = 0;
  let errors = [];

  const importMany = db.transaction((records) => {
    for (const record of records) {
      try {
        // Try to find father by name
        let fatherId = null;
        if (record.father_name) {
          const father = db.prepare('SELECT id FROM members WHERE name LIKE ?').get(`%${record.father_name}%`);
          if (father) fatherId = father.id;
        }

        let gen = record.generation || 1;
        if (fatherId && !record.generation) {
          const father = db.prepare('SELECT generation FROM members WHERE id = ?').get(fatherId);
          if (father) gen = father.generation + 1;
        }

        const gender = record.gender === 'أنثى' || record.gender === 'female' ? 'female' : 'male';

        insert.run(
          record.name,
          fatherId,
          gender,
          record.birth_date || null,
          record.death_date || null,
          record.bio || null,
          record.phone || null,
          gen
        );
        imported++;
      } catch (err) {
        errors.push({ name: record.name, error: err.message });
      }
    }
  });

  importMany(data);

  res.json({
    message: `تم استيراد ${imported} سجل`,
    imported,
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
