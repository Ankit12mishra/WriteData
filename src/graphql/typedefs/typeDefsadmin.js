const { gql } = require('apollo-server-express');

const adminTypeDefs = gql`
  scalar Upload

type AdminLoginResponse {
  success: Boolean!
  message: String!
  token: String
  user: User
}


  type ImportResponse {
    success: Boolean!
    DataImported: Boolean!
    message: String!
  }

  type Stats {
    userCount: Int
    dataCount: Int
  }

  type EditProfileResponse {
  success: Boolean!
  message: String!
  user: User!
}


type UpdateStatusResponse {
  message: String!
  user: User!
}

type User {
  id: ID!
  first_name: String
  last_name: String
  email: String!
  phone_number: String
  role: String!
  status: String
  image:String
}



type UpdateStatusResponse {
  message: String!
  user: User!
}

type DeleteUserResponse {
  message: String!
  success: Boolean!
}

type User {
  id: ID!
  first_name: String
  last_name: String
  email: String
  status: String
  role: String
}


  type Query {
    getAdmin(id: ID!): User
    getAllUsers: [User!]!
    getStats: Stats!
    getUserById(id: ID!): User!
  }

  type Mutation {
    adminLogin(email: String!, password: String!): AdminLoginResponse!
    importExcel(file: Upload!): ImportResponse!
    editAdminProfile(userId: ID, first_name: String, last_name: String, phone_number: String, email: String, password: String): EditProfileResponse!
    updateUserStatus(userId: ID!, status: String!): UpdateStatusResponse!
    deleteUser(id: ID!): DeleteUserResponse
  }
`;

module.exports = adminTypeDefs;
