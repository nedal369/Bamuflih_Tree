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
    SELECT fsr.subscriber_code, m.id, m.name, m.generation, m.gender,
      fs.amount as paid_amount, fs.paid_date
    FROM fund_subscriber_registrations fsr
    JOIN members m ON m.id = fsr.member_id
    LEFT JOIN fund_subscriptions fs
      ON fs.member_id = m.id AND fs.year = ? AND fs.month = ?
    ORDER BY fsr.subscriber_code, m.name
  `).all(year, month);

  res.json({ year, month, members });
});

// ─── SUBSCRIBER REGISTRATIONS ───

// GET /api/fund/subscribers - List all registered fund subscribers
router.get('/subscribers', (req, res) => {
  const rows = db.prepare(`
    SELECT fsr.id, fsr.member_id, fsr.subscriber_code, fsr.monthly_amount,
           fsr.registered_date, fsr.notes, fsr.created_at,
           m.name as member_name, m.generation, m.gender
    FROM fund_subscriber_registrations fsr
    JOIN members m ON m.id = fsr.member_id
    ORDER BY fsr.subscriber_code
  `).all();
  res.json(rows);
});

// POST /api/fund/subscribers - Register a member as a fund subscriber (admin only)
router.post('/subscribers', authenticateToken, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'غير مصرح' });

  const { member_id, monthly_amount = 100, registered_date, notes } = req.body;
  if (!member_id || !registered_date) {
    return res.status(400).json({ error: 'معرف العضو وتاريخ التسجيل مطلوبان' });
  }

  // Check member exists
  const member = db.prepare('SELECT id, name FROM members WHERE id = ?').get(parseInt(member_id));
  if (!member) return res.status(404).json({ error: 'العضو غير موجود' });

  // Auto-generate subscriber code
  const count = db.prepare('SELECT COUNT(*) as c FROM fund_subscriber_registrations').get().c;
  const subscriber_code = 'SUB-' + String(count + 1).padStart(3, '0');

  try {
    const result = db.prepare(`
      INSERT INTO fund_subscriber_registrations (member_id, subscriber_code, monthly_amount, registered_date, notes)
      VALUES (?, ?, ?, ?, ?)
    `).run(parseInt(member_id), subscriber_code, parseFloat(monthly_amount), registered_date, notes || null);

    res.status(201).json({ id: result.lastInsertRowid, subscriber_code, message: 'تم تسجيل المشترك بنجاح' });
  } catch (err) {
    if (err.message.includes('UNIQUE')) {
      return res.status(400).json({ error: 'هذا العضو مسجل كمشترك مسبقاً' });
    }
    throw err;
  }
});

// DELETE /api/fund/subscribers/:id - Remove a subscriber registration (admin only)
router.delete('/subscribers/:id', authenticateToken, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'غير مصرح' });

  const existing = db.prepare('SELECT id FROM fund_subscriber_registrations WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'المشترك غير موجود' });

  db.prepare('DELETE FROM fund_subscriber_registrations WHERE id = ?').run(req.params.id);
  res.json({ message: 'تم إلغاء تسجيل المشترك' });
});

// ─── FAMILY HEADS ───

// Helper: build family for a head, excluding children who are also selected heads
function buildFamily(headId, allHeadIds, childAgeMax, youngAgeMax) {
  const db2 = db; // alias
  const head = db2.prepare('SELECT * FROM members WHERE id = ?').get(headId);
  if (!head) return null;

  const today = new Date();
  const categorize = (birthDate) => {
    if (!birthDate) return 'adult';
    const birth = new Date(birthDate);
    const age = Math.floor((today - birth) / (365.25 * 24 * 60 * 60 * 1000));
    if (age <= childAgeMax) return 'child';
    if (age <= youngAgeMax) return 'young';
    return 'adult';
  };

  const familyMembers = [];
  const headIdsSet = new Set(allHeadIds);

  // Head himself
  familyMembers.push({ id: head.id, name: head.name, relationship: 'head', category: categorize(head.birth_date) });

  // Wives
  const wives = db2.prepare(`
    SELECT mar.wife_id, mar.wife_name, w.name as wife_member_name, w.birth_date as wife_birth_date, w.death_date as wife_death_date
    FROM marriages mar LEFT JOIN members w ON mar.wife_id = w.id
    WHERE mar.husband_id = ? AND mar.status = 'married'
  `).all(headId);

  for (const w of wives) {
    if (w.wife_id && !w.wife_death_date) {
      familyMembers.push({ id: w.wife_id, name: w.wife_member_name || w.wife_name, relationship: 'wife', category: categorize(w.wife_birth_date) });
    } else if (!w.wife_id && w.wife_name) {
      familyMembers.push({ id: null, name: w.wife_name, relationship: 'wife', category: 'adult' });
    }
  }

  // Children — skip those who are also selected as family heads (they have their own family)
  const children = db2.prepare('SELECT id, name, birth_date, gender FROM members WHERE father_id = ? AND death_date IS NULL').all(headId);
  for (const c of children) {
    if (headIdsSet.has(c.id)) continue; // deduplicate: this child is counted in his own family
    familyMembers.push({ id: c.id, name: c.name, relationship: 'child', category: categorize(c.birth_date) });
  }

  return {
    members: familyMembers,
    adult_count: familyMembers.filter(m => m.category === 'adult').length,
    young_count: familyMembers.filter(m => m.category === 'young').length,
    child_count: familyMembers.filter(m => m.category === 'child').length,
  };
}

// GET /api/fund/family-heads - Get all family heads with subscriber status and family composition
router.get('/family-heads', (req, res) => {
  const { child_age_max = 6, young_age_max = 15, selected_ids } = req.query;

  const heads = db.prepare(`
    SELECT m.id, m.name, m.birth_date, m.gender, m.generation,
      CASE WHEN fsr.id IS NOT NULL THEN 1
           WHEN COALESCE(u.is_fund_subscriber, 0) = 1 THEN 1
           ELSE 0
      END as is_fund_subscriber
    FROM members m
    LEFT JOIN users u ON u.member_id = m.id AND u.status = 'approved'
    LEFT JOIN fund_subscriber_registrations fsr ON fsr.member_id = m.id
    WHERE m.gender = 'male'
      AND m.death_date IS NULL
      AND EXISTS (SELECT 1 FROM members c WHERE c.father_id = m.id)
    ORDER BY m.generation, m.name
  `).all();

  // Parse selected IDs for deduplication
  const allHeadIds = selected_ids ? selected_ids.split(',').map(Number) : heads.map(h => h.id);

  const result = heads.map(head => {
    const family = buildFamily(head.id, allHeadIds, parseInt(child_age_max), parseInt(young_age_max));
    if (!family) return null;

    return {
      id: head.id,
      name: head.name,
      generation: head.generation,
      is_fund_subscriber: !!head.is_fund_subscriber,
      family_members: family.members,
      adult_count: family.adult_count,
      young_count: family.young_count,
      child_count: family.child_count,
      total_members: family.members.length,
    };
  }).filter(Boolean);

  res.json(result);
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
    custom_rules: e.custom_rules ? JSON.parse(e.custom_rules) : [],
    subscriber_exemptions: e.subscriber_exemptions ? JSON.parse(e.subscriber_exemptions) : [],
  })));
});

// GET /api/fund/events/:id - Get event with attendees and cost calculation
router.get('/events/:id', (req, res) => {
  const event = db.prepare('SELECT * FROM fund_events WHERE id = ?').get(req.params.id);
  if (!event) return res.status(404).json({ error: 'الفعالية غير موجودة' });

  event.custom_rules = event.custom_rules ? JSON.parse(event.custom_rules) : [];
  event.subscriber_exemptions = event.subscriber_exemptions ? JSON.parse(event.subscriber_exemptions) : [];

  // Load family-based data
  const families = db.prepare(`
    SELECT fef.*, m.name as head_name
    FROM fund_event_families fef
    JOIN members m ON fef.head_member_id = m.id
    WHERE fef.event_id = ?
    ORDER BY m.name
  `).all(req.params.id);

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
  const familyTotal = families.reduce((sum, f) => sum + (f.total_cost || 0), 0);

  // Calculate per-person rates (total costs ÷ total people)
  const costItems = { dinner: event.dinner_cost || 0, venue: event.venue_cost || 0, hospitality: event.hospitality_cost || 0, other: event.other_cost || 0 };
  const exemptions = event.subscriber_exemptions || [];
  const totalCostAll = Object.values(costItems).reduce((s, v) => s + v, 0);
  const subscriberExemptTotal = exemptions.reduce((s, key) => s + (costItems[key] || 0), 0);
  const totalPeople = families.reduce((s, f) => s + f.adult_count + f.young_count + f.child_count, 0) || 1;
  const perPersonAll = totalCostAll / totalPeople;
  const perPersonSubscriberExempt = subscriberExemptTotal / totalPeople;
  const surcharge = event.non_subscriber_surcharge || 0;
  const youngMultiplier = event.young_cost_multiplier || 0.5;
  const childMultiplier = event.child_cost_multiplier || 0;
  const subscriberAdultRate = perPersonAll - perPersonSubscriberExempt;
  const nonSubscriberAdultRate = perPersonAll + surcharge;

  res.json({
    ...event,
    attendees: enrichedAttendees,
    total_cost: total,
    families,
    family_total_cost: familyTotal,
    total_people: totalPeople,
    rates: {
      subscriber_adult: subscriberAdultRate,
      non_subscriber_adult: nonSubscriberAdultRate,
      subscriber_young: subscriberAdultRate * youngMultiplier,
      non_subscriber_young: nonSubscriberAdultRate * youngMultiplier,
      subscriber_child: subscriberAdultRate * childMultiplier,
      non_subscriber_child: nonSubscriberAdultRate * childMultiplier,
    }
  });
});

// POST /api/fund/events - Create event
router.post('/events', authenticateToken, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'غير مصرح' });

  const {
    name, date, description, adult_cost = 0,
    child_age_max = 6, young_age_max = 15,
    young_cost_multiplier = 0.5, child_cost_multiplier = 0,
    exempt_non_bamuflih_spouses = 1, exempt_their_children = 1,
    custom_rules = [], notes, status = 'planning',
    dinner_cost = 0, venue_cost = 0, hospitality_cost = 0, other_cost = 0,
    subscriber_exemptions = [], non_subscriber_surcharge = 0
  } = req.body;

  if (!name) return res.status(400).json({ error: 'اسم الفعالية مطلوب' });

  const result = db.prepare(`
    INSERT INTO fund_events (name, date, description, adult_cost, child_age_max, young_age_max,
      young_cost_multiplier, child_cost_multiplier, exempt_non_bamuflih_spouses,
      exempt_their_children, custom_rules, notes, status, created_by,
      dinner_cost, venue_cost, hospitality_cost, other_cost, subscriber_exemptions, non_subscriber_surcharge)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(name, date || null, description || null, adult_cost, child_age_max, young_age_max,
    young_cost_multiplier, child_cost_multiplier, exempt_non_bamuflih_spouses ? 1 : 0,
    exempt_their_children ? 1 : 0, JSON.stringify(custom_rules), notes || null, status, req.user.id,
    dinner_cost, venue_cost, hospitality_cost, other_cost,
    JSON.stringify(subscriber_exemptions), non_subscriber_surcharge);

  res.status(201).json({ id: result.lastInsertRowid, message: 'تم إنشاء الفعالية' });
});

