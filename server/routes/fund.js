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

module.exports = router;
