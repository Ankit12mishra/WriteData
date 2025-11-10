//=============== Data Model ==============================
const mongoose = require('mongoose');

const DataSchema = new mongoose.Schema({
  siret: { type: String, required: true },
  dateCreationEtablissement: { type: Date, required: false },
  denominationUniteLegale: { type: String, required: true },
  Dirigeants: [{ type: String }],
  Email: [{ type: String }],
  Téléphone: { type: String },
  adresse: { type: String, required: false },
  CodeNAF: { type: String },
  CategorieLegale: { type: String },
  Categorie: { type: String },
  NombreSalarie: { type: String },
  CodeQPV: { type: String },
  NumeroDepartement: { type: String },
  NomDepartement: { type: String },
  Region: { type: String },
});

module.exports = mongoose.model('Data', DataSchema);
