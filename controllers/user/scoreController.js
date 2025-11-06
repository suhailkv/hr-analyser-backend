// const db = require('../../models');

// const Response = db.Response;
// const Section = db.Section;
// const SectionScoreCache = db.SectionScoreCache;
// const Answer = db.Answer;
// const Question = db.Question;

// controllers/reportController.js

const { Response, Section, SectionScoreCache, Answer, Question, Option, sequelize } = require('../../models');
const { Sequelize } = require('sequelize');

const getSummary = async (req, res) => {
  try {
    const { session_uuid } = req.params;

    // 1️⃣ Fetch response
    const resp = await Response.findOne({ where: { session_uuid } });
    if (!resp) return res.status(404).json({ message: 'Session not found' });

    // 2️⃣ Try loading cached section scores
    const cacheRows = await SectionScoreCache.findAll({
      where: { response_id: resp.id },
      raw: true
    });

    let sectionData = [];
    if (!cacheRows.length) {
      // 3️⃣ Dynamic aggregation if cache is empty
      sectionData = await Answer.findAll({
        attributes: [
          [Sequelize.col('question.section_id'), 'section_id'],
          [Sequelize.fn('COUNT', Sequelize.col('Answer.id')), 'questions_answered'],
          [Sequelize.fn('SUM', Sequelize.col('option_score_snapshot')), 'section_score']
        ],
        where: { response_id: resp.id },
        include: [{ model: Question, attributes: [] }],
        group: ['question.section_id'],
        raw: true
      });
    }

    // 4️⃣ Always load section definitions (sorted)
    const sections = await Section.findAll({
      order: [['sort_order', 'ASC'], ['id', 'ASC']],
      raw: true
    });

    // 5️⃣ Compute section summaries (merge cache/dynamic)
    const sectionSummary = sections.map((s) => {
      const row = cacheRows.length
        ? cacheRows.find((c) => String(c.section_id) === String(s.id))
        : sectionData.find((r) => String(r.section_id) === String(s.id));

      return {
        section_id: s.id,
        section_title: s.title,
        section_score: row ? parseInt(row.section_score || row.total_score || 0, 10) : 0,
        questions_answered: row ? parseInt(row.questions_answered || 0, 10) : 0
      };
    });

    // 6️⃣ Compute max possible scores per section dynamically
    // NOTE: assumes an Option table exists and linked to Question
    const maxScores = await sequelize.query(
      `
        SELECT q.section_id, SUM(o.score) AS max_score
        FROM hr_analyzer_questions q
        JOIN hr_analyzer_options o ON o.question_id = q.id
       -- WHERE o.deleted_at IS NULL OR o.deleted_at IS NULL
        GROUP BY q.section_id
      `,
      { type: Sequelize.QueryTypes.SELECT }
    );

    // merge with section summary
    const sectionRatings = sectionSummary.map((sec) => {
      const maxRow = maxScores.find((m) => String(m.section_id) === String(sec.section_id));
      return {
        sectionName: sec.section_title,
        score: sec.section_score,
        mxmScore: maxRow ? parseInt(maxRow.max_score || 0, 10) : 0
      };
    });

    const totalScore = sectionRatings.reduce((sum, x) => sum + x.score, 0);
    const maxmScore = sectionRatings.reduce((sum, x) => sum + x.mxmScore, 0);

    // 7️⃣ Derive key insights: strong, weak, improvement areas
    const sortedSections = [...sectionRatings].sort((a, b) => b.score - a.score);
    const keyInsights = [
      {
        name: `Strong Area: ${sortedSections[0]?.sectionName || 'N/A'}`,
        status: 'success'
      },
      {
        name: `Weak Area: ${sortedSections[sortedSections.length - 1]?.sectionName || 'N/A'}`,
        status: 'danger'
      },
      {
        name: `Needs Improvement: ${sortedSections[Math.floor(sortedSections.length / 2)]?.sectionName || 'N/A'}`,
        status: 'warning'
      }
    ];

    // 8️⃣ Build detailed summary per section from Answer table
    const answers = await Answer.findAll({
      where: { response_id: resp.id },
      include: [{ model: Question, attributes: ['section_id'] }],
      raw: true
    });

    const sectionWiseAnswers = sections.map((s) => {
      const secAnswers = answers.filter((a) => String(a['question.section_id']) === String(s.id));
      const strengths = secAnswers
        .map((a) => a.option_strength_snapshot)
        .filter(Boolean);
      const gaps = secAnswers.map((a) => a.option_gap_snapshot).filter(Boolean);
      const recommendations = secAnswers
        .map((a) => a.option_recommendation_snapshot)
        .filter(Boolean);

      const score = sectionRatings.find((r) => r.sectionName === s.title)?.score || 0;
      const maxScore = sectionRatings.find((r) => r.sectionName === s.title)?.mxmScore || 0;
      const completionRate = maxScore ? `${Math.round((score / maxScore) * 100)}%` : '0%';

      return {
        name: s.title,
        score,
        maxScore,
        completionRate,
        strengths,
        gaps,
        recommendations
      };
    });

    // 9️⃣ Final JSON report object
    const report = {
      id: `RPT-${resp.id}`,
      company: resp.company || 'Unknown',
      submitted: resp.completed_at
        ? new Date(resp.completed_at).toISOString().split('T')[0]
        : null,
      contact: resp.contact || resp.email || null,
      score: totalScore,
      status: resp.completed_at ? 'Completed' : 'In Progress',
      details: {
        overAllScore: totalScore,
        maxmScore,
        summaryStatus: 'Immediate Attention Required',
        summaryType: 'danger',
        sectionRatings,
        keyInsights,
        summary: sectionWiseAnswers
      }
    };

    return res.json(report);
  } catch (err) {
    console.error('❌ Error in getSummaryReport:', err);
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
};

module.exports = { getSummary };

// module.exports = { getSummary };
