const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  return sequelize.define('Response', {
    id: {
      type: DataTypes.BIGINT.UNSIGNED,
      autoIncrement: true,
      primaryKey: true
    },
    session_uuid: { type: DataTypes.CHAR(36), allowNull: false, unique: true },
    ip_address: { type: DataTypes.STRING(45), allowNull: true },
    user_agent: { type: DataTypes.TEXT, allowNull: true },
    started_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    completed_at: { type: DataTypes.DATE, allowNull: true }
  }, {
    tableName: 'hr_analyzer_responses',
    timestamps: false
  });
};
