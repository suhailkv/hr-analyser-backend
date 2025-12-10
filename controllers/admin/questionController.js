const db = require('../../models');
const Question = db.Question;
const Section = db.Section;
const Option = db.Option;

const create = async (req, res) => {
  try {
    const createdQuestion = await db.sequelize.transaction(async (t) => {
      const { section_id, text, help_text, sort_order = 0, is_active = true, options = [] } = req.body;
      const created_by = req.adminId || null;

      // ✅ Validate section exists
      const section = await Section.findByPk(section_id, { transaction: t });
      if (!section) {
        throw new Error('invalid section_id'); // Throwing an error will cause the transaction to rollback
      }

      // ✅ Create question
      const question = await Question.create(
        { section_id, text, help_text, sort_order, is_active, created_by },
        { transaction: t }
      );

      // ✅ If options array provided, create all options for this question
      if (Array.isArray(options) && options.length > 0) {
        const optionPayloads = options.map(opt => ({
          question_id: question.id,
          label: opt.label || null,
          detail: opt.detail || null,
          score: opt.score || 0,
          gap: opt.gap || null,
          strength: opt.strength || null,
          recommendation: opt.recommendation || null,
          sort_order: opt.sort_order || 0,
          is_active: opt.is_active !== undefined ? opt.is_active : true,
        }));

        await db.Option.bulkCreate(optionPayloads, { transaction: t });
      }

      // ✅ Return created question with its new options
      return await Question.findByPk(question.id, {
        include: [db.Option],
        transaction: t,
      });
    });

    return res.status(201).json(createdQuestion);

  } catch (err) {
    console.error(err);
    if (err.message === 'invalid section_id') {
      return res.status(400).json({ message: err.message });
    }
    return res.status(500).json({ message: 'server error' });
  }
};


const list = async (req, res) => {
  try {
    const where = {};
    if (req.query.section_id) where.section_id = req.query.section_id;
    where.is_active = true;
    const questions = await Question.findAll({ where, order: [['sort_order', 'ASC'], ['id', 'ASC']], include: [Option] });
    return res.json(questions);
  } catch (err) {
    console.error('Error fetching questions:', err);
    return res.status(500).json({ message: 'server error' });
  }
};

const listWithSections = async (req, res) => {
  try {
    const where = {};
    if (req.query.section_id) where.section_id = req.query.section_id;
    where.is_active = true;
    const questions = await Question.findAll({
      where,
      include: [
        {
          model: db.Option,
          required: true,
          where: {
            is_active: 1
          },
          order: [['sort_order', 'ASC']]
        },
        {
          model: db.Section,
          attributes: ['id', 'title'],
          required: true,
          where: {
            deleted_at: null,
            is_active: true
          }
        }
      ],
      order: [
        ['sort_order', 'ASC'],
        ['id', 'ASC'],
        [db.Option, 'sort_order', 'ASC'] // ensure options are sorted properly
      ]
    });

    return res.json(questions);
  } catch (err) {
    console.error('Error fetching questions:', err);
    return res.status(500).json({ message: 'server error' });
  }
};
const getOne = async (req, res) => {
  try {
    const question = await Question.findByPk(req.params.id, {
      include: [
        {
          model: db.Option,
          required: false,
          order: [['sort_order', 'ASC']]
        },
        {
          model: db.Section,
          attributes: ['id', 'title'],
          required: false
        }
      ],
      order: [[db.Option, 'sort_order', 'ASC']]
    });

    if (!question) return res.status(404).json({ message: 'not found' });
    return res.json(question);
  } catch (err) {
    console.error('Error fetching question:', err);
    return res.status(500).json({ message: 'server error' });
  }
};


