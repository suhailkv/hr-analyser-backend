const db = require('../../models');
const Question = db.Question;
const Section = db.Section;
const Option = db.Option;

const create = async (req, res) => {
  try {
    const { section_id, text, help_text, sort_order = 0, is_active = true } = req.body;
    const created_by = req.adminId || null;
    // ensure section exists
    const section = await Section.findByPk(section_id);
    if (!section) return res.status(400).json({ message: 'invalid section_id' });
    const q = await Question.create({ section_id, text, help_text, sort_order, is_active, created_by });
    return res.status(201).json(q);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'server error' });
  }
};

const list = async (req, res) => {
  try {
    const where = {};
    if (req.query.section_id) where.section_id = req.query.section_id;
    const questions = await Question.findAll({ where, order: [['sort_order', 'ASC'], ['id', 'ASC']], include: [Option] });
    return res.json(questions);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'server error' });
  }
};

const getOne = async (req, res) => {
  try {
    const q = await Question.findByPk(req.params.id, { include: [Option] });
    if (!q) return res.status(404).json({ message: 'not found' });
    return res.json(q);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'server error' });
  }
};

const update = async (req, res) => {
  try {
    const q = await Question.findByPk(req.params.id);
    if (!q) return res.status(404).json({ message: 'not found' });
    await q.update(req.body);
    return res.json(q);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'server error' });
  }
};

const remove = async (req, res) => {
  try {
    const q = await Question.findByPk(req.params.id);
    if (!q) return res.status(404).json({ message: 'not found' });
    await q.destroy();
    return res.json({ message: 'deleted' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'server error' });
  }
};

module.exports = { create, list, getOne, update, remove };
