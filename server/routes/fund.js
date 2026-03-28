const express = require('express');
const db = require('../db/database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// GET /api/fund/summary - Fund overview
router.get('/summary', (req, res) => {
  const totalIn = db.prepare(`
    SELECT COALESCE(SUM(amount), 0) as total FROM fund_transactions
    WHERE type IN ('subscription', 'donation', 'zakat', 'loan_repayment', 'other_income')
  `).get().total;

  const totalOut = db.prepare(`
    SELECT COALESCE(SUM(amount), 0) as total FROM fund_transactions
    WHERE type IN ('loan_given', 'support', 'event_expense', 'other_expense')
  `).get().total;

  const activeLoans = db.prepare(`
    SELECT COUNT(*) as count, COALESCE(SUM(amount - amount_repaid), 0) as outstanding
    FROM fund_loans WHERE status = 'active'
  `).get();

  const pendingLoans = db.prepare(`
    SELECT COUNT(*) as count FROM fund_loans WHERE status = 'pending'
  `).get().count;

  const subscriptionTotal = db.prepare(`
    SELECT COALESCE(SUM(amount), 0) as total FROM fund_subscriptions
  `).get().total;

  res.json({
    balance: totalIn - totalOut,
    total_income: totalIn,
    total_expense: totalOut,
    subscription_total: subscriptionTotal,
    active_loans_count: activeLoans.count,
    active_loans_outstanding: activeLoans.outstanding,
    pending_loans_count: pendingLoans,
  });
});

// GET /api/fund/transactions - List transactions with optional filters
router.get('/transactions', (req, res) => {
  const { type, member_id, page = 1, limit = 50 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  let where = [];
  let params = [];

  if (type) { where.push('ft.type = ?'); params.push(type); }
  if (member_id) { where.push('ft.member_id = ?'); params.push(member_id); }

  const whereClause = where.length ? 'WHERE ' + where.join(' AND ') : '';

  const transactions = db.prepare(`
    SELECT ft.*, m.name as member_name, u.username as created_by_username
    FROM fund_transactions ft
    LEFT JOIN members m ON ft.member_id = m.id
    LEFT JOIN users u ON ft.created_by = u.id
    ${whereClause}
    ORDER BY ft.created_at DESC
    LIMIT ? OFFSET ?
  `).all([...params, parseInt(limit), offset]);

  const total = db.prepare(`
    SELECT COUNT(*) as count FROM fund_transactions ft ${whereClause}
  `).get(params).count;

  res.json({ transactions, total, pages: Math.ceil(total / parseInt(limit)) });
});

// POST /api/fund/transactions - Add a transaction (admin only)
router.post('/transactions', authenticateToken, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'غير مصرح' });

  const { type, amount, member_id, description, date } = req.body;
  if (!type || !amount) return res.status(400).json({ error: 'النوع والمبلغ مطلوبان' });

  const validTypes = ['subscription', 'donation', 'zakat', 'loan_given', 'loan_repayment', 'support', 'event_expense', 'other_income', 'other_expense'];
  if (!validTypes.includes(type)) return res.status(400).json({ error: 'نوع المعاملة غير صالح' });

  const result = db.prepare(`
    INSERT INTO fund_transactions (type, amount, member_id, description, date, created_by)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(type, parseFloat(amount), member_id || null, description || null, date || new Date().toISOString().split('T')[0], req.user.id);

  res.status(201).json({ id: result.lastInsertRowid, message: 'تم تسجيل المعاملة بنجاح' });
});

// GET /api/fund/loans - List loans
router.get('/loans', (req, res) => {
  const { status } = req.query;
  let where = status ? 'WHERE fl.status = ?' : '';
  let params = status ? [status] : [];

  const loans = db.prepare(`
    SELECT fl.*, m.name as member_name
    FROM fund_loans fl
    JOIN members m ON fl.member_id = m.id
    ${where}
    ORDER BY fl.created_at DESC
  `).all(params);

  res.json(loans);
});

// POST /api/fund/loans - Request a loan (authenticated users)
router.post('/loans', authenticateToken, (req, res) => {
  const { member_id, amount, purpose, requested_date, due_date } = req.body;
  if (!member_id || !amount) return res.status(400).json({ error: 'العضو والمبلغ مطلوبان' });

  const result = db.prepare(`
    INSERT INTO fund_loans (member_id, amount, purpose, status, requested_date, due_date)
    VALUES (?, ?, ?, 'pending', ?, ?)
  `).run(parseInt(member_id), parseFloat(amount), purpose || null, requested_date || null, due_date || null);

  res.status(201).json({ id: result.lastInsertRowid, message: 'تم تقديم طلب القرض' });
});

// PUT /api/fund/loans/:id - Update loan status (admin only)
router.put('/loans/:id', authenticateToken, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'غير مصرح' });

  const { status, approved_date, amount_repaid, notes } = req.body;
  const loan = db.prepare('SELECT * FROM fund_loans WHERE id = ?').get(req.params.id);
  if (!loan) return res.status(404).json({ error: 'القرض غير موجود' });

  db.prepare(`
    UPDATE fund_loans SET status = ?, approved_date = ?, amount_repaid = ?, notes = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(
    status || loan.status,
    approved_date || loan.approved_date,
    amount_repaid !== undefined ? parseFloat(amount_repaid) : loan.amount_repaid,
    notes !== undefined ? notes : loan.notes,
    req.params.id
  );

  // If approved, change status to active and record the loan transaction
  if (status === 'approved' && loan.status === 'pending') {
    db.prepare(`
      INSERT INTO fund_transactions (type, amount, member_id, description, date, created_by)
      VALUES ('loan_given', ?, ?, ?, ?, ?)
    `).run(loan.amount, loan.member_id, `قرض حسن للعضو`, approved_date || new Date().toISOString().split('T')[0], req.user.id);

    db.prepare("UPDATE fund_loans SET status = 'active' WHERE id = ?").run(req.params.id);
  }

  res.json({ message: 'تم تحديث القرض' });
});

