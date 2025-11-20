// const { DataTypes } = require('sequelize');

// module.exports = (sequelize) => {
//   return sequelize.define('SectionScoreCache', {
//     id: {
//       type: DataTypes.BIGINT.UNSIGNED,
//       autoIncrement: true,
//       primaryKey: true
//     },
//     response_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
//     section_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
//     total_score: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
//     recommendation : { type: DataTypes.TEXT, allowNull: true ,defaultValue: ''},
//     gap : { type: DataTypes.TEXT, allowNull: true ,defaultValue: ''},
//     strength : { type: DataTypes.TEXT, allowNull: true ,defaultValue: ''},
//     questions_answered: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
//     last_calculated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
//     graph_type : { type: DataTypes.STRING(100), allowNull: true }
//   }, {
//     tableName: 'hr_analyzer_section_scores_cache',
//     timestamps: false,
//     indexes: [
//       {
//         unique: true,
//         fields: ['response_id', 'section_id']
//       }
//     ]
//   });
// };



const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  return sequelize.define('SectionScoreCache', {
    id: {
      type: DataTypes.BIGINT.UNSIGNED,
      autoIncrement: true,
      primaryKey: true
    },
    response_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
    section_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
    total_score: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    recommendation: { type: DataTypes.TEXT, allowNull: true, defaultValue: '' },
    gap: { type: DataTypes.TEXT, allowNull: true, defaultValue: '' },
    strength: { type: DataTypes.TEXT, allowNull: true, defaultValue: '' },
    questions_answered: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    last_calculated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    graph_type: { type: DataTypes.STRING(100), allowNull: true },

    recommendedNextSteps_immediate: { type: DataTypes.TEXT, allowNull: true, defaultValue: '' },
    recommendedNextSteps_shortTerm: { type: DataTypes.TEXT, allowNull: true, defaultValue: '' },
    recommendedNextSteps_longTerm: { type: DataTypes.TEXT, allowNull: true, defaultValue: '' },
    frontPage_Image: { type: DataTypes.STRING(255), allowNull: true },
    backPage_Image: { type: DataTypes.STRING(255), allowNull: true },

  }, {
    tableName: 'hr_analyzer_section_scores_cache',
    timestamps: false,
    underscored: false,
    indexes: [
      {
        unique: true,
        fields: ['response_id', 'section_id']
      }
    ]
  });
};
