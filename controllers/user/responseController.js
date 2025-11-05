const db = require('../../models');
const { v4: uuidv4 } = require('uuid');
const Sequelize = require('sequelize');

const Response = db.Response;
const Answer = db.Answer;
const Option = db.Option;
const Question = db.Question;
const Section = db.Section;
const SectionScoreCache = db.SectionScoreCache;
const sequelize = db.sequelize;

/**
 * Start a new anonymous response session
 * returns { session_uuid }
 */
const startSession = async (req, res) => {
  try {
    const { ip_address , user_agent , 

      fullName,
      email, phone,company
    } = req.body || {};
    const session_uuid = uuidv4();
    const resp = await Response.create({ session_uuid, ip_address, user_agent });
    return res.status(201).json({ session_uuid });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'server error' });
  }
};

/**
 * Submit answers for a session (payload: answers: [{ question_id, option_id }, ... ])
 * This will:
 *  - create Answer rows with option snapshot fields
 *  - compute section totals and total score
 *  - store/overwrite cache entries in section scores cache
 *  - mark response.completed_at
 */
const submitAnswers = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { session_uuid } = req.params;
    const { answers } = req.body; // array of { question_id, option_id }
    if (!Array.isArray(answers) || answers.length === 0) {
      await t.rollback();
      return res.status(400).json({ message: 'answers required' });
    }

    const resp = await Response.findOne({ where: { session_uuid }, transaction: t });
    if (!resp) {
      await t.rollback();
      return res.status(404).json({ message: 'session not found' });
    }

    // For each answer, validate question and option, then insert Answer snapshot
    // We will upsert Answers per (response_id, question_id) to respect UNIQUE constraint
    for (const a of answers) {
      const { question_id, option_id } = a;
      if (!question_id || !option_id) {
        await t.rollback();
        return res.status(400).json({ message: 'question_id and option_id required for each answer' });
      }

      // fetch option (and confirm belongs to question)
      const option = await Option.findByPk(option_id, { transaction: t });
      if (!option || String(option.question_id) !== String(question_id)) {
        await t.rollback();
        return res.status(400).json({ message: `invalid option ${option_id} for question ${question_id}` });
      }

      // upsert answer
      const answerPayload = {
        response_id: resp.id,
        question_id,
        option_id,
        option_score_snapshot: option.score,
        option_gap_snapshot: option.gap,
        option_strength_snapshot: option.strength,
        option_recommendation_snapshot: option.recommendation,
        answered_at: new Date()
      };

      // Try update existing, otherwise create
      const existing = await Answer.findOne({ where: { response_id: resp.id, question_id }, transaction: t });
      if (existing) {
        await existing.update(answerPayload, { transaction: t });
      } else {
        await Answer.create(answerPayload, { transaction: t });
      }
    }

    // After all answers saved, compute section-wise totals
    // Query answers joined to questions -> group by section_id
    const sectionTotals = await Answer.findAll({
      attributes: [
        [Sequelize.col('question.section_id'), 'section_id'],
        [Sequelize.fn('COUNT', Sequelize.col('Answer.id')), 'questions_answered'],
        [Sequelize.fn('SUM', Sequelize.col('option_score_snapshot')), 'section_score']
      ],
      where: { response_id: resp.id },
      include: [
        {
          model: Question,
          attributes: [],
          required: true
        }
      ],
      group: ['question.section_id'],
      transaction: t,
      raw: true
    });

    // Upsert into cache table per section
    for (const s of sectionTotals) {
      const section_id = s.section_id;
      const total_score = parseInt(s.section_score || 0, 10);
      const questions_answered = parseInt(s.questions_answered || 0, 10);

      // upsert: try find existing
      const existingCache = await SectionScoreCache.findOne({ where: { response_id: resp.id, section_id }, transaction: t });
      if (existingCache) {
        await existingCache.update({ total_score, questions_answered, last_calculated_at: new Date() }, { transaction: t });
      } else {
        await SectionScoreCache.create({ response_id: resp.id, section_id, total_score, questions_answered, last_calculated_at: new Date() }, { transaction: t });
      }
    }

    // Mark response completed_at
    await resp.update({ completed_at: new Date() }, { transaction: t });

    await t.commit();

    // Build final totals response
    const sections = await Section.findAll({ order: [['sort_order', 'ASC'], ['id', 'ASC']] });
    // join with cache to produce a summary
    const cacheRows = await SectionScoreCache.findAll({ where: { response_id: resp.id }, transaction: null, raw: true });
    const sectionSummary = sections.map(s => {
      const cached = cacheRows.find(r => String(r.section_id) === String(s.id));
      return {
        section_id: s.id,
        section_title: s.title,
        questions_answered: cached ? cached.questions_answered : 0,
        section_score: cached ? cached.total_score : 0
      };
    });

    const final_total = sectionSummary.reduce((sum, x) => sum + (x.section_score || 0), 0);
    const total_questions = sectionSummary.reduce((sum, x) => sum + (x.questions_answered || 0), 0);

    return res.json({
      session_uuid: resp.session_uuid,
      response_id: resp.id,
      section_summary: sectionSummary,
      total_score: final_total,
      total_questions
    });

  } catch (err) {
    console.error(err);
    await t.rollback();
    return res.status(500).json({ message: 'server error' });
  }
};

module.exports = { startSession, submitAnswers };
