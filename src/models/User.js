//==================== User Model ===================
const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  first_name: {
    type: String,
    required: [true, 'First name is required'],
    minlength: [2, 'First name must be at least 2 characters'],
    maxlength: [30, 'First name must be at most 30 characters'],
    trim: true,
    match: [/^[A-Za-z\s-]+$/, 'Name must contain only letters, spaces, or hyphens']

  },
  last_name: {
    type: String,
    // required: [true, 'Last name is required'],
    // minlength: [2, 'Last name must be at least 2 characters'],
    // maxlength: [30, 'Last name must be at most 30 characters'],
    trim: true,
    match: [/^[A-Za-z\s-]+$/, 'Name must contain only letters, spaces, or hyphens']

  },
  gender: {
    type: String,
    enum: ['male', 'female', 'other'], // you can customize this as needed
    required: false,
    trim: true,
  },
  address: {
    type: String,
    required: false,
    trim: true
  },
  type: {
    type: String,
    required: false,
    trim: true
  },
  code_postal: {
    type: String,
    required: false,
    trim: true,
    match: [/^\d+$/, 'Postal code must contain only numbers']
  },
  city: {
    type: String,
    required: false,
    trim: true,
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/\S+@\S+\.\S+/, 'Invalid email address']
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
  },

  phone_number: {
    type: String,
    required: false,
    trim: true,
    match: [/^[0-9\-+()\s]*$/, 'Invalid phone number'],
    minlength: [10, 'Phone number must be at least 10 digits'],
    maxlength: [10, 'Phone number must be at most 10 digits'],
    match: [/^\d{10}$/, 'Phone number must contain exactly 10 digits']

  },
  image: {
    type: String,
    default: "http://13.48.130.179:6001/upload/images.jpg"
  },

  resetPasswordOTP: {
    type: String,
  },
  resetPasswordOTPExpires: {
    type: Date,
  },
  otpVerified: {
    type: Boolean,
    default: false
  },

  role: {
    type: String,
    enum: ['admin', 'user'],
    default: 'user'
  },
  status: {
    type: String,
    enum: ['active', 'inactive'],
    default: 'active'
  }
}, {
  timestamps: true
});

const User = mongoose.model('User', userSchema);

module.exports = User;
