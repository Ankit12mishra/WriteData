const cors = require("cors");
const express = require('express');
const { graphqlHTTP } = require('express-graphql');
const { makeExecutableSchema } = require('@graphql-tools/schema');
const { mergeTypeDefs, mergeResolvers } = require('@graphql-tools/merge');
const { ApolloServer } = require('apollo-server-express');
const { graphqlUploadExpress } = require('graphql-upload');
const path = require('path');
const dotenv = require('dotenv');
dotenv.config();
const passport = require('passport');
const connectDB = require('./src/database/db');
const passportConfig = require('./config/passport');
const userTypeDefs = require('./src/graphql/typedefs/typeDefsUser');
const adminTypeDefs = require('./src/graphql/typedefs/typeDefsadmin');
const userResolvers = require('./src/graphql/resolvers/userResolvers');
const adminResolvers = require('./src/graphql/resolvers/adminResolvers');




const mergedTypeDefs = mergeTypeDefs([userTypeDefs, adminTypeDefs]);
const mergedResolvers = mergeResolvers([userResolvers, adminResolvers]);

const app = express();
app.use(graphqlUploadExpress({ maxFileSize: 10000000, maxFiles: 1 }));
passportConfig(passport);
app.use(passport.initialize());
// app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.use(cors());



// Connect to MongoDB
connectDB(process.env.MONGO_URL);


app.use(cors({
  origin: (origin, callback) => {
    // Allow all origins
    callback(null, origin);
  },
  credentials: true
}));


app.use('/upload', express.static(path.join(__dirname, 'upload')));
// GraphQL endpoint
const schema = makeExecutableSchema({
  typeDefs: mergedTypeDefs,
  resolvers: mergedResolvers,
});


const server = new ApolloServer({
  schema,
  context: ({ req }) => {
    return { req }; // <-- IMPORTANT
  }
});



const PORT = process.env.PORT || 4000;

server.start().then(() => {
  server.applyMiddleware({ app });
  app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}/graphql`);
  });
});