// GET /api/fund/subscriptions - List subscriptions
router.get('/subscriptions', (req, res) => {
  const { year, month, member_id } = req.query;
  let where = [];
  let params = [];

  if (year) { where.push('fs.year = ?'); params.push(parseInt(year)); }
  if (month) { where.push('fs.month = ?'); params.push(parseInt(month)); }
  if (member_id) { where.push('fs.member_id = ?'); params.push(parseInt(member_id)); }

  const whereClause = where.length ? 'WHERE ' + where.join(' AND ') : '';

  const subs = db.prepare(`
    SELECT fs.*, m.name as member_name
    FROM fund_subscriptions fs
    JOIN members m ON fs.member_id = m.id
    ${whereClause}
    ORDER BY fs.year DESC, fs.month DESC, m.name
  `).all(params);

  res.json(subs);
});

// POST /api/fund/subscriptions - Record a subscription payment (admin only)
router.post('/subscriptions', authenticateToken, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'غير مصرح' });

  const { member_id, year, month, amount, paid_date } = req.body;
  if (!member_id || !year || !month || !amount) {
    return res.status(400).json({ error: 'العضو والسنة والشهر والمبلغ مطلوبة' });
  }

  try {
    const result = db.prepare(`
      INSERT INTO fund_subscriptions (member_id, year, month, amount, paid_date)
      VALUES (?, ?, ?, ?, ?)
    `).run(parseInt(member_id), parseInt(year), parseInt(month), parseFloat(amount), paid_date || new Date().toISOString().split('T')[0]);

    // Also record a transaction
    db.prepare(`
      INSERT INTO fund_transactions (type, amount, member_id, description, date, created_by)
      VALUES ('subscription', ?, ?, ?, ?, ?)
    `).run(parseFloat(amount), parseInt(member_id), `اشتراك شهر ${month}/${year}`, paid_date || new Date().toISOString().split('T')[0], req.user.id);

    res.status(201).json({ id: result.lastInsertRowid, message: 'تم تسجيل الاشتراك' });
  } catch (err) {
    if (err.message.includes('UNIQUE')) {
      return res.status(400).json({ error: 'هذا الاشتراك مسجل مسبقاً' });
    }
    throw err;
  }
});

