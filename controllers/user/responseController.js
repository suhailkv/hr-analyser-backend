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
    const { ip_address  , user_agent , 

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
    const { answers, company = 'Acme Corp', contact = 'john@acme.com' } = req.body;

    if (!Array.isArray(answers) || answers.length === 0) {
      await t.rollback();
      return res.status(400).json({ message: 'answers required' });
    }

    let resp = await Response.findOne({ where: { session_uuid }, transaction: t });
    if (!resp) {
      await t.rollback();
      return res.status(404).json({ message: 'session not found' });
    }

    // ✅ Process answers
    for (const a of answers) {
      const { question_id, option_id } = a;
      if (!question_id || !option_id) {
        await t.rollback();
        return res.status(400).json({ message: 'question_id and option_id required' });
      }

      const option = await Option.findByPk(option_id, { transaction: t });
      if (!option || String(option.question_id) !== String(question_id)) {
        await t.rollback();
        return res.status(400).json({ message: `invalid option ${option_id} for question ${question_id}` });
      }

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

      const existing = await Answer.findOne({
        where: { response_id: resp.id, question_id },
        transaction: t
      });
      if (existing) {
        await existing.update(answerPayload, { transaction: t });
      } else {
        await Answer.create(answerPayload, { transaction: t });
      }
    }

    // ✅ Compute section totals
    const sectionTotals = await Answer.findAll({
      attributes: [
        [Sequelize.col('question.section_id'), 'section_id'],
        [Sequelize.fn('COUNT', Sequelize.col('Answer.id')), 'questions_answered'],
        [Sequelize.fn('SUM', Sequelize.col('option_score_snapshot')), 'section_score']
      ],
      where: { response_id: resp.id },
      include: [{ model: Question, attributes: [], required: true }],
      group: ['question.section_id'],
      transaction: t,
      raw: true
    });

    // ✅ Cache per section
    for (const s of sectionTotals) {
      const section_id = s.section_id;
      const total_score = parseInt(s.section_score || 0, 10);
      const questions_answered = parseInt(s.questions_answered || 0, 10);

      const existingCache = await SectionScoreCache.findOne({
        where: { response_id: resp.id, section_id },
        transaction: t
      });
      if (existingCache) {
        await existingCache.update(
          { total_score, questions_answered, last_calculated_at: new Date() },
          { transaction: t }
        );
      } else {
        await SectionScoreCache.create(
          { response_id: resp.id, section_id, total_score, questions_answered },
          { transaction: t }
        );
      }
    }

    await resp.update({ completed_at: new Date() }, { transaction: t });
    await t.commit();

    // ✅ Build report output
    const sections = await Section.findAll({
      order: [['sort_order', 'ASC'], ['id', 'ASC']]
    });
    const cacheRows = await SectionScoreCache.findAll({
      where: { response_id: resp.id },
      raw: true
    });

    // Section summaries
    const sectionSummary = sections.map((s) => {
      const cached = cacheRows.find((r) => String(r.section_id) === String(s.id));
      const score = cached ? cached.total_score : 0;
      const maxScore = cached ? cached.questions_answered * 5 : 0; // assume max option score 5
      return {
        section_id: s.id,
        section_title: s.title,
        score,
        maxScore
      };
    });

    // Totals
    const totalScore = sectionSummary.reduce((sum, s) => sum + s.score, 0);
    const maxScore = sectionSummary.reduce((sum, s) => sum + s.maxScore, 0);
    const percent = maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 0;

    // Summary classification
    let summaryStatus = 'Excellent Performance';
    let summaryType = 'success';
    if (percent < 40) {
      summaryStatus = 'Immediate Attention Required';
      summaryType = 'danger';
    } else if (percent < 70) {
      summaryStatus = 'Needs Improvement';
      summaryType = 'warning';
    }

    // Insights (top/bottom 1 sections)
    const sorted = [...sectionSummary].sort((a, b) => b.score - a.score);
    const top = sorted[0];
    const bottom = sorted[sorted.length - 1];
    const keyInsights = [
      {
        name: `Strong Area: ${top.section_title}`,
        status: 'success'
      },
      {
        name: `Weak Area: ${bottom.section_title}`,
        status: 'danger'
      }
    ];

    // Build section details (simplified)
    const summaryDetails = sectionSummary.map((s) => ({
      name: s.section_title,
      score: s.score,
      maxScore: s.maxScore,
      completionRate:
        s.maxScore > 0 ? `${Math.round((s.score / s.maxScore) * 100)}%` : '0%',
      strengths: ['Strong team participation', 'Good process adherence'],
      gaps: ['Inconsistent follow-up', 'Lack of automation'],
      recommendations: [
        'Improve process automation',
        'Enhance documentation and periodic reviews'
      ]
    }));

    // ✅ Final response payload
    const report = {
      id: `RPT-${String(resp.id).padStart(3, '0')}`,
      company,
      submitted: new Date().toISOString().split('T')[0],
      contact,
      score: percent,
      status: 'Completed',
      details: {
        overAllScore: totalScore,
        maxmScore: maxScore,
        summaryStatus,
        summaryType,
        sectionRatings: sectionSummary.map((s) => ({
          sectionName: s.section_title,
          score: s.score,
          mxmScore: s.maxScore
        })),
        keyInsights,
        summary: summaryDetails
      }
    };

    return res.json(report);
  } catch (err) {
    console.error('Submit Answers Error:', err);
    await t.rollback();
    return res.status(500).json({ message: 'server error' });
  }
};


module.exports = { startSession, submitAnswers };
