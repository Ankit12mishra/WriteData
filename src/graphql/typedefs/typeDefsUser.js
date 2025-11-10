// schema/typeDefs.js
const { gql } = require('apollo-server-express');

const userTypeDefs = gql`

  scalar Upload

  type User {
    _id: ID!
    first_name: String!
    last_name: String!
    gender: String
    address: String
    type: String!
    code_postal: String!
    city: String!
    email: String!
    phone_number: String
    image: String
  }

  type AuthPayload {
    token: String!
    user: User!
  }

  type SuccessMessage {
    success: Boolean
    message: String!
    passwordResetLinkSent: Boolean
    token: String
    otp: String
  }

  input UpdateProfileInput {
    first_name: String
    last_name: String
    gender: String
    type: String
    address: String
    code_postal: String
    city: String
    email: String
    phone_number: String
    image: Upload
  }

 input RegisterInput {
  first_name: String!
  last_name: String!
  gender: String
  address: String
  type: String
  code_postal: String
  city: String
  email: String!
  password: String!
  confirm_Password: String!
  phone_number: String
  image: String
}


  type FilterDataResponse {
    getFilteredData: Boolean
    success: Boolean!
    count: Int
    data: [DataType]
    error: String
  }

  type DataType {
    _id: ID
    siret: String
    dateCreationEtablissement: String
    denominationUniteLegale: String
    Dirigeants: [String]
    Email: [String]
    Telephone: String
    adresse: String
    CodeNAF: String
    Categorie: String
    CategorieLegale: String
    NombreSalarie: String
    CodeQPV: String
    NumeroDepartement: String
    NomDepartement: String
    Region: String
  }

  type ColumnResult {
    column: String
    count: Int
    data: [String]
  }

  input FilterInput {
    NombreSalarie: String
    Categorie: String
    Region: String
    NomDepartement: String
    CodeNAF: String
    denominationUniteLegale: String
    CategorieLegale: String
  }

  type Record {
    NombreSalarie: String
    Region: String
    NomDepartement: String
    CodeNAF: String
    CategorieLegale: String
    denominationUniteLegale: String
    Categorie: String
  }

  type ResetPasswordResponse {
    message: String!
    success: Boolean!
  }

type Contact {
  id: ID!
  firstname: String!
  lastname: String!
  company_name: String!
  email: String!
  address: String!
  cp: String!
  city: String!
  phone: String!
  website: String
  object: String!
  message: String!
}

input ContactInput {
  firstname: String!
  lastname: String!
  company_name: String!
  email: String!
  address: String!
  cp: String!
  city: String!
  phone: String!
  website: String
  object: String!
  message: String!
}

# Subscription GraphQL Type
type Subscription {
  id: ID!
  email: String!
  subscribedAt: String!
}

# Success response
type SuccessMessage {
  success: Boolean!
  message: String!
}

input SubscribeInput {
  email: String!
}

type SubscribeResponse {
  success: Boolean!
  message: String!
}

type UnsubscribeResponse {
  success: Boolean!
  message: String!
}

type ContactSummary {
  id: ID!
  firstname: String!
  lastname: String!
  email: String!
}


  type Query {
    getUser(id: ID!): User
    filterData(filter: FilterInput): FilterDataResponse
    getColumnData(column: String!): ColumnResult
    searchByMultipleFields(filters: FilterInput): [Record]
    me: User
    getContacts: [Contact]
    getSubscriptions: [Subscription!]!
    getContactsSummary: [ContactSummary!]! 
    getContactDetails(id: ID!): Contact 
  }

  type Mutation {
    register(input: RegisterInput!): AuthPayload!
    login(email: String!, password: String!): AuthPayload!
    changePassword(oldPassword: String!, newPassword: String!, confirmPassword: String!): SuccessMessage!
    forgotPassword(email: String!): SuccessMessage!
    verifyOtp(otp: String!): SuccessMessage!
    resetPassword(email: String!, newPassword: String!, confirmPassword: String!): SuccessMessage!
    updateProfile(userId: ID!, input: UpdateProfileInput!): User
    addContact(input: ContactInput!): Contact
    deleteContact(id: ID!): SuccessMessage!
    subscribe(input: SubscribeInput!): SubscribeResponse!
    unsubscribe(email: String!): UnsubscribeResponse!

  }
`;

module.exports = userTypeDefs;