// GET /api/fund/members-status - Show all members with subscription status for a given month
router.get('/members-status', (req, res) => {
  const now = new Date();
  const year = parseInt(req.query.year) || now.getFullYear();
  const month = parseInt(req.query.month) || now.getMonth() + 1;

  const members = db.prepare(`
    SELECT m.id, m.name, m.generation, m.gender,
      fs.amount as paid_amount, fs.paid_date
    FROM members m
    LEFT JOIN fund_subscriptions fs
      ON fs.member_id = m.id AND fs.year = ? AND fs.month = ?
    WHERE m.gender = 'male' AND m.death_date IS NULL
    ORDER BY m.generation, m.name
  `).all(year, month);

  res.json({ year, month, members });
});

// ─── EVENTS (Event Cost Calculator) ───

// Helper: categorize attendee based on event rules
function categorizeAttendee(member, rules, allMembers, allMarriages) {
  // Deceased = skip
  if (member.death_date) return { category: 'deceased', cost: 0, reason: 'متوفى' };

  // Age calculation
  let age = null;
  if (member.birth_date) {
    const today = new Date();
    const birth = new Date(member.birth_date);
    age = Math.floor((today - birth) / (365.25 * 24 * 60 * 60 * 1000));
  }

  // Check: is this member a non-Bamuflih husband of a Bamuflih female?
  if (rules.exempt_non_bamuflih_spouses) {
    const isNonBamuflih = member.family_id != null;
    if (isNonBamuflih && member.gender === 'male') {
      const marriage = allMarriages.find(m => m.husband_id === member.id && m.wife_id != null);
      if (marriage) {
        const wife = allMembers.find(m => m.id === marriage.wife_id);
        if (wife && wife.family_id == null) {
          return { category: 'free', cost: 0, reason: 'زوج بنت من خارج العائلة' };
        }
      }
    }
  }

  // Check: is this member a child of a non-Bamuflih husband of a Bamuflih female?
  if (rules.exempt_their_children && member.father_id) {
    const father = allMembers.find(m => m.id === member.father_id);
    if (father && father.family_id != null) {
      const marriage = allMarriages.find(m => m.husband_id === father.id && m.wife_id != null);
      if (marriage) {
        const mother = allMembers.find(m => m.id === marriage.wife_id);
        if (mother && mother.family_id == null) {
          return { category: 'free', cost: 0, reason: 'ابن/بنت زوج من خارج العائلة' };
        }
      }
    }
  }

  // Check custom rules (by condition_type)
  const customRules = rules.custom_rules || [];
  for (const cr of customRules) {
    if (!cr.enabled) continue;
    if (cr.condition_type === 'age_above' && age !== null && age > cr.condition_value) {
      return { category: 'custom', cost: rules.adult_cost * (cr.cost_multiplier || 0), reason: cr.name };
    }
    if (cr.condition_type === 'age_below' && age !== null && age < cr.condition_value) {
      return { category: 'custom', cost: rules.adult_cost * (cr.cost_multiplier || 0), reason: cr.name };
    }
    if (cr.condition_type === 'free') {
      return { category: 'free', cost: 0, reason: cr.name };
    }
  }

  // Age-based tiers
  if (age !== null) {
    if (age <= rules.child_age_max) {
      return { category: 'child', cost: rules.adult_cost * (rules.child_cost_multiplier || 0), reason: `طفل (${age} سنة)` };
    }
    if (age <= rules.young_age_max) {
      return { category: 'young', cost: rules.adult_cost * (rules.young_cost_multiplier || 0.5), reason: `صغير (${age} سنة)` };
    }
  }

  return { category: 'adult', cost: rules.adult_cost, reason: 'بالغ' };
}

// GET /api/fund/events
router.get('/events', (req, res) => {
  const events = db.prepare(`
    SELECT fe.*, u.username as created_by_username,
      (SELECT COUNT(*) FROM fund_event_attendees WHERE event_id = fe.id) as attendee_count
    FROM fund_events fe
    LEFT JOIN users u ON fe.created_by = u.id
    ORDER BY fe.created_at DESC
  `).all();

  res.json(events.map(e => ({
    ...e,
    custom_rules: e.custom_rules ? JSON.parse(e.custom_rules) : []
  })));
});

