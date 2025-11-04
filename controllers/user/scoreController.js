const db = require('../../models');

const Response = db.Response;
const Section = db.Section;
const SectionScoreCache = db.SectionScoreCache;
const Answer = db.Answer;
const Question = db.Question;

const getSummary = async (req, res) => {
  try {
    const { session_uuid } = req.params;
    const resp = await Response.findOne({ where: { session_uuid } });
    if (!resp) return res.status(404).json({ message: 'session not found' });

    // load cache rows
    const cacheRows = await SectionScoreCache.findAll({ where: { response_id: resp.id }, raw: true });

    // If cache is empty (e.g., older responses), compute dynamically
    if (!cacheRows.length) {
      // dynamic aggregator
      const rows = await Answer.findAll({
        attributes: [
          [db.Sequelize.col('question.section_id'), 'section_id'],
          [db.Sequelize.fn('COUNT', db.Sequelize.col('Answer.id')), 'questions_answered'],
          [db.Sequelize.fn('SUM', db.Sequelize.col('option_score_snapshot')), 'section_score']
        ],
        where: { response_id: resp.id },
        include: [{ model: Question, attributes: [] }],
        group: ['question.section_id'],
        raw: true
      });

      const sections = await Section.findAll({ order: [['sort_order', 'ASC'], ['id', 'ASC']], raw: true });
      const sectionSummary = sections.map(s => {
        const r = rows.find(rr => String(rr.section_id) === String(s.id));
        return {
          section_id: s.id,
          section_title: s.title,
          questions_answered: r ? parseInt(r.questions_answered || 0, 10) : 0,
          section_score: r ? parseInt(r.section_score || 0, 10) : 0
        };
      });
      const total_score = sectionSummary.reduce((sum, x) => sum + x.section_score, 0);
      const total_questions = sectionSummary.reduce((sum, x) => sum + x.questions_answered, 0);
      return res.json({ session_uuid: resp.session_uuid, response_id: resp.id, section_summary: sectionSummary, total_score, total_questions });
    }

    // If cache exists, join with section list for consistent ordering
    const sections = await Section.findAll({ order: [['sort_order', 'ASC'], ['id', 'ASC']], raw: true });
    const sectionSummary = sections.map(s => {
      const cached = cacheRows.find(c => String(c.section_id) === String(s.id));
      return {
        section_id: s.id,
        section_title: s.title,
        questions_answered: cached ? cached.questions_answered : 0,
        section_score: cached ? cached.total_score : 0
      };
    });

    const total_score = sectionSummary.reduce((sum, x) => sum + x.section_score, 0);
    const total_questions = sectionSummary.reduce((sum, x) => sum + x.questions_answered, 0);

    return res.json({ session_uuid: resp.session_uuid, response_id: resp.id, section_summary: sectionSummary, total_score, total_questions });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'server error' });
  }
};

module.exports = { getSummary };
