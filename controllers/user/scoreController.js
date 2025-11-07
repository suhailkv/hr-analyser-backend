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
// controllers/adminController.js

// const { Response, SectionScoreCache, Sequelize, sequelize } = require('../models');

const getAllSubmissions = async (req, res) => {
  try {
    // 🔹 Query params for pagination & search
    const page = parseInt(req.query.page || '1', 10);
    const limit = parseInt(req.query.limit || '20', 10);
    const offset = (page - 1) * limit;
    const search = req.query.search ? req.query.search.trim() : '';

    // 🔹 Where condition (search across name, email, company)
    const whereClause = {};
    if (search) {
      whereClause[Sequelize.Op.or] = [
        { full_name: { [Sequelize.Op.like]: `%${search}%` } },
        { email: { [Sequelize.Op.like]: `%${search}%` } },
        { company: { [Sequelize.Op.like]: `%${search}%` } },
        { contact: { [Sequelize.Op.like]: `%${search}%` } }
      ];
    }

    // 🔹 Fetch responses with pagination
    const { rows: responses, count: total } = await Response.findAndCountAll({
      where: whereClause,
      order: [['started_at', 'DESC']],
      limit,
      offset,
      raw: true
    });

    // 🔹 Get total scores per response (from cache)
    const responseIds = responses.map((r) => r.id);
    let scoreData = [];
    if (responseIds.length) {
      scoreData = await SectionScoreCache.findAll({
        attributes: [
          'response_id',
          [sequelize.fn('SUM', sequelize.col('total_score')), 'total_score']
        ],
        where: { response_id: responseIds },
        group: ['response_id'],
        raw: true
      });
    }

    const scoreMap = {};
    scoreData.forEach((s) => (scoreMap[s.response_id] = parseInt(s.total_score, 10)));

    // 🔹 Build admin-friendly list
    const submissions = responses.map((r) => {
      const totalScore = scoreMap[r.id] || 0;
      return {
        id: r.id,
        session_uuid: r.session_uuid,
        company: r.company || 'Unknown',
        full_name: r.full_name || 'Anonymous',
        email: r.email || '-',
        contact: r.contact || '-',
        score: totalScore,
        status: r.completed_at ? 'Completed' : 'In Progress',
        submitted_at: r.completed_at
          ? new Date(r.completed_at).toISOString().split('T')[0]
          : null,
        started_at: new Date(r.started_at).toISOString().split('T')[0]
      };
    });

    // 🔹 Return paginated response
    return res.json({
      page,
      pageSize: limit,
      total,
      totalPages: Math.ceil(total / limit),
      data: submissions
    });
  } catch (err) {
    console.error('❌ Error in getAllSubmissions:', err);
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
};
// controllers/summaryController.js

// const { sequelize, Sequelize, Response, Section, SectionScoreCache, Answer, Question, Option } = require('../models');

// controllers/summaryController.js

// const { sequelize, Sequelize, Response, Section, SectionScoreCache, Answer, Question } = require('../models');

const updateSummaryFromReport = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { session_uuid } = req.params;
    const report = req.body;

    if (!report || !report.details) {
      await t.rollback();
      return res.status(400).json({ message: 'Invalid payload format. Expected report.details.' });
    }

    // 1️⃣ Extract top-level fields
    const company = report.company || null;
    const contact = report.contact || null;

    // Find response
    const resp = await Response.findOne({ where: { session_uuid }, transaction: t });
    if (!resp) {
      await t.rollback();
      return res.status(404).json({ message: 'Response not found' });
    }

    // Update basic fields
    await resp.update({ company, contact }, { transaction: t });

    // 2️⃣ Extract section ratings
    const sectionRatings = report.details.sectionRatings || [];
    const summaryDetails = report.details.summary || [];

    if (!Array.isArray(sectionRatings) || !Array.isArray(summaryDetails)) {
      await t.rollback();
      return res.status(400).json({ message: 'Invalid sectionRatings or summary arrays.' });
    }

    // Load section mapping
    const sections = await Section.findAll({ attributes: ['id', 'title'], raw: true, transaction: t });
    const sectionMap = {};
    sections.forEach(s => { sectionMap[s.title] = s.id; });

    // 3️⃣ Replace SectionScoreCache
    await SectionScoreCache.destroy({ where: { response_id: resp.id }, transaction: t });

    // Deduplicate by section_id (keep the last occurrence)
const sectionCacheMap = {};
for (const s of sectionRatings) {
  const sectionId = sectionMap[s.sectionName];
  if (!sectionId) continue;
  const totalScore = parseInt(s.score || 0, 10);
  const maxScore = parseInt(s.mxmScore || 0, 10);
  if (totalScore > maxScore) {
    await t.rollback();
    return res.status(400).json({
      message: `Section "${s.sectionName}" score exceeds max (${totalScore}/${maxScore})`
    });
  }
  // overwrite existing if duplicated
  sectionCacheMap[sectionId] = {
    response_id: resp.id,
    section_id: sectionId,
    total_score: totalScore,
    questions_answered: 0,
    last_calculated_at: new Date()
  };
}
const sectionCacheInserts = Object.values(sectionCacheMap);
if (sectionCacheInserts.length) {
  await SectionScoreCache.bulkCreate(sectionCacheInserts, { transaction: t });
}


    // 4️⃣ Replace Answers
    await Answer.destroy({ where: { response_id: resp.id }, transaction: t });

    const answerInserts = [];
    for (const s of summaryDetails) {
      const sectionId = sectionMap[s.name];
      if (!sectionId) continue;

      const sectionScore = parseInt(s.score || 0, 10);
      const maxScore = parseInt(s.maxScore || 0, 10);
      if (sectionScore > maxScore) {
        await t.rollback();
        return res.status(400).json({ message: `Section "${s.name}" score exceeds max (${sectionScore}/${maxScore})` });
      }

      // Flatten strengths/gaps/recommendations into separate rows (1 per recommendation set)
      const maxLen = Math.max(
        s.strengths.length,
        s.gaps.length,
        s.recommendations.length
      );

      for (let i = 0; i < maxLen; i++) {
        answerInserts.push({
          response_id: resp.id,
          question_id: null, // we don’t have question reference from report, only section-level summary
          option_id: null,
          option_score_snapshot: 0,
          option_strength_snapshot: s.strengths[i] || null,
          option_gap_snapshot: s.gaps[i] || null,
          option_recommendation_snapshot: s.recommendations[i] || null,
          answered_at: new Date()
        });
      }
    }

    if (answerInserts.length) {
      await Answer.bulkCreate(answerInserts, { transaction: t });
    }

    await t.commit();
    return res.json({ success: true });
  } catch (err) {
    console.error('❌ Error in updateSummaryFromReport:', err);
    try { await t.rollback(); } catch (e) {}
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
};

module.exports = { updateSummaryFromReport };




module.exports = { getSummary,getAllSubmissions ,updateSummaryFromReport};

// module.exports = { getSummary };