// GET /api/fund/events/:id - Get event with attendees and cost calculation
router.get('/events/:id', (req, res) => {
  const event = db.prepare('SELECT * FROM fund_events WHERE id = ?').get(req.params.id);
  if (!event) return res.status(404).json({ error: 'الفعالية غير موجودة' });

  event.custom_rules = event.custom_rules ? JSON.parse(event.custom_rules) : [];

  const attendees = db.prepare(`
    SELECT fea.*, m.name as member_name, m.birth_date, m.gender, m.family_id, m.father_id, m.death_date
    FROM fund_event_attendees fea
    LEFT JOIN members m ON fea.member_id = m.id
    WHERE fea.event_id = ?
    ORDER BY fea.id
  `).all(req.params.id);

  const allMembers = db.prepare('SELECT * FROM members').all();
  const allMarriages = db.prepare('SELECT * FROM marriages').all();

  const rules = {
    adult_cost: event.adult_cost,
    child_age_max: event.child_age_max,
    young_age_max: event.young_age_max,
    young_cost_multiplier: event.young_cost_multiplier,
    child_cost_multiplier: event.child_cost_multiplier,
    exempt_non_bamuflih_spouses: !!event.exempt_non_bamuflih_spouses,
    exempt_their_children: !!event.exempt_their_children,
    custom_rules: event.custom_rules,
  };

  const enrichedAttendees = attendees.map(att => {
    const memberData = att.member_id ? allMembers.find(m => m.id === att.member_id) : null;
    let auto = { category: 'adult', cost: event.adult_cost, reason: 'بالغ' };
    if (memberData) auto = categorizeAttendee(memberData, rules, allMembers, allMarriages);

    const finalCost = att.cost_override !== null && att.cost_override !== undefined ? att.cost_override : auto.cost;
    const finalCategory = att.category || auto.category;
    return {
      ...att,
      auto_category: auto.category,
      auto_cost: auto.cost,
      auto_reason: auto.reason,
      final_cost: finalCost,
      final_category: finalCategory,
    };
  });

  const total = enrichedAttendees.reduce((sum, a) => sum + (a.final_cost || 0), 0);

  res.json({ ...event, attendees: enrichedAttendees, total_cost: total });
});

// POST /api/fund/events - Create event
router.post('/events', authenticateToken, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'غير مصرح' });

  const {
    name, date, description, adult_cost = 0,
    child_age_max = 6, young_age_max = 15,
    young_cost_multiplier = 0.5, child_cost_multiplier = 0,
    exempt_non_bamuflih_spouses = 1, exempt_their_children = 1,
    custom_rules = [], notes, status = 'planning'
  } = req.body;

  if (!name) return res.status(400).json({ error: 'اسم الفعالية مطلوب' });

  const result = db.prepare(`
    INSERT INTO fund_events (name, date, description, adult_cost, child_age_max, young_age_max,
      young_cost_multiplier, child_cost_multiplier, exempt_non_bamuflih_spouses,
      exempt_their_children, custom_rules, notes, status, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(name, date || null, description || null, adult_cost, child_age_max, young_age_max,
    young_cost_multiplier, child_cost_multiplier, exempt_non_bamuflih_spouses ? 1 : 0,
    exempt_their_children ? 1 : 0, JSON.stringify(custom_rules), notes || null, status, req.user.id);

  res.status(201).json({ id: result.lastInsertRowid, message: 'تم إنشاء الفعالية' });
});

// PUT /api/fund/events/:id - Update event
router.put('/events/:id', authenticateToken, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'غير مصرح' });

  const event = db.prepare('SELECT * FROM fund_events WHERE id = ?').get(req.params.id);
  if (!event) return res.status(404).json({ error: 'الفعالية غير موجودة' });

  const fields = ['name','date','description','adult_cost','child_age_max','young_age_max',
    'young_cost_multiplier','child_cost_multiplier','exempt_non_bamuflih_spouses',
    'exempt_their_children','custom_rules','notes','status'];

  const updates = {};
  for (const f of fields) {
    if (req.body[f] !== undefined) {
      updates[f] = f === 'custom_rules' ? JSON.stringify(req.body[f]) : req.body[f];
    }
  }

  if (Object.keys(updates).length === 0) return res.json({ message: 'لا تغييرات' });

  const setClauses = Object.keys(updates).map(k => `${k} = ?`).join(', ');
  db.prepare(`UPDATE fund_events SET ${setClauses}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`)
    .run(...Object.values(updates), req.params.id);

  res.json({ message: 'تم التحديث' });
});

// DELETE /api/fund/events/:id
router.delete('/events/:id', authenticateToken, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'غير مصرح' });
  db.prepare('DELETE FROM fund_events WHERE id = ?').run(req.params.id);
  res.json({ message: 'تم الحذف' });
});

// POST /api/fund/events/:id/attendees - Add attendee
router.post('/events/:id/attendees', authenticateToken, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'غير مصرح' });

  const { member_id, guest_name, category, cost_override, free_reason } = req.body;

  const result = db.prepare(`
    INSERT INTO fund_event_attendees (event_id, member_id, guest_name, category, cost_override, free_reason)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(req.params.id, member_id || null, guest_name || null, category || 'adult',
    cost_override !== undefined ? cost_override : null, free_reason || null);

  res.status(201).json({ id: result.lastInsertRowid });
});

