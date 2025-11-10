//================ Subscription  Model =========================
const mongoose = require('mongoose');

const subscriptionSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    match: [
      /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
      'Please provide a valid email address',
    ],
  },
},
  {
    timestamps: true
  });

const Subscription = mongoose.model('Subscription', subscriptionSchema);

module.exports = Subscription;
