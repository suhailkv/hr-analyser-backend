const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  return sequelize.define('Section', {
    id: {
      type: DataTypes.BIGINT.UNSIGNED,
      autoIncrement: true,
      primaryKey: true
    },
    title: { type: DataTypes.STRING, allowNull: false },
    description: { type: DataTypes.TEXT, allowNull: true },
    sort_order: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    is_active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    created_by: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true },
    deleted_at: { type: DataTypes.DATE, allowNull: true }
  }, {
    tableName: 'hr_analyzer_sections',
    paranoid: false
  });
};
