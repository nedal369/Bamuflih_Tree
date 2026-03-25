const express = require('express');
const db = require('../db/database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Get activity logs with pagination
router.get('/', authenticateToken, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'غير مصرح' });

  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 50;
  const offset = (page - 1) * limit;
  const entityType = req.query.entity_type;
  const action = req.query.action;

  let where = '';
  const params = [];
  const conditions = [];

  if (entityType) {
    conditions.push('entity_type = ?');
    params.push(entityType);
  }
  if (action) {
    conditions.push('action = ?');
    params.push(action);
  }
  if (conditions.length > 0) {
    where = 'WHERE ' + conditions.join(' AND ');
  }

  const total = db.prepare(`SELECT COUNT(*) as count FROM activity_log ${where}`).get(...params).count;
  const logs = db.prepare(`SELECT * FROM activity_log ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`).all(...params, limit, offset);

  res.json({ logs, total, page, limit, pages: Math.ceil(total / limit) });
});

// Revert a change
router.post('/:id/revert', authenticateToken, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'غير مصرح' });

  const log = db.prepare('SELECT * FROM activity_log WHERE id = ?').get(req.params.id);
  if (!log) return res.status(404).json({ error: 'السجل غير موجود' });

  try {
    if (log.action === 'create' && log.entity_type === 'member' && log.entity_id) {
      // Revert create = delete the member
      const member = db.prepare('SELECT * FROM members WHERE id = ?').get(log.entity_id);
      if (member) {
        db.prepare('UPDATE members SET father_id = NULL WHERE father_id = ?').run(log.entity_id);
        db.prepare('DELETE FROM marriages WHERE husband_id = ? OR wife_id = ?').run(log.entity_id, log.entity_id);
        db.prepare('DELETE FROM members WHERE id = ?').run(log.entity_id);
        logActivity('revert_delete', 'member', log.entity_id, member.name, `تراجع عن إضافة: ${member.name}`, JSON.stringify(member), null, req.user);
      }
    } else if (log.action === 'update' && log.entity_type === 'member' && log.old_data) {
      // Revert update = restore old data
      const oldData = JSON.parse(log.old_data);
      const current = db.prepare('SELECT * FROM members WHERE id = ?').get(log.entity_id);
      if (current) {
        db.prepare(`
          UPDATE members SET name = ?, father_id = ?, gender = ?, birth_date = ?, death_date = ?,
          bio = ?, phone = ?, mother_name = ?, city = ?, nationality = ?, occupation = ?,
          work_type = ?, work_place = ?, generation = ?, photo = ?, whatsapp = ?, twitter = ?,
          instagram = ?, snapchat = ?, tiktok = ?, family_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
        `).run(
          oldData.name, oldData.father_id, oldData.gender, oldData.birth_date, oldData.death_date,
          oldData.bio, oldData.phone, oldData.mother_name, oldData.city, oldData.nationality, oldData.occupation,
          oldData.work_type, oldData.work_place, oldData.generation, oldData.photo || null,
          oldData.whatsapp || null, oldData.twitter || null, oldData.instagram || null,
          oldData.snapchat || null, oldData.tiktok || null, oldData.family_id || null, log.entity_id
        );
        logActivity('revert_update', 'member', log.entity_id, oldData.name, `تراجع عن تعديل: ${oldData.name}`, JSON.stringify(current), log.old_data, req.user);
      }
    } else if (log.action === 'delete' && log.entity_type === 'member' && log.old_data) {
      // Revert delete = restore the member
      const oldData = JSON.parse(log.old_data);
      db.prepare(`
        INSERT INTO members (id, name, father_id, gender, birth_date, death_date, bio, phone, mother_name,
        city, nationality, occupation, work_type, work_place, generation, photo, whatsapp, twitter, instagram, snapchat, tiktok, family_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        oldData.id, oldData.name, oldData.father_id, oldData.gender, oldData.birth_date, oldData.death_date,
        oldData.bio, oldData.phone, oldData.mother_name, oldData.city, oldData.nationality, oldData.occupation,
        oldData.work_type, oldData.work_place, oldData.generation, oldData.photo || null,
        oldData.whatsapp || null, oldData.twitter || null, oldData.instagram || null,
        oldData.snapchat || null, oldData.tiktok || null, oldData.family_id || null
      );
      logActivity('revert_create', 'member', oldData.id, oldData.name, `تراجع عن حذف: ${oldData.name}`, null, log.old_data, req.user);
    } else if (log.action === 'create' && log.entity_type === 'marriage' && log.entity_id) {
      db.prepare('DELETE FROM marriages WHERE id = ?').run(log.entity_id);
      logActivity('revert_delete', 'marriage', log.entity_id, log.entity_name, `تراجع عن إضافة زواج`, null, null, req.user);
    } else if (log.action === 'delete' && log.entity_type === 'marriage' && log.old_data) {
      const oldData = JSON.parse(log.old_data);
      db.prepare('INSERT INTO marriages (id, husband_id, wife_id, wife_name, status, marriage_order) VALUES (?, ?, ?, ?, ?, ?)').run(
        oldData.id, oldData.husband_id, oldData.wife_id, oldData.wife_name, oldData.status, oldData.marriage_order
      );
      logActivity('revert_create', 'marriage', oldData.id, oldData.wife_name, `تراجع عن حذف زواج`, null, log.old_data, req.user);
    } else if (log.action === 'import') {
      // For bulk imports, we store the list of created IDs in new_data
      if (log.new_data) {
        const importData = JSON.parse(log.new_data);
        const ids = importData.member_ids || [];
        if (ids.length > 0) {
          const placeholders = ids.map(() => '?').join(',');
          db.prepare(`UPDATE members SET father_id = NULL WHERE father_id IN (${placeholders})`).run(...ids);
          db.prepare(`DELETE FROM marriages WHERE husband_id IN (${placeholders}) OR wife_id IN (${placeholders})`).run(...ids, ...ids);
          db.prepare(`DELETE FROM members WHERE id IN (${placeholders})`).run(...ids);
          logActivity('revert_import', 'member', null, null, `تراجع عن استيراد ${ids.length} عضو`, null, null, req.user);
        }
      }
      return res.json({ message: 'تم التراجع عن الاستيراد بنجاح' });
    } else {
      return res.status(400).json({ error: 'لا يمكن التراجع عن هذا الإجراء' });
    }

    res.json({ message: 'تم التراجع بنجاح' });
  } catch (error) {
    res.status(500).json({ error: 'خطأ في التراجع: ' + error.message });
  }
});

// Helper: log activity
function logActivity(action, entityType, entityId, entityName, details, oldData, newData, user) {
  db.prepare(`
    INSERT INTO activity_log (action, entity_type, entity_id, entity_name, details, old_data, new_data, user_id, username)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(action, entityType, entityId || null, entityName || null, details || null, oldData || null, newData || null, user?.id || null, user?.username || null);
}

module.exports = router;
module.exports.logActivity = logActivity;
