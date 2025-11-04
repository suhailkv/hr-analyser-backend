const sequelize = require('../config/database');
const Sequelize = require('sequelize');

const Admin = require('./admin');
const Section = require('./section');
const Question = require('./question');
const Option = require('./option');
const Response = require('./response');
const Answer = require('./answer');
const SectionScoreCache = require('./section_score_cache');

const db = {
  sequelize,
  Sequelize,
  Admin: Admin(sequelize),
  Section: Section(sequelize),
  Question: Question(sequelize),
  Option: Option(sequelize),
  Response: Response(sequelize),
  Answer: Answer(sequelize),
  SectionScoreCache: SectionScoreCache(sequelize)
};

// setup associations
require('./associations')(db);

module.exports = db;
