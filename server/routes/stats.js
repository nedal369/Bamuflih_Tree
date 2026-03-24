const express = require('express');
const db = require('../db/database');

const router = express.Router();

router.get('/', (req, res) => {
  const totalMembers = db.prepare('SELECT COUNT(*) as count FROM members').get().count;
  const maleCount = db.prepare("SELECT COUNT(*) as count FROM members WHERE gender = 'male'").get().count;
  const femaleCount = db.prepare("SELECT COUNT(*) as count FROM members WHERE gender = 'female'").get().count;
  const livingCount = db.prepare("SELECT COUNT(*) as count FROM members WHERE death_date IS NULL OR death_date = ''").get().count;
  const deceasedCount = db.prepare("SELECT COUNT(*) as count FROM members WHERE death_date IS NOT NULL AND death_date != ''").get().count;
  const maxGeneration = db.prepare('SELECT MAX(generation) as max FROM members').get().max || 0;

  const generationDistribution = db.prepare(
    'SELECT generation, COUNT(*) as count FROM members GROUP BY generation ORDER BY generation'
  ).all();

  // City distribution
  const cityDistribution = db.prepare(
    "SELECT city, COUNT(*) as count FROM members WHERE city IS NOT NULL AND city != '' GROUP BY city ORDER BY count DESC"
  ).all();

  // Marriage status distribution
  const marriageStats = db.prepare(
    'SELECT status, COUNT(*) as count FROM marriages GROUP BY status ORDER BY count DESC'
  ).all();

  // Largest branches
  const branches = db.prepare(`
    SELECT m.id, m.name, COUNT(c.id) as descendants_count
    FROM members m
    LEFT JOIN members c ON c.father_id = m.id
    WHERE m.father_id = (SELECT id FROM members WHERE father_id IS NULL LIMIT 1)
    GROUP BY m.id
    ORDER BY descendants_count DESC
  `).all();

  const allMembers = db.prepare('SELECT id, father_id, name FROM members').all();
  function countDescendants(parentId) {
    const children = allMembers.filter(m => m.father_id === parentId);
    let count = children.length;
    for (const child of children) {
      count += countDescendants(child.id);
    }
    return count;
  }

  const branchStats = branches.map(b => ({
    ...b,
    total_descendants: countDescendants(b.id)
  }));

  // --- NEW STATS ---

  // 1. Work type distribution
  const workTypeDistribution = db.prepare(
    "SELECT work_type, COUNT(*) as count FROM members WHERE work_type IS NOT NULL AND work_type != '' GROUP BY work_type ORDER BY count DESC"
  ).all();

  // 2. Top 15 workplaces by count
  const workPlaceDistribution = db.prepare(
    "SELECT work_place, COUNT(*) as count FROM members WHERE work_place IS NOT NULL AND work_place != '' GROUP BY work_place ORDER BY count DESC LIMIT 15"
  ).all();

  // 3. Nationality distribution
  const nationalityDistribution = db.prepare(
    "SELECT nationality, COUNT(*) as count FROM members WHERE nationality IS NOT NULL AND nationality != '' GROUP BY nationality ORDER BY count DESC"
  ).all();

  // 4. Average children per male member
  const avgChildrenResult = db.prepare(`
    SELECT AVG(child_count) as avg_children FROM (
      SELECT m.id, COUNT(c.id) as child_count
      FROM members m
      LEFT JOIN members c ON c.father_id = m.id
      WHERE m.gender = 'male'
      GROUP BY m.id
    )
  `).get();
  const averageChildrenPerMember = avgChildrenResult.avg_children
    ? Math.round(avgChildrenResult.avg_children * 100) / 100
    : 0;

  // 5. Age distribution for living members with birth_date
  const ageDistribution = db.prepare(`
    SELECT
      CASE
        WHEN age BETWEEN 0 AND 20 THEN '0-20'
        WHEN age BETWEEN 21 AND 40 THEN '21-40'
        WHEN age BETWEEN 41 AND 60 THEN '41-60'
        WHEN age BETWEEN 61 AND 80 THEN '61-80'
        ELSE '80+'
      END as range,
      COUNT(*) as count
    FROM (
      SELECT CAST((julianday('now') - julianday(birth_date)) / 365.25 AS INTEGER) as age
      FROM members
      WHERE (death_date IS NULL OR death_date = '')
        AND birth_date IS NOT NULL AND birth_date != ''
    )
    GROUP BY range
    ORDER BY
      CASE range
        WHEN '0-20' THEN 1
        WHEN '21-40' THEN 2
        WHEN '41-60' THEN 3
        WHEN '61-80' THEN 4
        ELSE 5
      END
  `).all();

  // 6. Youngest living member
  const youngestMember = db.prepare(`
    SELECT name, birth_date
    FROM members
    WHERE (death_date IS NULL OR death_date = '')
      AND birth_date IS NOT NULL AND birth_date != ''
    ORDER BY birth_date DESC
    LIMIT 1
  `).get() || null;

  // 7. Oldest living member
  const oldestMember = db.prepare(`
    SELECT name, birth_date
    FROM members
    WHERE (death_date IS NULL OR death_date = '')
      AND birth_date IS NOT NULL AND birth_date != ''
    ORDER BY birth_date ASC
    LIMIT 1
  `).get() || null;

  // 8. Member with most direct children
  const mostChildren = db.prepare(`
    SELECT m.name, COUNT(c.id) as count
    FROM members m
    JOIN members c ON c.father_id = m.id
    GROUP BY m.id
    ORDER BY count DESC
    LIMIT 1
  `).get() || null;

  // 9. Member with most total descendants (among generation 2 members only)
  const gen2Members = db.prepare("SELECT id, name FROM members WHERE generation = 2").all();
  let mostDescendants = null;
  let maxDescCount = 0;
  for (const member of gen2Members) {
    const descCount = countDescendants(member.id);
    if (descCount > maxDescCount) {
      maxDescCount = descCount;
      mostDescendants = { name: member.name, count: descCount };
    }
  }

  // 10. Timeline data - members grouped by birth decade
  const timelineData = db.prepare(`
    SELECT
      (CAST(substr(birth_date, 1, 4) AS INTEGER) / 10) * 10 as decade,
      COUNT(*) as count
    FROM members
    WHERE birth_date IS NOT NULL AND birth_date != ''
      AND length(birth_date) >= 4
    GROUP BY decade
    ORDER BY decade
  `).all();

  // 11. Top 15 occupations by count
  const occupationDistribution = db.prepare(
    "SELECT occupation, COUNT(*) as count FROM members WHERE occupation IS NOT NULL AND occupation != '' GROUP BY occupation ORDER BY count DESC LIMIT 15"
  ).all();

  res.json({
    totalMembers,
    maleCount,
    femaleCount,
    livingCount,
    deceasedCount,
    maxGeneration,
    generationDistribution,
    cityDistribution,
    marriageStats,
    branches: branchStats,
    workTypeDistribution,
    workPlaceDistribution,
    nationalityDistribution,
    averageChildrenPerMember,
    ageDistribution,
    youngestMember,
    oldestMember,
    mostChildren,
    mostDescendants,
    timelineData,
    occupationDistribution
  });
});

module.exports = router;
