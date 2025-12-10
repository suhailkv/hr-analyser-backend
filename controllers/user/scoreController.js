// const db = require('../../models');

// const Response = db.Response;
// const Section = db.Section;
// const SectionScoreCache = db.SectionScoreCache;
// const Answer = db.Answer;
// const Question = db.Question;

// controllers/reportController.js

// const { Response, Section, SectionScoreCache, Answer, Question, Option, sequelize } = require('../../models');
// const { Sequelize } = require('sequelize');

// const getSummary = async (req, res) => {
//   try {
//     const { session_uuid } = req.params;

//     // 1️⃣ Fetch response
//     const resp = await Response.findOne({ where: { session_uuid } });
//     if (!resp) return res.status(404).json({ message: 'Session not found' });

//     // 2️⃣ Try loading cached section scores (which now include strength/gap/recommendation)
//     const cacheRows = await SectionScoreCache.findAll({
//       where: { response_id: resp.id },
//       raw: true
//     });

//     // 3️⃣ Dynamic aggregation if cache is empty
//     let sectionData = [];
//     if (!cacheRows.length) {
//       sectionData = await Answer.findAll({
//         attributes: [
//           [Sequelize.col('question.section_id'), 'section_id'],
//           [Sequelize.fn('COUNT', Sequelize.col('Answer.id')), 'questions_answered'],
//           [Sequelize.fn('SUM', Sequelize.col('option_score_snapshot')), 'section_score']
//         ],
//         where: { response_id: resp.id },
//         include: [{ model: Question, attributes: [] }],
//         group: ['question.section_id'],
//         raw: true
//       });
//     }

//     // 4️⃣ Always load section definitions (sorted)
//     const sections = await Section.findAll({
//       order: [['sort_order', 'ASC'], ['id', 'ASC']],
//       raw: true
//     });

//     // 5️⃣ Compute section summaries (merge cache/dynamic)
//     const sectionSummary = sections.map((s) => {
//       const row = cacheRows.length
//         ? cacheRows.find((c) => String(c.section_id) === String(s.id))
//         : sectionData.find((r) => String(r.section_id) === String(s.id));

//       return {
//         section_id: s.id,
//         section_title: s.title,
//         section_score: row ? parseInt(row.section_score || row.total_score || 0, 10) : 0,
//         questions_answered: row ? parseInt(row.questions_answered || 0, 10) : 0,
//         strength: row?.strength || null,
//         gap: row?.gap || null,
//         recommendation: row?.recommendation || null,
//         graph_type: row?.graph_type || null
//       };
//     });

//     // 6️⃣ Compute max possible scores per section dynamically
//     const maxScores = await sequelize.query(
//       `
//         SELECT q.section_id, SUM(o.score) AS max_score
//         FROM hr_analyzer_questions q
//         JOIN hr_analyzer_options o ON o.question_id = q.id
//         GROUP BY q.section_id
//       `,
//       { type: Sequelize.QueryTypes.SELECT }
//     );

//     // merge with section summary
//     const sectionRatings = sectionSummary.map((sec) => {
//       const maxRow = maxScores.find((m) => String(m.section_id) === String(sec.section_id));
//       return {
//         sectionName: sec.section_title,
//         score: sec.section_score,
//         mxmScore: maxRow ? parseInt(maxRow.max_score || 0, 10) : 0,
//         graphType : sec.graph_type || null
//       };
//     });

//     const totalScore = sectionRatings.reduce((sum, x) => sum + x.score, 0);
//     const maxmScore = sectionRatings.reduce((sum, x) => sum + x.mxmScore, 0);

//     // 7️⃣ Derive key insights
//     const sortedSections = [...sectionRatings].sort((a, b) => b.score - a.score);
//     const keyInsights = [
//       {
//         name: `Strong Area: ${sortedSections[0]?.sectionName || 'N/A'}`,
//         status: 'success'
//       },
//       {
//         name: `Weak Area: ${sortedSections[sortedSections.length - 1]?.sectionName || 'N/A'}`,
//         status: 'danger'
//       },
//       {
//         name: `Needs Improvement: ${
//           sortedSections[Math.floor(sortedSections.length / 2)]?.sectionName || 'N/A'
//         }`,
//         status: 'warning'
//       }
//     ];

