const express = require('express');
const db = require('../db/database');

const router = express.Router();

router.get('/', (req, res) => {
  const totalMembers = db.prepare('SELECT COUNT(*) as count FROM members').get().count;
  const maleCount = db.prepare("SELECT COUNT(*) as count FROM members WHERE gender = 'male'").get().count;
  const femaleCount = db.prepare("SELECT COUNT(*) as count FROM members WHERE gender = 'female'").get().count;
  const livingCount = db.prepare('SELECT COUNT(*) as count FROM members WHERE death_date IS NULL').get().count;
  const deceasedCount = db.prepare('SELECT COUNT(*) as count FROM members WHERE death_date IS NOT NULL').get().count;
  const maxGeneration = db.prepare('SELECT MAX(generation) as max FROM members').get().max || 0;

  const generationDistribution = db.prepare(
    'SELECT generation, COUNT(*) as count FROM members GROUP BY generation ORDER BY generation'
  ).all();

  // Largest branches (by root member's children count)
  const branches = db.prepare(`
    SELECT m.id, m.name, COUNT(c.id) as descendants_count
    FROM members m
    LEFT JOIN members c ON c.father_id = m.id
    WHERE m.father_id = (SELECT id FROM members WHERE father_id IS NULL LIMIT 1)
    GROUP BY m.id
    ORDER BY descendants_count DESC
  `).all();

  // Get total descendants for each branch
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
    branches: branchStats
  });
});

module.exports = router;
