// src/utils/formatData.js

 // Using a regular function
function formatSheetData(sheetData) {
  return sheetData.map(item => ({
    siret: item.siret,
    dateCreationEtablissement: new Date(item.dateCreationEtablissement),
    denominationUniteLegale: item['denominationUniteLegale'],
    Dirigeants: item.Dirigeants ? item.Dirigeants.split(';').map(d => d.trim()) : [],
    Email: item.Email ? item.Email.split(';').map(e => e.trim()) : [],
    Téléphone: item.Téléphone,
    adresse: item.adresse,
    CodeNAF: item['Code NAF'],
    Categorie:item['Categorie'],
    CategorieLegale: item['Categorie Legale'],
    NombreSalarie: item['Nombre Salarié'],
    CodeQPV: item['Code QPV'],
    NumeroDepartement: item['Numéro Département'],
    NomDepartement: item['Nom Département'],
    Region: item.Région
  }));
}

module.exports = formatSheetData;