//     // 8️⃣ Preload answers (needed if cache is empty)
//     let answers = [];
//     if (!cacheRows.length) {
//       answers = await Answer.findAll({
//         where: { response_id: resp.id },
//         include: [{ model: Question, attributes: ['section_id'] }],
//         raw: true
//       });
//     }

//     // 9️⃣ Build detailed summary per section
//     const sectionWiseAnswers = sections.map((s) => {
//       const row = sectionSummary.find((r) => String(r.section_id) === String(s.id));

//       const secAnswers = !cacheRows.length
//         ? answers.filter((a) => String(a['question.section_id']) === String(s.id))
//         : [];

//       const strengths = row?.strength
//         ? row.strength.split('\n').filter(Boolean)
//         : secAnswers.map((a) => a.option_strength_snapshot).filter(Boolean);

//       const gaps = row?.gap
//         ? row.gap.split('\n').filter(Boolean)
//         : secAnswers.map((a) => a.option_gap_snapshot).filter(Boolean);

//       const recommendations = row?.recommendation
//         ? row.recommendation.split('\n').filter(Boolean)
//         : secAnswers.map((a) => a.option_recommendation_snapshot).filter(Boolean);

//       const score = sectionRatings.find((r) => r.sectionName === s.title)?.score || 0;
//       const maxScore = sectionRatings.find((r) => r.sectionName === s.title)?.mxmScore || 0;
//       const completionRate = maxScore ? `${Math.round((score / maxScore) * 100)}%` : '0%';

//       return {
//         name: s.title,
//         score,
//         maxScore,
//         completionRate,
//         strengths,
//         gaps,
//         recommendations
//       };
//     });

//     // 🔟 Final JSON report object
//     const report = {
//       id: `RPT-${resp.id}`,
//       company: resp.company || 'Unknown',
//       submitted: resp.completed_at
//         ? new Date(resp.completed_at).toISOString().split('T')[0]
//         : null,
//       contact: resp.contact || resp.email || null,
//       score: totalScore,
//       status: resp.completed_at ? 'Completed' : 'In Progress',
//       details: {
//         overAllScore: totalScore,
//         maxmScore,
//         summaryStatus: 'Immediate Attention Required',
//         summaryType: 'danger',
//         sectionRatings,
//         keyInsights,
//         summary: sectionWiseAnswers
//       }
//     };

//     return res.json(report);
//   } catch (err) {
//     console.error('❌ Error in getSummaryReport:', err);
//     return res.status(500).json({ message: 'Server error', error: err.message });
//   }
// };


// // controllers/adminController.js

// // const { Response, SectionScoreCache, Sequelize, sequelize } = require('../models');

// const getAllSubmissions = async (req, res) => {
//   try {
//     // 🔹 Query params for pagination & search
//     const page = parseInt(req.query.page || '1', 10);
//     const limit = parseInt(req.query.limit || '20', 10);
//     const offset = (page - 1) * limit;
//     const search = req.query.search ? req.query.search.trim() : '';

//     // 🔹 Where condition (search across name, email, company)
//     const whereClause = {};
//     if (search) {
//       whereClause[Sequelize.Op.or] = [
//         { full_name: { [Sequelize.Op.like]: `%${search}%` } },
//         { email: { [Sequelize.Op.like]: `%${search}%` } },
//         { company: { [Sequelize.Op.like]: `%${search}%` } },
//         { contact: { [Sequelize.Op.like]: `%${search}%` } }
//       ];
//     }

//     // 🔹 Fetch responses with pagination
//     const { rows: responses, count: total } = await Response.findAndCountAll({
//       where: whereClause,
//       order: [['started_at', 'DESC']],
//       limit,
//       offset,
//       raw: true
//     });

//     // 🔹 Get total scores per response (from cache)
//     const responseIds = responses.map((r) => r.id);
//     let scoreData = [];
//     if (responseIds.length) {
//       scoreData = await SectionScoreCache.findAll({
//         attributes: [
//           'response_id',
//           [sequelize.fn('SUM', sequelize.col('total_score')), 'total_score']
//         ],
//         where: { response_id: responseIds },
//         group: ['response_id'],
//         raw: true
//       });
//     }

//     const scoreMap = {};
//     scoreData.forEach((s) => (scoreMap[s.response_id] = parseInt(s.total_score, 10)));