// PUT /api/fund/events/:id/attendees/:attId - Update attendee
router.put('/events/:id/attendees/:attId', authenticateToken, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'غير مصرح' });

  const { category, cost_override, free_reason } = req.body;
  db.prepare(`UPDATE fund_event_attendees SET category = ?, cost_override = ?, free_reason = ? WHERE id = ? AND event_id = ?`)
    .run(category || 'adult', cost_override !== undefined ? cost_override : null, free_reason || null,
      req.params.attId, req.params.id);

  res.json({ message: 'تم التحديث' });
});

// DELETE /api/fund/events/:id/attendees/:attId
router.delete('/events/:id/attendees/:attId', authenticateToken, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'غير مصرح' });
  db.prepare('DELETE FROM fund_event_attendees WHERE id = ? AND event_id = ?').run(req.params.attId, req.params.id);
  res.json({ message: 'تم الحذف' });
});

// POST /api/fund/events/:id/calculate - Auto-add all members and calculate
router.post('/events/:id/calculate', authenticateToken, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'غير مصرح' });

  const event = db.prepare('SELECT * FROM fund_events WHERE id = ?').get(req.params.id);
  if (!event) return res.status(404).json({ error: 'الفعالية غير موجودة' });

  const rules = {
    adult_cost: event.adult_cost,
    child_age_max: event.child_age_max,
    young_age_max: event.young_age_max,
    young_cost_multiplier: event.young_cost_multiplier,
    child_cost_multiplier: event.child_cost_multiplier,
    exempt_non_bamuflih_spouses: !!event.exempt_non_bamuflih_spouses,
    exempt_their_children: !!event.exempt_their_children,
    custom_rules: event.custom_rules ? JSON.parse(event.custom_rules) : [],
  };

  const allMembers = db.prepare('SELECT * FROM members').all();
  const allMarriages = db.prepare('SELECT * FROM marriages').all();

  // Clear existing attendees and recalculate
  db.prepare('DELETE FROM fund_event_attendees WHERE event_id = ?').run(event.id);

  const insert = db.prepare(`
    INSERT INTO fund_event_attendees (event_id, member_id, category, cost_override, free_reason)
    VALUES (?, ?, ?, ?, ?)
  `);

  const insertAll = db.transaction(() => {
    for (const member of allMembers) {
      if (member.death_date) continue;
      const result = categorizeAttendee(member, rules, allMembers, allMarriages);
      insert.run(event.id, member.id, result.category,
        result.category === 'free' || result.category === 'child' ? 0 : null,
        result.reason);
    }
  });
  insertAll();

  const count = db.prepare('SELECT COUNT(*) as c FROM fund_event_attendees WHERE event_id = ?').get(event.id).c;
  res.json({ message: `تم حساب تكلفة ${count} عضو`, count });
});

module.exports = router;
