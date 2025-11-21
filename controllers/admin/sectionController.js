const db = require('../../models');
const Section = db.Section;
const Question = db.Question;
const Option = db.Option;

const create = async (req, res) => {
  try {
    const { title, description, sort_order = 0, is_active = true } = req.body;
    const created_by = req.adminId || null;
    const section = await Section.create({ title, description, sort_order, is_active, created_by });
    return res.status(201).json(section);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'server error' });
  }
};

const { Sequelize } = require('sequelize');

const list = async (req, res) => {
  try {
    const sections = await Section.findAll({
      attributes: [
        ['id', 'id'],
        ['title', 'section_name'],
        // 👇 Add COUNT of questions as question_count
        [Sequelize.fn('COUNT', Sequelize.col('questions.id')), 'questionCount']
      ],
      include: [
        {
          model: db.Question,
          attributes: [], // don't include actual question data, just count
          required: false
        }
      ],
      group: ['Section.id'], // ensure proper grouping for aggregation
      order: [['sort_order', 'ASC'], ['id', 'ASC']]
    });

    return res.json(sections);
  } catch (err) {
    console.error('Error fetching sections with question count:', err);
    return res.status(500).json({ message: 'server error' });
  }
};


const getOne = async (req, res) => {
  try {
    const section = await Section.findByPk(req.params.id, {
      include: [{ model: Question, include: [Option] }]
    });
    if (!section) return res.status(404).json({ message: 'not found' });
    return res.json(section);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'server error' });
  }
};

const update = async (req, res) => {
  try {
    const section = await Section.findByPk(req.params.id);
    if (!section) return res.status(404).json({ message: 'not found' });
    await section.update(req.body);
    return res.json(section);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'server error' });
  }
};

const remove = async (req, res) => {
  try {
    const section = await Section.findByPk(req.params.id);
    if (!section) return res.status(404).json({ message: 'not found' });
    await section.destroy();
    return res.json({ message: 'deleted' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'server error' });
  }
};

const markAsEnquired =  async (req, res) => {
  try {
    const uuid = req.params.uuid;
    const response = await db.Response.findOne({ where: { session_uuid : uuid } });
    if (!response) return res.status(404).json({ message: 'Response not found' });
    response.is_enquired = new Date();
    await response.save();
    return res.json({ message: 'User enquiry endpoint - to be implemented' });
  }
  catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'server error' });
  }
  
}
module.exports = { create, list, getOne, update, remove ,markAsEnquired};
