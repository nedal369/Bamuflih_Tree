const express = require('express');
const db = require('../db/database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Get notifications: birthdays, new members
router.get('/', authenticateToken, (req, res) => {
  const today = new Date();
  const currentMonth = today.getMonth() + 1;
  const currentDay = today.getDate();
  const notifications = [];

  // Get all members with birth dates
  const members = db.prepare('SELECT * FROM members WHERE birth_date IS NOT NULL').all();

  for (const m of members) {
    // Try to parse birth_date - support formats like YYYY-MM-DD, YYYY/MM/DD, DD/MM/YYYY
    const parsed = parseDateString(m.birth_date);
    if (!parsed) continue;

    const { month, day, year } = parsed;

    // Birthday check: same month and day
    if (month === currentMonth && day === currentDay) {
      const age = year ? today.getFullYear() - year : null;
      notifications.push({
        type: 'birthday_today',
        member_id: m.id,
        name: m.name,
        photo: m.photo,
        gender: m.gender,
        message: age ? `عيد ميلاد ${m.name} اليوم! (${age} سنة)` : `عيد ميلاد ${m.name} اليوم!`,
        date: m.birth_date,
        priority: 1,
      });
    }
    // Upcoming birthdays (next 30 days)
    else if (month && day) {
      const bday = new Date(today.getFullYear(), month - 1, day);
      if (bday < today) bday.setFullYear(bday.getFullYear() + 1);
      const diff = Math.ceil((bday.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      if (diff > 0 && diff <= 30) {
        const age = year ? bday.getFullYear() - year : null;
        notifications.push({
          type: 'birthday_upcoming',
          member_id: m.id,
          name: m.name,
          photo: m.photo,
          gender: m.gender,
          message: age
            ? `عيد ميلاد ${m.name} بعد ${diff} ${diff === 1 ? 'يوم' : diff === 2 ? 'يومين' : diff <= 10 ? 'أيام' : 'يوم'} (${age} سنة)`
            : `عيد ميلاد ${m.name} بعد ${diff} ${diff === 1 ? 'يوم' : diff === 2 ? 'يومين' : diff <= 10 ? 'أيام' : 'يوم'}`,
          date: m.birth_date,
          days_until: diff,
          priority: 2,
        });
      }
    }
  }

  // New members added in the last 30 days
  const thirtyDaysAgo = new Date(today);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const recentMembers = db.prepare(
    "SELECT * FROM members WHERE created_at >= ? ORDER BY created_at DESC"
  ).all(thirtyDaysAgo.toISOString());

  for (const m of recentMembers) {
    const createdDate = new Date(m.created_at);
    const diff = Math.ceil((today.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24));
    notifications.push({
      type: 'new_member',
      member_id: m.id,
      name: m.name,
      photo: m.photo,
      gender: m.gender,
      message: diff === 0
        ? `تمت إضافة ${m.name} اليوم`
        : `تمت إضافة ${m.name} منذ ${diff} ${diff === 1 ? 'يوم' : diff === 2 ? 'يومين' : diff <= 10 ? 'أيام' : 'يوم'}`,
      date: m.created_at,
      priority: 3,
    });
  }

  // Sort: today's birthdays first, then upcoming, then new members
  notifications.sort((a, b) => {
    if (a.priority !== b.priority) return a.priority - b.priority;
    if (a.days_until !== undefined && b.days_until !== undefined) return a.days_until - b.days_until;
    return 0;
  });

  res.json(notifications);
});

// Parse flexible date string
function parseDateString(str) {
  if (!str) return null;
  str = str.trim();

  // Try YYYY-MM-DD or YYYY/MM/DD
  let match = str.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (match) return { year: parseInt(match[1]), month: parseInt(match[2]), day: parseInt(match[3]) };

  // Try DD/MM/YYYY or DD-MM-YYYY
  match = str.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
  if (match) return { year: parseInt(match[3]), month: parseInt(match[2]), day: parseInt(match[1]) };

  // Try just year (1990)
  match = str.match(/^(\d{4})$/);
  if (match) return { year: parseInt(match[1]), month: null, day: null };

  return null;
}

module.exports = router;
