const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  return sequelize.define('Answer', {
    id: {
      type: DataTypes.BIGINT.UNSIGNED,
      autoIncrement: true,
      primaryKey: true
    },
    response_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
    question_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
    option_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
    option_score_snapshot: { type: DataTypes.INTEGER, allowNull: false },
    option_gap_snapshot: { type: DataTypes.TEXT, allowNull: true },
    option_strength_snapshot: { type: DataTypes.TEXT, allowNull: true },
    option_recommendation_snapshot: { type: DataTypes.TEXT, allowNull: true },
    answered_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW }
  }, {
    tableName: 'hr_analyzer_answers',
    timestamps: false,
    indexes: [
      {
        unique: true,
        fields: ['response_id', 'question_id']
      }
    ]
  });
};
