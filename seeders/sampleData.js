require('dotenv').config();
const sequelize = require('../config/database');
const db = require('../models');
const bcrypt = require('bcrypt');

(async () => {
  try {
    await sequelize.authenticate();
    console.log('DB connected for seeding.');

    // ensure associations loaded
    // create an admin
    const email = 'admin@example.com';
    const password = 'password123';
    const password_hash = await bcrypt.hash(password, 10);

    let admin = await db.Admin.findOne({ where: { email } });
    if (!admin) {
      admin = await db.Admin.create({ email, full_name: 'Admin User', password_hash });
      console.log('Admin created:', email, 'password:', password);
    } else {
      console.log('Admin exists:', email);
    }

    // Clean limited sample data (careful in production)
    // create sample sections, questions and options if not exists
    const sectionsData = [
      { title: 'Communication', description: 'Communication skills', sort_order: 1 },
      { title: 'Leadership', description: 'Leadership capabilities', sort_order: 2 }
    ];

    for (const sData of sectionsData) {
      let section = await db.Section.findOne({ where: { title: sData.title } });
      if (!section) {
        section = await db.Section.create({ ...sData, created_by: admin.id });
        console.log('Created section:', section.title);
      }

      // create two questions per section
      for (let qi = 1; qi <= 2; qi++) {
        const qText = `${sData.title} Question ${qi}`;
        let q = await db.Question.findOne({ where: { section_id: section.id, text: qText } });
        if (!q) {
          q = await db.Question.create({ section_id: section.id, text: qText, created_by: admin.id });
          console.log('  Created question:', qText);
        }

        // options (example: Strong / Average / Weak)
        const options = [
          { label: 'Strong', score: 3, gap: 'low', strength: 'high', recommendation: 'keep it up' },
          { label: 'Average', score: 2, gap: 'medium', strength: 'moderate', recommendation: 'improve' },
          { label: 'Weak', score: 1, gap: 'high', strength: 'low', recommendation: 'training recommended' }
        ];

        for (const opt of options) {
          const existingOpt = await db.Option.findOne({ where: { question_id: q.id, label: opt.label } });
          if (!existingOpt) {
            await db.Option.create({ question_id: q.id, label: opt.label, score: opt.score, gap: opt.gap, strength: opt.strength, recommendation: opt.recommendation });
            console.log('    Created option:', opt.label);
          }
        }
      }
    }

    console.log('Seeding completed.');
    process.exit(0);
  } catch (err) {
    console.error('Seeding error:', err);
    process.exit(1);
  }
})();
