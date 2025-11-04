const db = require('../../models');
const Option = db.Option;
const Question = db.Question;

const create = async (req, res) => {
  try {
    const { question_id, label, detail, score = 0, gap, strength, recommendation, sort_order = 0, is_active = true } = req.body;
    const question = await Question.findByPk(question_id);
    if (!question) return res.status(400).json({ message: 'invalid question_id' });
    const opt = await Option.create({ question_id, label, detail, score, gap, strength, recommendation, sort_order, is_active });
    return res.status(201).json(opt);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'server error' });
  }
};

const list = async (req, res) => {
  try {
    const where = {};
    if (req.query.question_id) where.question_id = req.query.question_id;
    const options = await Option.findAll({ where, order: [['sort_order', 'ASC'], ['id', 'ASC']] });
    return res.json(options);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'server error' });
  }
};

const getOne = async (req, res) => {
  try {
    const opt = await Option.findByPk(req.params.id);
    if (!opt) return res.status(404).json({ message: 'not found' });
    return res.json(opt);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'server error' });
  }
};

const update = async (req, res) => {
  try {
    const opt = await Option.findByPk(req.params.id);
    if (!opt) return res.status(404).json({ message: 'not found' });
    await opt.update(req.body);
    return res.json(opt);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'server error' });
  }
};

const remove = async (req, res) => {
  try {
    const opt = await Option.findByPk(req.params.id);
    if (!opt) return res.status(404).json({ message: 'not found' });
    await opt.destroy();
    return res.json({ message: 'deleted' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'server error' });
  }
};

module.exports = { create, list, getOne, update, remove };
