const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  return sequelize.define('Response', {
    id: {
      type: DataTypes.BIGINT.UNSIGNED,
      autoIncrement: true,
      primaryKey: true
    },
    session_uuid: { type: DataTypes.CHAR(36), allowNull: false, unique: true },
    full_name: { type: DataTypes.STRING, allowNull: true },
    email : { type: DataTypes.STRING, allowNull: true },
    company: { type: DataTypes.STRING, allowNull: true },
    contact: { type: DataTypes.STRING, allowNull: true },
    ip_address: { type: DataTypes.STRING(45), allowNull: true },
    user_agent: { type: DataTypes.TEXT, allowNull: true },
    started_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    completed_at: { type: DataTypes.DATE, allowNull: true },
    front_cover_image: { type: DataTypes.STRING, allowNull: true,default:null },
    back_cover_image: { type: DataTypes.STRING, allowNull: true ,default:null},
    recommended_immediate: { type: DataTypes.TEXT, allowNull: true },
    recommended_short_term: { type: DataTypes.TEXT, allowNull: true },
    recommended_long_term: { type: DataTypes.TEXT, allowNull: true },
    is_enquired : { type: DataTypes.DATE, allowNull: true, defaultValue: null }
  }, {
    tableName: 'hr_analyzer_responses',
    timestamps: false
  });
};
