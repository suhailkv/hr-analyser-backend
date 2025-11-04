const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  return sequelize.define('Option', {
    id: {
      type: DataTypes.BIGINT.UNSIGNED,
      autoIncrement: true,
      primaryKey: true
    },
    question_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
    label: { type: DataTypes.STRING, allowNull: true },
    detail: { type: DataTypes.TEXT, allowNull: true },
    score: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    gap: { type: DataTypes.TEXT, allowNull: true },
    strength: { type: DataTypes.TEXT, allowNull: true },
    recommendation: { type: DataTypes.TEXT, allowNull: true },
    sort_order: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    is_active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true }
  }, {
    tableName: 'hr_analyzer_options'
  });
};
