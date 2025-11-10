const mongoose = require('mongoose');

const connectDB = async (DATABASE_URL) => {
  try {
    const DB_OPTIONS = {
      dbName: 'write-data2',
    };
    await mongoose.connect(DATABASE_URL, DB_OPTIONS);
    console.log('MongoDB connected successfully');
  } catch (error) {
    console.error('MongoDB connection failed:', error.message);
  }
};

module.exports = connectDB;