const update = async (req, res) => {
  const t = await db.sequelize.transaction();
  try {
    const q = await Question.findByPk(req.params.id, { transaction: t });
    if (!q) {
      await t.rollback();
      return res.status(404).json({ message: 'not found' });
    }

    const { text, help_text, sort_order, is_active, section_id, options } = req.body;

    // ✅ Update question details
    await q.update(
      { text, help_text, sort_order, is_active, section_id },
      { transaction: t }
    );

    // ✅ Handle options if provided
    if (Array.isArray(options)) {
      for (const opt of options) {
        if (opt.id) {
          // Existing option -> update
          const existing = await db.Option.findOne({
            where: { id: opt.id, question_id: q.id },
            transaction: t
          });
          if (existing) {
            await existing.update(
              {
                label: opt.label,
                detail: opt.detail,
                score: opt.score,
                gap: opt.gap,
                strength: opt.strength,
                recommendation: opt.recommendation,
                sort_order: opt.sort_order,
                is_active:
                  opt.is_active !== undefined ? opt.is_active : existing.is_active
              },
              { transaction: t }
            );
          }
        } else {
          // New option -> create
          await db.Option.create(
            {
              question_id: q.id,
              label: opt.label,
              detail: opt.detail,
              score: opt.score,
              gap: opt.gap,
              strength: opt.strength,
              recommendation: opt.recommendation,
              sort_order: opt.sort_order || 0,
              is_active: opt.is_active !== undefined ? opt.is_active : true
            },
            { transaction: t }
          );
        }
      }

      // ✅ Optional cleanup: delete removed options if not in payload
      const providedIds = options.filter(o => o.id).map(o => o.id);
      if (providedIds.length > 0) {
        await db.Option.destroy({
          where: {
            question_id: q.id,
            id: { [db.Sequelize.Op.notIn]: providedIds }
          },
          transaction: t
        });
      }
    }

    await t.commit();

    // ✅ Return updated question with latest options
    const updatedQuestion = await Question.findByPk(q.id, {
      include: [
        {
          model: db.Option,
          required: false,
          order: [['sort_order', 'ASC']]
        },
        {
          model: db.Section,
          attributes: ['id', 'title'],
          required: false
        }
      ],
      order: [[db.Option, 'sort_order', 'ASC']]
    });

    return res.json(updatedQuestion);
  } catch (err) {
    console.error('Error updating question:', err);
    await t.rollback();
    return res.status(500).json({ message: 'server error' });
  }
};


const remove = async (req, res) => {
  try {
    await db.sequelize.transaction(async (t) => {
      const q = await Question.findByPk(req.params.id, { transaction: t });
      if (!q) {
        // Throwing an error within the transaction callback will cause a rollback
        throw new Error('Question not found');
      }

      // ✅ Soft delete options
      // await db.Option.update(
      //   { deleted_at: new Date() },
      //   { where: { question_id: q.id }, transaction: t }
      // );

      // ✅ Soft delete question
      await q.update({ is_active: false }, { transaction: t });
    });

    return res.json({ message: 'deleted successfully' });
  } catch (err) {
    if (err.message === 'Question not found') {
      return res.status(404).json({ message: 'not found' });
    }
    console.error('Error deleting question:', err);
    return res.status(500).json({ message: 'server error' });
  }
}
// Bulk create questions with nested structure
const bulkCreateQuestions = async (req, res) => {
  const t = await db.sequelize.transaction();
  try {
    const sections = req.body;

    // Basic validation
    if (!Array.isArray(sections) || sections.length === 0) {
      await t.rollback();
      return res.status(400).json({ message: 'Invalid payload: Expected non-empty array of sections' });
    }

    const result = [];

    for (const sectionData of sections) {
      const { section: sectionTitle, questions } = sectionData;

      if (!sectionTitle) {
        // Skip sections without titles or handle error
        continue;
      }

      // 1. Create Section
      const section = await Section.create({
        title: sectionTitle,
        sort_order: 0
      }, { transaction: t });

      const sectionResult = {
        id: section.id,
        section: section.title,
        questions: []
      };

      if (Array.isArray(questions) && questions.length > 0) {
        for (const qData of questions) {
          const { question: qText, options } = qData;

          if (!qText) continue;

          // 2. Create Question
          const question = await Question.create({
            section_id: section.id,
            text: qText,
            is_active: true,
            sort_order: 0
          }, { transaction: t });

          // 3. Create Options
          let createdOptions = [];
          if (Array.isArray(options) && options.length > 0) {
            const optionPayloads = options.map(opt => ({
              question_id: question.id,
              label: opt.name,
              score: opt.score || 0,
              gap: opt.gap || null,
              strength: opt.strength || null,
              recommendation: opt.recommendation || null,
              is_active: true,
              sort_order: 0
            }));

            createdOptions = await Option.bulkCreate(optionPayloads, { transaction: t });
          }

          sectionResult.questions.push({
            id: question.id,
            question: question.text,
            options: createdOptions
          });
        }
      }
      result.push(sectionResult);
    }

    await t.commit();
    return res.status(201).json({
      message: 'Bulk import successful',
      data: result
    });

  } catch (error) {
    console.error('Bulk create error:', error);
    try { await t.rollback(); } catch (e) { }
    return res.status(500).json({ message: 'Server error', error: error.message });
  }
};

module.exports = { create, list, getOne, update, remove, listWithSections, bulkCreateQuestions };