//     // 🔹 Build admin-friendly list
//     const submissions = responses.map((r) => {
//       const totalScore = scoreMap[r.id] || 0;
//       return {
//         id: r.id,
//         session_uuid: r.session_uuid,
//         company: r.company || 'Unknown',
//         full_name: r.full_name || 'Anonymous',
//         email: r.email || '-',
//         contact: r.contact || '-',
//         score: totalScore,
//         status: r.completed_at ? 'Completed' : 'In Progress',
//         submitted_at: r.completed_at
//           ? new Date(r.completed_at).toISOString().split('T')[0]
//           : null,
//         started_at: new Date(r.started_at).toISOString().split('T')[0]
//       };
//     });

//     // 🔹 Return paginated response
//     return res.json({
//       page,
//       pageSize: limit,
//       total,
//       totalPages: Math.ceil(total / limit),
//       data: submissions
//     });
//   } catch (err) {
//     console.error('❌ Error in getAllSubmissions:', err);
//     return res.status(500).json({ message: 'Server error', error: err.message });
//   }
// };
// // controllers/summaryController.js

// // const { sequelize, Sequelize, Response, Section, SectionScoreCache, Answer, Question, Option } = require('../models');

// // controllers/summaryController.js

// // const { sequelize, Sequelize, Response, Section, SectionScoreCache, Answer, Question } = require('../models');

// const updateSummaryFromReport = async (req, res) => {
//   const t = await sequelize.transaction();
//   try {
//     const { session_uuid } = req.params;
//     const report = req.body;

//     if (!report || !report.details) {
//       await t.rollback();
//       return res.status(400).json({ message: 'Invalid payload format. Expected report.details.' });
//     }

//     // 1️⃣ Extract top-level fields
//     const company = report.company || null;
//     const contact = report.contact || null;   

//     // Find response
//     const resp = await Response.findOne({ where: { session_uuid }});
//     if (!resp) {
//       await t.rollback();
//       return res.status(404).json({ message: 'Response not found' });
//     }

//     // Update basic fields
//     await resp.update({ company, contact }, { transaction: t });

//     // 2️⃣ Extract section ratings
//     const sectionRatings = report.details.sectionRatings || [];
//     const summaryDetails = report.details.summary || [];

//     if (!Array.isArray(sectionRatings) || !Array.isArray(summaryDetails)) {
//       await t.rollback();
//       return res.status(400).json({ message: 'Invalid sectionRatings or summary arrays.' });
//     }

//     // Load section mapping
//     const sections = await Section.findAll({ attributes: ['id', 'title'], raw: true});
//     const sectionMap = {};
//     sections.forEach(s => { sectionMap[s.title] = s.id; });

//     // 3️⃣ Replace SectionScoreCache
//     await SectionScoreCache.destroy({ where: { response_id: resp.id }, transaction: t });

//     // Deduplicate by section_id (keep the last occurrence)
// const sectionCacheMap = {};

// for (const s of sectionRatings) {
//   const sectionId = sectionMap[s.sectionName];
//   if (!sectionId) continue;

//   const totalScore = parseInt(s.score || 0, 10);
//   const maxScore = parseInt(s.mxmScore || 0, 10);
//   if (totalScore > maxScore) {
//     await t.rollback();
//     return res.status(400).json({
//       message: `Section "${s.sectionName}" score exceeds max (${totalScore}/${maxScore})`
//     });
//   }

//   // find summary details for this section
//       const matchingSummary = (report.details.summary || []).find(
//         d => d.name === s.sectionName
//       );

//       sectionCacheMap[sectionId] = {
//         response_id: resp.id,
//         section_id: sectionId,
//         total_score: totalScore,
//         questions_answered: 0,
//         last_calculated_at: new Date(),
//         strength: matchingSummary?.strengths?.join('\n') || null,
//         gap: matchingSummary?.gaps?.join('\n') || null,
//         recommendation: matchingSummary?.recommendations?.join('\n') || null,
//         graph_type: matchingSummary.graphType,

//       };
//     }

//     const sectionCacheInserts = Object.values(sectionCacheMap);
//     if (sectionCacheInserts.length) {
//       await SectionScoreCache.bulkCreate(sectionCacheInserts, { transaction: t });
//     }

//     await t.commit();
//     return res.json({ success: true });
//   } catch (err) {
//     console.error('❌ Error in updateSummaryFromReport:', err);
//     try { await t.rollback(); } catch (e) {}
//     return res.status(500).json({ message: 'Server error', error: err.message });
//   }
// };