// PUT /api/fund/events/:id - Update event
router.put('/events/:id', authenticateToken, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'غير مصرح' });

  const event = db.prepare('SELECT * FROM fund_events WHERE id = ?').get(req.params.id);
  if (!event) return res.status(404).json({ error: 'الفعالية غير موجودة' });

  const fields = ['name','date','description','adult_cost','child_age_max','young_age_max',
    'young_cost_multiplier','child_cost_multiplier','exempt_non_bamuflih_spouses',
    'exempt_their_children','custom_rules','notes','status',
    'dinner_cost','venue_cost','hospitality_cost','other_cost',
    'subscriber_exemptions','non_subscriber_surcharge'];

  const jsonFields = ['custom_rules', 'subscriber_exemptions'];
  const updates = {};
  for (const f of fields) {
    if (req.body[f] !== undefined) {
      updates[f] = jsonFields.includes(f) ? JSON.stringify(req.body[f]) : req.body[f];
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

// PUT /api/fund/events/:eventId/families/:familyId - Update family (counts, exempt_count)
router.put('/events/:eventId/families/:familyId', authenticateToken, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'غير مصرح' });

  const family = db.prepare('SELECT * FROM fund_event_families WHERE id = ? AND event_id = ?').get(req.params.familyId, req.params.eventId);
  if (!family) return res.status(404).json({ error: 'العائلة غير موجودة' });

  const { adult_count, young_count, child_count, exempt_count } = req.body;
  const newAdult = adult_count !== undefined ? parseInt(adult_count) : family.adult_count;
  const newYoung = young_count !== undefined ? parseInt(young_count) : family.young_count;
  const newChild = child_count !== undefined ? parseInt(child_count) : family.child_count;
  const newExempt = exempt_count !== undefined ? Math.max(0, Math.min(parseInt(exempt_count), newAdult + newYoung + newChild)) : (family.exempt_count || 0);

  // Recalculate cost for this family using event-level rates
  const event = db.prepare('SELECT * FROM fund_events WHERE id = ?').get(req.params.eventId);
  const allFamilies = db.prepare('SELECT * FROM fund_event_families WHERE event_id = ?').all(req.params.eventId);

  // Total people across ALL families (using updated counts for this family)
  let totalPeople = 0;
  for (const f of allFamilies) {
    if (f.id === family.id) {
      totalPeople += newAdult + newYoung + newChild;
    } else {
      totalPeople += f.adult_count + f.young_count + f.child_count;
    }
  }
  if (totalPeople === 0) totalPeople = 1;

  const costItems = { dinner: event.dinner_cost || 0, venue: event.venue_cost || 0, hospitality: event.hospitality_cost || 0, other: event.other_cost || 0 };
  const exemptions = event.subscriber_exemptions ? JSON.parse(event.subscriber_exemptions) : [];
  const totalCostAll = Object.values(costItems).reduce((s, v) => s + v, 0);
  const subscriberExemptTotal = exemptions.reduce((s, key) => s + (costItems[key] || 0), 0);

  // Per-person rates
  const perPersonAll = totalCostAll / totalPeople;
  const perPersonSubscriberExempt = subscriberExemptTotal / totalPeople;
  const surcharge = (event.non_subscriber_surcharge || 0);
  const youngMult = event.young_cost_multiplier || 0.5;
  const childMult = event.child_cost_multiplier || 0;

  const subscriberAdultRate = perPersonAll - perPersonSubscriberExempt;
  const nonSubscriberAdultRate = perPersonAll + surcharge;
  const adultRate = family.is_subscriber ? subscriberAdultRate : nonSubscriberAdultRate;

  const payingMembers = (newAdult + newYoung + newChild) - newExempt;
  const payingAdults = Math.max(0, newAdult - newExempt);
  const remainingExempt = Math.max(0, newExempt - newAdult);
  const payingYoung = Math.max(0, newYoung - remainingExempt);
  const remainingExempt2 = Math.max(0, remainingExempt - newYoung);
  const payingChildren = Math.max(0, newChild - remainingExempt2);

  const newCost = (payingAdults * adultRate) + (payingYoung * adultRate * youngMult) + (payingChildren * adultRate * childMult);

  db.prepare('UPDATE fund_event_families SET adult_count = ?, young_count = ?, child_count = ?, exempt_count = ?, total_cost = ? WHERE id = ?')
    .run(newAdult, newYoung, newChild, newExempt, Math.max(0, newCost), family.id);

  res.json({ message: 'تم التحديث' });
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

// POST /api/fund/events/:id/calculate-families - Calculate costs for selected family heads
router.post('/events/:id/calculate-families', authenticateToken, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'غير مصرح' });

  const event = db.prepare('SELECT * FROM fund_events WHERE id = ?').get(req.params.id);
  if (!event) return res.status(404).json({ error: 'الفعالية غير موجودة' });

  const { family_head_ids } = req.body;
  if (!family_head_ids || !Array.isArray(family_head_ids) || family_head_ids.length === 0) {
    return res.status(400).json({ error: 'يرجى اختيار أرباب أسر' });
  }

  const childAgeMax = event.child_age_max || 6;
  const youngAgeMax = event.young_age_max || 15;

  // Step 1: Build all families with deduplication
  const familyData = [];
  for (const headId of family_head_ids) {
    const head = db.prepare('SELECT * FROM members WHERE id = ?').get(headId);
    if (!head || head.death_date) continue;

    const user = db.prepare("SELECT is_fund_subscriber FROM users WHERE member_id = ? AND status = 'approved'").get(headId);
    const subReg = db.prepare('SELECT id FROM fund_subscriber_registrations WHERE member_id = ?').get(headId);
    const isSubscriber = !!(subReg || (user && user.is_fund_subscriber));

    // Use buildFamily with all selected IDs for deduplication
    const family = buildFamily(headId, family_head_ids, childAgeMax, youngAgeMax);
    if (!family) continue;

    familyData.push({
      headId, isSubscriber,
      adult_count: family.adult_count,
      young_count: family.young_count,
      child_count: family.child_count,
    });
  }

  // Step 2: Calculate total people across all families
  const totalPeople = familyData.reduce((s, f) => s + f.adult_count + f.young_count + f.child_count, 0);
  if (totalPeople === 0) return res.json({ message: 'لا يوجد حضور', count: 0 });

  // Step 3: Calculate per-person rates (total costs ÷ total people)
  const costItems = { dinner: event.dinner_cost || 0, venue: event.venue_cost || 0, hospitality: event.hospitality_cost || 0, other: event.other_cost || 0 };
  const exemptions = event.subscriber_exemptions ? JSON.parse(event.subscriber_exemptions) : [];
  const totalCostAll = Object.values(costItems).reduce((s, v) => s + v, 0);
  const subscriberExemptTotal = exemptions.reduce((s, key) => s + (costItems[key] || 0), 0);

  const perPersonAll = totalCostAll / totalPeople;
  const perPersonSubscriberExempt = subscriberExemptTotal / totalPeople;
  const surcharge = event.non_subscriber_surcharge || 0;
  const youngMultiplier = event.young_cost_multiplier || 0.5;
  const childMultiplier = event.child_cost_multiplier || 0;

  // Step 4: Clear and insert
  db.prepare('DELETE FROM fund_event_families WHERE event_id = ?').run(event.id);

  const insert = db.prepare(`
    INSERT INTO fund_event_families (event_id, head_member_id, is_subscriber, adult_count, young_count, child_count, exempt_count, total_cost)
    VALUES (?, ?, ?, ?, ?, ?, 0, ?)
  `);

  const insertAll = db.transaction(() => {
    for (const fam of familyData) {
      const subscriberAdultRate = perPersonAll - perPersonSubscriberExempt;
      const nonSubscriberAdultRate = perPersonAll + surcharge;
      const adultRate = fam.isSubscriber ? subscriberAdultRate : nonSubscriberAdultRate;
      const youngRate = adultRate * youngMultiplier;
      const childRate = adultRate * childMultiplier;
      const totalCost = (fam.adult_count * adultRate) + (fam.young_count * youngRate) + (fam.child_count * childRate);
      insert.run(event.id, fam.headId, fam.isSubscriber ? 1 : 0, fam.adult_count, fam.young_count, fam.child_count, totalCost);
    }
  });
  insertAll();

  const count = db.prepare('SELECT COUNT(*) as c FROM fund_event_families WHERE event_id = ?').get(event.id).c;
  res.json({ message: `تم حساب تكلفة ${count} عائلة`, count });
});

