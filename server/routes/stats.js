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
    branches: branchStats
  });
});

module.exports = router;