// module.exports = { getSummary,getAllSubmissions ,updateSummaryFromReport};



const { Response, Section, SectionScoreCache, Answer, Question, Option, sequelize } = require('../../models');
const { Sequelize } = require('sequelize');

const getSummary = async (req, res) => {
  try {
    const { session_uuid } = req.params;

    // 1️⃣ Fetch response
    const resp = await Response.findOne({ where: { session_uuid } });
    if (!resp) return res.status(404).json({ message: 'Session not found' });

    // 2️⃣ Try loading cached section scores (which now include strength/gap/recommendation)
    const cacheRows = await SectionScoreCache.findAll({
      where: { response_id: resp.id },
      raw: true
    });
    const allowedSectionIds = cacheRows.map(row => row.section_id);
    // 3️⃣ Dynamic aggregation if cache is empty
    let sectionData = [];
    if (!cacheRows.length) {
      sectionData = await Answer.findAll({
        attributes: [
          [Sequelize.col('question.section_id'), 'section_id'],
          [Sequelize.fn('COUNT', Sequelize.col('Answer.id')), 'questions_answered'],
          [Sequelize.fn('SUM', Sequelize.col('option_score_snapshot')), 'section_score'],

        ],
        where: { response_id: resp.id },
        include: [{
          model: Question, attributes: [],
          where: {
            deleted_at: null,
            is_active: true
          }
        }],
        group: ['question.section_id'],
        raw: true
      });
    }

    // 4️⃣ Always load section definitions (sorted)
    const sections = await Section.findAll({
      order: [['sort_order', 'ASC'], ['id', 'ASC']],
      where: {
        id: allowedSectionIds.length ? allowedSectionIds : [0]
      },
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
        questions_answered: row ? parseInt(row.questions_answered || 0, 10) : 0,
        strength: row?.strength || null,
        gap: row?.gap || null,
        recommendation: row?.recommendation || null,
        graph_type: row?.graph_type || null,

        // updated new - add recommendedNextSteps and front/back page images from cache if present
        recommendedNextSteps_immediate: resp?.recommended_immediate || null,
        recommendedNextSteps_shortTerm: resp?.recommended_long_term || null,
        recommendedNextSteps_longTerm: resp?.recommended_short_term || null,
        frontPage_Image: resp?.front_cover_image || null,
        backPage_Image: resp?.back_cover_image || null,
      };
    });

    // 6️⃣ Compute max possible scores per section dynamically
    const maxScores = await sequelize.query(
      `
        SELECT q.section_id, SUM(o.score) AS max_score
        FROM hr_analyzer_questions q
        JOIN hr_analyzer_options o ON o.question_id = q.id
        WHERE q.deleted_at IS NULL AND q.is_active = true 
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
        mxmScore: maxRow ? parseInt(maxRow.max_score || 0, 10) : 0,
        graphType: sec.graph_type || null,

      };
    });

    const totalScore = sectionRatings.reduce((sum, x) => sum + x.score, 0);
    const maxmScore = sectionRatings.reduce((sum, x) => sum + x.mxmScore, 0);

    // 7️⃣ Derive key insights
    const sortedSections = [...sectionRatings].sort((a, b) => b.score - a.score);
    const keyInsights = [
      {
        name: `Strong Area: ${totalScore != 0 ? sortedSections[0]?.sectionName : 'N/A'}`,
        status: 'success'
      },
      {
        name: `Weak Area: ${totalScore != maxmScore ? sortedSections[sortedSections.length - 1]?.sectionName : 'N/A'}`,
        status: 'danger'
      },
      {
        name: `Needs Improvement: ${totalScore != maxmScore ? sortedSections[Math.floor(sortedSections.length / 2)]?.sectionName : 'N/A'
          }`,
        status: 'warning'
      }
    ];

    // 8️⃣ Preload answers (needed if cache is empty)
    let answers = [];
    if (!cacheRows.length) {
      answers = await Answer.findAll({
        where: { response_id: resp.id },
        include: [{ model: Question, attributes: ['section_id'] }],
        raw: true
      });
    }

    // 9️⃣ Build detailed summary per section
    const sectionWiseAnswers = sections.map((s) => {
      const row = sectionSummary.find((r) => String(r.section_id) === String(s.id));

      const secAnswers = !cacheRows.length
        ? answers.filter((a) => String(a['question.section_id']) === String(s.id))
        : [];

      const strengths = row?.strength
        ? row.strength.split('\n').filter(Boolean)
        : secAnswers.map((a) => a.option_strength_snapshot).filter(Boolean);

      const gaps = row?.gap
        ? row.gap.split('\n').filter(Boolean)
        : secAnswers.map((a) => a.option_gap_snapshot).filter(Boolean);

      const recommendations = row?.recommendation
        ? row.recommendation.split('\n').filter(Boolean)
        : secAnswers.map((a) => a.option_recommendation_snapshot).filter(Boolean);

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

    // 🔟 Final JSON report object
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
        summary: sectionWiseAnswers,


        recommendedNextSteps: {
          immediate: resp.recommended_immediate ? resp.recommended_immediate.split('\n') : [],
          shortTerm: resp.recommended_short_term ? resp.recommended_short_term.split('\n') : [],
          longTerm: resp.recommended_long_term ? resp.recommended_long_term.split('\n') : [],
        },
        frontPageImage: sectionSummary[0]?.frontPage_Image || null,
        backPageImage: sectionSummary[0]?.backPage_Image || null,
      }
    };

    return res.json(report);
  } catch (err) {
    console.error('❌ Error in getSummaryReport:', err);
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
};

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
    const meta = {
      totalRecords: total,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      hasNextPage: page < Math.ceil(total / limit),
      hasPrevPage: page > 1,
    };
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
        isEnquired: r.is_enquired ? r.is_enquired : null,
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
      data: submissions,
      meta
    });
  } catch (err) {
    console.error('❌ Error in getAllSubmissions:', err);
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
};

const updateSummaryFromReport = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { session_uuid } = req.params;
    const report = req.body;

    if (!report || !report.details) {
      await t.rollback();
      return res.status(400).json({ message: 'Invalid payload format. Expected report.details.' });
    }

    // updated new - extract new fields from report
    const { frontPageImage, backPageImage, recommendedNextSteps } = report;
    const company = report.company || null;
    const contact = report.contact || null;

    const resp = await Response.findOne({ where: { session_uuid } });
    if (!resp) {
      await t.rollback();
      return res.status(404).json({ message: 'Response not found' });
    }

    // updated new - update response with new fields
    await resp.update(
      {
        company,
        contact,
        front_cover_image: frontPageImage || null,
        back_cover_image: backPageImage || null,
        recommended_immediate: recommendedNextSteps?.immediate?.join('\n') || null,
        recommended_short_term: recommendedNextSteps?.shortTerm?.join('\n') || null,
        recommended_long_term: recommendedNextSteps?.longTerm?.join('\n') || null,
      },
      // { transaction: t }
    );

    const sectionRatings = report.details.sectionRatings || [];
    const summaryDetails = report.details.summary || [];

    if (!Array.isArray(sectionRatings) || !Array.isArray(summaryDetails)) {
      await t.rollback();
      return res.status(400).json({ message: 'Invalid sectionRatings or summary arrays.' });
    }

    const sections = await Section.findAll({ attributes: ['id', 'title'], raw: true });
    const sectionMap = {};
    sections.forEach(s => { sectionMap[s.title] = s.id; });

    await SectionScoreCache.destroy({ where: { response_id: resp.id }, transaction: t });

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

      const matchingSummary = (report.details.summary || []).find(
        d => d.name === s.sectionName
      );

      // updated new - add new fields into sectionCacheMap entry
      sectionCacheMap[sectionId] = {
        response_id: resp.id,
        section_id: sectionId,
        total_score: totalScore,
        questions_answered: 0,
        last_calculated_at: new Date(),
        strength: matchingSummary?.strengths?.join('\n') || null,
        gap: matchingSummary?.gaps?.join('\n') || null,
        recommendation: matchingSummary?.recommendations?.join('\n') || null,
        graph_type: matchingSummary.graphType,

        // recommendedNextSteps_immediate: recommendedNextSteps?.immediate?.join('\n') || null,
        // recommendedNextSteps_shortTerm: recommendedNextSteps?.shortTerm?.join('\n') || null,
        // recommendedNextSteps_longTerm: recommendedNextSteps?.longTerm?.join('\n') || null,
        // frontPage_Image: frontPageImage || null,
        // backPage_Image: backPageImage || null,
      };
    }

    const sectionCacheInserts = Object.values(sectionCacheMap);
    if (sectionCacheInserts.length) {
      await SectionScoreCache.bulkCreate(sectionCacheInserts, { transaction: t });
    }

    await t.commit();
    return res.json({ success: true });
  } catch (err) {
    console.error('❌ Error in updateSummaryFromReport:', err);
    try { await t.rollback(); } catch (e) { }
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
};

const getSummaryNew = async (req, res, next, sessionUUID) => {
  try {
    const { session_uuid } = req?.params || sessionUUID;

    // 1️⃣ Fetch response
    const resp = await Response.findOne({ where: { session_uuid } });
    if (!resp) return res ? res.status(404).json({ message: 'Session not found' }) : false;

    // 2️⃣ Try loading cached section scores (which now include strength/gap/recommendation)
    const cacheRows = await SectionScoreCache.findAll({
      where: { response_id: resp.id },
      raw: true
    });
    const allowedSectionIds = cacheRows.map(row => row.section_id);

    // 3️⃣ Dynamic aggregation if cache is empty
    let sectionData = [];
    if (!cacheRows.length) {
      sectionData = await Answer.findAll({
        attributes: [
          [Sequelize.col('question.section_id'), 'section_id'],
          [Sequelize.fn('COUNT', Sequelize.col('Answer.id')), 'questions_answered'],
          [Sequelize.fn('SUM', Sequelize.col('option_score_snapshot')), 'section_score'],
        ],
        where: { response_id: resp.id },
        include: [
          {
            model: Question,
            attributes: [],
            where: {
              deleted_at: null,
              is_active: true
            }
          }],
        group: ['question.section_id'],
        raw: true
      });
    }

    // 4️⃣ Always load section definitions (sorted)
    const sections = await Section.findAll({
      order: [['sort_order', 'ASC'], ['id', 'ASC']],
      where: {
        id: allowedSectionIds.length ? allowedSectionIds : [0]
      },
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
        questions_answered: row ? parseInt(row.questions_answered || 0, 10) : 0,
        strength: row?.strength || null,
        gap: row?.gap || null,
        recommendation: row?.recommendation || null,
        graph_type: row?.graph_type || null,

        // updated new - add recommendedNextSteps and front/back page images from cache if present
        recommendedNextSteps_immediate: resp?.recommended_immediate || null,
        recommendedNextSteps_shortTerm: resp?.recommended_long_term || null,
        recommendedNextSteps_longTerm: resp?.recommended_short_term || null,
        frontPage_Image: resp?.front_cover_image || null,
        backPage_Image: resp?.back_cover_image || null,
      };
    });

    // 6️⃣ Compute max possible scores per section dynamically (NEW LOGIC)
    // Logic: Find all questions maximum score , maximm score will be biggest score of its option , then calculate section score
    const maxScores = await sequelize.query(
      `
        SELECT section_id, SUM(max_q_score) as max_score 
        FROM (
          SELECT q.section_id, MAX(o.score) as max_q_score 
          FROM hr_analyzer_questions q 
          JOIN hr_analyzer_options o ON o.question_id = q.id 
          WHERE q.deleted_at IS NULL AND q.is_active = true
          GROUP BY q.id
        ) as subquery 
        GROUP BY section_id
      `,
      { type: Sequelize.QueryTypes.SELECT }
    );

    // merge with section summary
    const sectionRatings = sectionSummary.map((sec) => {
      const maxRow = maxScores.find((m) => String(m.section_id) === String(sec.section_id));
      return {
        sectionName: sec.section_title,
        score: sec.section_score,
        mxmScore: maxRow ? parseInt(maxRow.max_score || 0, 10) : 0,
        graphType: sec.graph_type || null,
      };
    });

    const totalScore = sectionRatings.reduce((sum, x) => sum + x.score, 0);
    const maxmScore = sectionRatings.reduce((sum, x) => sum + x.mxmScore, 0);

    // 7️⃣ Derive key insights
    // Logic:
    // 1. Calculate percentage for each section to normalize scores.
    // 2. Sort by percentage descending (Strongest to Weakest).
    // 3. Strong Area: Highest score > 75% (Fallback: Highest overall)
    // 4. Weak Area: Lowest score < 40% (Fallback: Lowest overall)
    // 5. Needs Improvement: Lowest score > 40% (Fallback: Second lowest overall)

    const INSIGHT_CONFIG = {
      STRONG_THRESHOLD: 75,
      WEAK_THRESHOLD: 40
    };

    const sortedSections = [...sectionRatings]
      .map(s => ({
        ...s,
        percentage: s.mxmScore > 0 ? (s.score / s.mxmScore) * 100 : 0
      }))
      .sort((a, b) => b.percentage - a.percentage);

    // Strong Area
    let strongArea = sortedSections.find(s => s.percentage >= INSIGHT_CONFIG.STRONG_THRESHOLD);
    if (!strongArea) strongArea = sortedSections[0]; // Fallback to highest

    // Weak Area
    // Find sections below weak threshold, sort ascending (lowest first)
    const weakSections = sortedSections.filter(s => s.percentage <= INSIGHT_CONFIG.WEAK_THRESHOLD);
    let weakArea = weakSections.length > 0 ? weakSections[weakSections.length - 1] : sortedSections[sortedSections.length - 1]; // Lowest percentage

    // Needs Improvement
    // Find sections ABOVE weak threshold but not necessarily strong.
    // We want the one "just above" the weak threshold, i.e., the lowest scoring one that is > 40%.
    const improvementCandidates = sortedSections.filter(s => s.percentage > INSIGHT_CONFIG.WEAK_THRESHOLD);
    // improvementCandidates are already sorted desc. The last one is the lowest > 40%.
    let needsImprovementArea = improvementCandidates.length > 0
      ? improvementCandidates[improvementCandidates.length - 1]
      : (sortedSections.length > 1 ? sortedSections[sortedSections.length - 2] : null); // Fallback: 2nd lowest

    const keyInsights = [
      {
        name: `Strong Area: ${totalScore != 0 ? sortedSections[0]?.sectionName : 'N/A'}`,
        status: 'success'
      },
      {
        name: `Weak Area: ${totalScore != maxmScore ? sortedSections[sortedSections.length - 1]?.sectionName : 'N/A'}`,
        status: 'danger'
      },
      {
        name: `Needs Improvement: ${totalScore != maxmScore ? sortedSections[Math.floor(sortedSections.length / 2)]?.sectionName : 'N/A'
          }`,
        status: 'warning'
      }
    ];

    // 8️⃣ Preload answers (needed if cache is empty)
    let answers = [];
    if (!cacheRows.length) {
      answers = await Answer.findAll({
        where: { response_id: resp.id },
        include: [{ model: Question, attributes: ['section_id'] }],
        raw: true
      });
    }

    // 9️⃣ Build detailed summary per section
    const sectionWiseAnswers = sections.map((s) => {
      const row = sectionSummary.find((r) => String(r.section_id) === String(s.id));

      const secAnswers = !cacheRows.length
        ? answers.filter((a) => String(a['question.section_id']) === String(s.id))
        : [];

      const strengths = row?.strength
        ? row.strength.split('\n').filter(Boolean)
        : secAnswers.map((a) => a.option_strength_snapshot).filter(Boolean);

      const gaps = row?.gap
        ? row.gap.split('\n').filter(Boolean)
        : secAnswers.map((a) => a.option_gap_snapshot).filter(Boolean);

      const recommendations = row?.recommendation
        ? row.recommendation.split('\n').filter(Boolean)
        : secAnswers.map((a) => a.option_recommendation_snapshot).filter(Boolean);

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

    // 🔟 Final JSON report object
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
        summary: sectionWiseAnswers,

        recommendedNextSteps: {
          immediate: resp.recommended_immediate ? resp.recommended_immediate.split('\n') : [],
          shortTerm: resp.recommended_short_term ? resp.recommended_short_term.split('\n') : [],
          longTerm: resp.recommended_long_term ? resp.recommended_long_term.split('\n') : [],
        },
        frontPageImage: sectionSummary[0]?.frontPage_Image || null,
        backPageImage: sectionSummary[0]?.backPage_Image || null,
      }
    };

    return res ? res.json(report) : report;
  } catch (err) {
    console.error('❌ Error in getSummaryNew:', err);
    return res ? res.status(500).json({ message: 'Server error', error: err.message }) : { message: 'Server error', error: err.message };
  }
};

module.exports = { getSummary, getAllSubmissions, updateSummaryFromReport, getSummaryNew };