// GET /api/fund/events/:id/report - Get structured report data
router.get('/events/:id/report', (req, res) => {
  const event = db.prepare('SELECT * FROM fund_events WHERE id = ?').get(req.params.id);
  if (!event) return res.status(404).json({ error: 'الفعالية غير موجودة' });

  event.subscriber_exemptions = event.subscriber_exemptions ? JSON.parse(event.subscriber_exemptions) : [];

  const families = db.prepare(`
    SELECT fef.*, m.name as head_name
    FROM fund_event_families fef
    JOIN members m ON fef.head_member_id = m.id
    WHERE fef.event_id = ?
    ORDER BY m.name
  `).all(req.params.id);

  const costItems = {
    dinner: event.dinner_cost || 0,
    venue: event.venue_cost || 0,
    hospitality: event.hospitality_cost || 0,
    other: event.other_cost || 0,
  };
  const exemptions = event.subscriber_exemptions || [];
  const totalCostAll = Object.values(costItems).reduce((s, v) => s + v, 0);
  const subscriberExemptTotal = exemptions.reduce((s, key) => s + (costItems[key] || 0), 0);
  const youngMultiplier = event.young_cost_multiplier || 0.5;
  const childMultiplier = event.child_cost_multiplier || 0;

  const totalFamilies = families.length;
  const subscriberFamilies = families.filter(f => f.is_subscriber).length;
  const nonSubscriberFamilies = totalFamilies - subscriberFamilies;
  const grandTotal = families.reduce((s, f) => s + (f.total_cost || 0), 0);
  const totalAdults = families.reduce((s, f) => s + f.adult_count, 0);
  const totalYoung = families.reduce((s, f) => s + f.young_count, 0);
  const totalChildren = families.reduce((s, f) => s + f.child_count, 0);
  const totalPeople = totalAdults + totalYoung + totalChildren || 1;

  const perPersonAll = totalCostAll / totalPeople;
  const perPersonSubscriberExempt = subscriberExemptTotal / totalPeople;
  const surcharge = event.non_subscriber_surcharge || 0;
  const subscriberAdultRate = perPersonAll - perPersonSubscriberExempt;
  const nonSubscriberAdultRate = perPersonAll + surcharge;

  res.json({
    event: {
      name: event.name,
      date: event.date,
      description: event.description,
    },
    cost_breakdown: costItems,
    subscriber_exemptions: exemptions,
    non_subscriber_surcharge: surcharge,
    rates: {
      subscriber_adult: subscriberAdultRate,
      non_subscriber_adult: nonSubscriberAdultRate,
      subscriber_young: subscriberAdultRate * youngMultiplier,
      non_subscriber_young: nonSubscriberAdultRate * youngMultiplier,
      subscriber_child: subscriberAdultRate * childMultiplier,
      non_subscriber_child: nonSubscriberAdultRate * childMultiplier,
    },
    summary: {
      total_families: totalFamilies,
      subscriber_families: subscriberFamilies,
      non_subscriber_families: nonSubscriberFamilies,
      total_adults: totalAdults,
      total_young: totalYoung,
      total_children: totalChildren,
      total_people: totalPeople,
      grand_total: grandTotal,
    },
    families: families.map(f => ({
      head_name: f.head_name,
      is_subscriber: !!f.is_subscriber,
      exempt_count: f.exempt_count || 0,
      adult_count: f.adult_count,
      young_count: f.young_count,
      child_count: f.child_count,
      total_members: f.adult_count + f.young_count + f.child_count,
      total_cost: f.total_cost,
    })),
  });
});

module.exports = router;
