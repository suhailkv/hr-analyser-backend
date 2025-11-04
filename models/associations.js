module.exports = (db) => {
  const { Admin, Section, Question, Option, Response, Answer, SectionScoreCache } = db;

  // Admin -> Sections, Questions (created_by)
  Admin.hasMany(Section, { foreignKey: 'created_by' });
  Section.belongsTo(Admin, { foreignKey: 'created_by' });

  Admin.hasMany(Question, { foreignKey: 'created_by' });
  Question.belongsTo(Admin, { foreignKey: 'created_by' });

  // Section -> Question
  Section.hasMany(Question, { foreignKey: 'section_id', onDelete: 'CASCADE' });
  Question.belongsTo(Section, { foreignKey: 'section_id' });

  // Question -> Option
  Question.hasMany(Option, { foreignKey: 'question_id', onDelete: 'CASCADE' });
  Option.belongsTo(Question, { foreignKey: 'question_id' });

  // Response -> Answer
  Response.hasMany(Answer, { foreignKey: 'response_id', onDelete: 'CASCADE' });
  Answer.belongsTo(Response, { foreignKey: 'response_id' });

  // Question -> Answer
  Question.hasMany(Answer, { foreignKey: 'question_id', onDelete: 'CASCADE' });
  Answer.belongsTo(Question, { foreignKey: 'question_id' });

  // Option referenced by Answer (option_id)
  Option.hasMany(Answer, { foreignKey: 'option_id' });
  Answer.belongsTo(Option, { foreignKey: 'option_id' });

  // SectionScoreCache
  Response.hasMany(SectionScoreCache, { foreignKey: 'response_id', onDelete: 'CASCADE' });
  SectionScoreCache.belongsTo(Response, { foreignKey: 'response_id' });

  Section.hasMany(SectionScoreCache, { foreignKey: 'section_id', onDelete: 'CASCADE' });
  SectionScoreCache.belongsTo(Section, { foreignKey: 'section_id' });
};
