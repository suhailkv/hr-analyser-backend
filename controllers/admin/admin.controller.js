const { Response, Answer, Question, Option, Section, sequelize } = require('../../models');
const { Sequelize } = require('sequelize');

const getSessionDetails = async (req, res) => {
    try {
        const { session_uuid } = req.params;

        // 1. Find Response
        const resp = await Response.findOne({ where: { session_uuid } });
        if (!resp) {
            return res.status(404).json({ message: 'Session not found' });
        }

        // 2. Fetch Answers with associations
        const answers = await Answer.findAll({
            where: { response_id: resp.id },
            include: [
                {
                    model: Question,
                    include: [
                        { model: Section, attributes: ['id', 'title'] },
                        // We need to find max score for the question. 
                        // Since we can't easily aggregate inside this include for a single field without grouping issues,
                        // we might fetch options separately or use a subquery.
                        // For simplicity and performance, let's fetch options for these questions or use the 'score' from the selected option 
                        // BUT user asked for "questionScore". I assumed it means max possible score.
                        // Let's fetch all options for the questions involved to calculate max score.
                        { model: Option, attributes: ['id', 'score'] }
                    ]
                },
                { model: Option, attributes: ['id', 'label', 'score'] } // Selected option
            ]
        });

        // 3. Transform Data
        const result = answers.map(answer => {
            const question = answer.Question;
            const selectedOption = answer.Option;
            const section = question.Section;

            // Calculate max score for this question
            const maxQuestionScore = question.Options
                ? Math.max(...question.Options.map(o => o.score))
                : 0;

            return {
                sectionId: section?.id || null,
                sectionName: section?.title || null,
                questionId: question?.id || null,
                question: question?.text || null,
                questionScore: maxQuestionScore,
                answerId: selectedOption?.id || null,
                answer: selectedOption?.label || null,
                answerScore: selectedOption?.score || 0
            };
        });

        return res.json(result);

    } catch (err) {
        console.error('❌ Error in getSessionDetails:', err);
        return res.status(500).json({ message: 'Server error', error: err.message });
    }
};

module.exports = {
    getSessionDetails
};
