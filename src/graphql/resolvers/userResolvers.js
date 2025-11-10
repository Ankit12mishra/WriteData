
//============= resolvers/userResolvers.js=================
const { GraphQLUpload } = require('graphql-upload');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const crypto = require('crypto');
const User = require('../../models/User');
const Data = require('../../models/Data');
const Contact = require('../../models/ContactUs');
const Subscription = require('../../models/Subscription');
const sendEmail = require("../utils/sendEmail");
const allowedFields = require('../component/allowFileds');
const { response } = require('express');
const { processUpload } = require('../component/formatedata');
const fs = require('fs');
const path = require('path');

const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret'; // Use env var for production
// const SERVER_BASE_URL = "http://192.168.1.19:4000"; // Change to your domain in production
// Helper function to get user info from JWT token in request header
function getUserFromToken(req) {
  const authHeader = req.headers.authorization || '';
  if (!authHeader.startsWith('Bearer ')) return null;

  const token = authHeader.split(' ')[1];
  if (!token) return null;

  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (err) {
    console.error('JWT verify failed:', err.message);
    return null;
  }
}

//========= Resolvers =================
const userResolvers = {
  Upload: GraphQLUpload,
  Query: {
    //========== Get current logged in user info =============
    me: async (_, __, context) => {
      const user = getUserFromToken(context.req);
      if (!user) throw new Error('Not authenticated');

      const foundUser = await User.findById(user.id);
      if (!foundUser) throw new Error('User not found');

      return foundUser;
    },

    //============ get all subscriptions ==================
    getSubscriptions: async () => {
      try {
        return await Subscription.find({});
      } catch (error) {
        throw new Error(`Failed to fetch subscriptions: ${error.message}`);
      }
    },

    //============ Query to get all contacts ==================
    getContacts: async () => {
      try {
        return await Contact.find({});
      } catch (error) {
        throw new Error('Failed to fetch contacts.');
      }
    },

    getContactDetails: async (_parent, { id }, context) => {
      // if (!context.user || context.user.role !== 'admin') {
      //   throw new Error('Unauthorized');
      // }
      return await Contact.findById(id);
    },

    getContactsSummary: async (_parent, _args, context) => {
      // if (!context.user || context.user.role !== 'admin') {
      //   throw new Error('Unauthorized');
      // }
      // sirf chhoti info bhej rahe hain
      return await Contact.find({}, 'firstname lastname email');
    },

    // ========== Get user ==================
    getUser: async (_, { id }) => {
      //  console.log("Looking for userId:", id);
      const user = await User.findById(id);

      if (!user) throw new Error("User not found");

      // Add full URL if only relative path is stored
      if (user.image && !user.image.startsWith("http")) {
        const BASE_URL = process.env.BASE_URL || "http://13.48.130.179:6001";
        user.image = `${BASE_URL}${user.image}`;
      }
      return user;
    },


    //============ Filter Data collection based on regex filters on allowed fields ================
    filterData: async (_, { filter }, context) => {
      const user = getUserFromToken(context.req);
      if (!user) throw new Error('Not authenticated');

      try {
        // Validate filter keys
        const invalidKeys = Object.keys(filter || {}).filter(
          (key) => !allowedFields.includes(key)
        );
        if (invalidKeys.length > 0) {
          throw new Error(`Invalid filter keys: ${invalidKeys.join(', ')}`);
        }

        // Build MongoDB regex filters (case-insensitive)
        const mongoFilter = {};
        allowedFields.forEach((field) => {
          const val = filter?.[field];
          if (typeof val === 'string' && val.trim() !== '') {
            const safeRegex = new RegExp(val.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
            mongoFilter[field] = { $regex: safeRegex };
          }
        });

        //  Build dynamic ascending sort order
        const sortOrder = {};
        Object.keys(filter || {}).forEach((key) => {
          if (allowedFields.includes(key)) {
            sortOrder[key] = 1;
          }
        });
        if (Object.keys(sortOrder).length === 0) {
          sortOrder.CodeNAF = 1; // Default sort
        }

        //  Fetch and sort
        const results = await Data.find(mongoFilter)
          .sort({
            Region: 1,
            NomDepartement: 1,
            Categorie: 1,
            CategorieLegale: 1,
            NombreSalarie: 1,
            CodeNAF: 1,
          })
          .lean();

        return {
          getFilteredData: true,
          success: true,
          count: results.length,
          data: results,
        };
      } catch (err) {
        console.error('Filter error:', err);
        return {
          getFilteredData: false,
          success: false,
          error: err.message || 'Server error while filtering data',
        };
      }
    },

    //============ Get unique values for a column to populate dropdown/select input ==========
    getColumnData: async (_, { column }) => {
      if (!allowedFields.includes(column)) {
        throw new Error('Invalid column name');
      }

      // Get distinct values from MongoDB
      const uniqueValues = await Data.distinct(column);

      // Sort ascending for numeric, alphabetic, or alphanumeric values
      uniqueValues.sort((a, b) => {
        return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' });
      });

      return {
        column,
        count: uniqueValues.length,
        data: uniqueValues,
      }
    },

    //================ Search data by multiple filters (exact matches) ===============
    // searchByMultipleFields: async (_, { filters }) => {
    //   const mongoFilter = {};

    //   // Filter keys check
    //   const providedFields = Object.keys(filters).filter(
    //     (f) => allowedFields.includes(f) && filters[f]?.toString().trim() !== ''
    //   );
    //   if (providedFields.length > 1) {
    //     throw new Error('Please provide only one search criterion');
    //   }

    //   providedFields.forEach((field) => {
    //     const valRaw = filters[field].toString().trim();
    //     if (field === 'NombreSalarie') {
    //       if (valRaw === "0") {
    //         mongoFilter[field] = { $regex: '^0\\s*$', $options: 'i' };
    //       } else {
    //         const escaped = valRaw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    //         mongoFilter[field] = { $regex: `^${escaped}$`, $options: 'i' };
    //       }
    //     } else {
    //       const escaped = valRaw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    //       mongoFilter[field] = { $regex: `^${escaped}$`, $options: 'i' };
    //     }
    //   });

    //   const results = await Data.find(mongoFilter)
    //     .sort({
    //       Region: 1,
    //       NomDepartement: 1,
    //       Categorie: 1,
    //       CategorieLegale: 1,
    //       NombreSalarie: 1,
    //       CodeNAF: 1,
    //     })
    //     .lean();

    //   return results || [];
    // }

    // searchByMultipleFields: async (_, { filters }) => {
    //   try {
    //     const mongoFilter = {};

    //     // Filter keys check
    //     const providedFields = Object.keys(filters)
    //       .filter(f => allowedFields.includes(f) && filters[f]?.toString().trim() !== '');

    //     if (providedFields.length === 0) {
    //       throw new Error('Please provide at least one search criterion');
    //     }

    //     // Build MongoDB filter
    //     providedFields.forEach(field => {
    //       const valRaw = filters[field].toString().trim();
    //       const escaped = valRaw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    //       if (field === 'NombreSalarie') {
    //         if (valRaw === '0') {
    //           mongoFilter[field] = { $regex: '^0\\s*$', $options: 'i' };
    //         } else {
    //           mongoFilter[field] = { $regex: `^${escaped}$`, $options: 'i' };
    //         }
    //       } else {
    //         mongoFilter[field] = { $regex: `^${escaped}$`, $options: 'i' };
    //       }
    //     });

    //     // Perform DB query
    //     const results = await Data.find(mongoFilter)
    //       .sort({
    //         Region: 1,
    //         NomDepartement: 1,
    //         Categorie: 1,
    //         CategorieLegale: 1,
    //         NombreSalarie: 1,
    //         CodeNAF: 1,
    //       })
    //       .lean();

    //     return results || [];
    //   } catch (error) {
    //     console.error('Error in searchByMultipleFields:', error);
    //     throw new Error(`Failed to fetch data: ${error.message}`);
    //   }
    // }

    searchByMultipleFields: async (_, { filters }) => {
      try {
        const mongoFilter = {};
        const providedFields = Object.keys(filters)
          .filter(f => allowedFields.includes(f) && filters[f]?.toString().trim() !== '');

        if (providedFields.length === 0) {
          throw new Error('Please provide at least one search criterion');
        }

        const nombreSalarieRaw = filters.NombreSalarie?.toString().trim();

        // providedFields.forEach(field => {
        //   const valRaw = filters[field].toString().trim();

        //   if (field === 'NombreSalarie') {
        //     if (valRaw.includes('ou')) {
        //       // Trim user input
        //       const userInput = valRaw.trim();
        //       // Escape special regex chars
        //       const escaped = userInput.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        //       // Match the exact string ignoring extra spaces
        //       mongoFilter[field] = { $regex: `^\\s*${escaped}\\s*$`, $options: 'i' };
        //     } else {
        //       const escaped = valRaw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        //       mongoFilter[field] = { $regex: `^\\s*${escaped}\\s*$`, $options: 'i' };
        //     }
        //   }

        // });

        providedFields.forEach(field => {
          const valRaw = filters[field].toString().trim();
          const escaped = valRaw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

          if (field === 'NombreSalarie') {
            mongoFilter[field] = { $regex: `^\\s*${escaped}\\s*$`, $options: 'i' };
          } else {
            mongoFilter[field] = { $regex: `^\\s*${escaped}\\s*$`, $options: 'i' };
          }
        });

        const results = await Data.find(mongoFilter)
          .sort({
            Region: 1,
            NomDepartement: 1,
            Categorie: 1,
            CategorieLegale: 1,
            NombreSalarie: 1,
            CodeNAF: 1
          })
          .lean();

        return results.map(r => {
          const trimmed = {};
          Object.keys(r).forEach(k => {
            trimmed[k] = typeof r[k] === 'string' ? r[k].trim() : r[k];
          });

          // Override NombreSalarie if user searched "1 ou 2"
          if (nombreSalarieRaw?.includes('ou') && r.NombreSalarie) {
            trimmed.NombreSalarie = nombreSalarieRaw;
          }

          return trimmed;
        });

      } catch (error) {
        console.error('Error in searchByMultipleFields:', error);
        throw new Error(`Failed to fetch data: ${error.message}`);
      }
    },
  },


  Mutation: {
    //================ Subscribe users ======================
    subscribe: async (_parent, { input }) => {
      const { email } = input;

      try {
        const existing = await Subscription.findOne({ email });
        if (existing) {
          return {
            success: false,
            message: 'You are already subscribed.',
          };
        }

        const newSubscription = new Subscription({ email });
        await newSubscription.save();

        return {
          success: true,
          message: 'Successfully subscribed!',
        };
      } catch (err) {
        throw new Error(`Subscription failed: ${err.message}`);
      }
    },

    //=============Unsubscribe by Admin =====================
    unsubscribe: async (_parent, { email }, context) => {
      // if (!context.user || context.user.role !== 'admin') {
      //   throw new Error('Unauthorized: Only admins can delete subscriptions.');
      // }

      try {
        const result = await Subscription.findOneAndDelete({ email });

        if (!result) {
          return {
            success: false,
            message: 'Subscription not found.',
          };
        }

        return {
          success: true,
          message: 'Subscription deleted successfully.',
        };
      } catch (err) {
        throw new Error(`Unsubscribe failed: ${err.message}`);
      }
    },

    //================= Contact User ==================== 
    addContact: async (_parent, { input }) => {
      try {
        // const {
        //   firstname,
        //   lastname,
        //   company_name,
        //   email,
        //   address,
        //   cp,
        //   city,
        //   phone,
        //   website,
        //   object,
        //   message,
        // } = input;

        // Allowed fields for validation
        const allowedFields = [
          "firstname",
          "lastname",
          "email",
          "address",
          "cp",
          "city",
          "phone",
          "company_name",
          "website",
          "object",
          "message",
        ];

        // Validation regex
        const nameRegex = /^[A-Za-z\s-]+$/;
        const emailRegex = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
        const phoneRegex = /^\d{10}$/; // exactly 10 digits only

        const validatedData = {};

        // Validate each allowed field
        allowedFields.forEach((field) => {
          if (input[field] !== undefined) {
            const value = input[field];

            if ((field === "firstname" || field === "lastname") && !nameRegex.test(value)) {
              throw new Error(`${field} must contain only letters, spaces, or hyphens`);
            }

            if (field === "email" && !emailRegex.test(value)) {
              throw new Error("Invalid email address");
            }

            if (field === "phone" && !phoneRegex.test(value)) {
              throw new Error("Phone number must contain exactly 10 digits and only numbers");
            }

            validatedData[field] = value;
          }
        });

        // ✅ No duplicate check — user can contact multiple times with same email
        const newContact = new Contact(validatedData);
        await newContact.save();

        return newContact;
      } catch (err) {
        throw new Error(`Error while adding contact: ${err.message}`);
      }
    },



    //================== delete cantact us =====================
    deleteContact: async (_parent, { id }, context) => {
      // Admin check
      // if (!context.user || context.user.role !== 'admin') {
      //   throw new Error('Unauthorized: Only admins can delete contacts.');
      // }

      const deleted = await Contact.findByIdAndDelete(id);
      if (!deleted) {
        return {
          success: false,
          message: 'Contact not found.',
        };
      }

      return {
        success: true,
        message: 'Contact deleted successfully.',
      };
    },

    //============ User Register ===================
    register: async (_, { input }) => {
      const {
        first_name,
        last_name,
        gender,
        address,
        type,
        code_postal,
        city,
        email,
        password,
        confirm_Password,
        phone_number,
        image,
      } = input;

      const validatePassword = (password) => {
        if (!password || password.length < 8) return 'Password must be at least 8 characters long.';
        if (password.length > 15) return 'Password must be at most 15 characters long.';
        if (!/[A-Z]/.test(password)) return 'Password must contain at least one uppercase letter.';
        if (!/[a-z]/.test(password)) return 'Password must contain at least one lowercase letter.';
        if (!/[0-9]/.test(password)) return 'Password must contain at least one number.';
        if (!/[^A-Za-z0-9]/.test(password)) return 'Password must contain at least one special character.';
        return null;
      };

      try {
        // Validate password
        const passwordError = validatePassword(password);
        if (passwordError) throw new Error(passwordError);

        // Confirm password match
        if (password !== confirm_Password) throw new Error('Passwords do not match.');

        // Check if user already exists
        const existingUser = await User.findOne({ email });
        if (existingUser) throw new Error('User already exists, please login.');

        // Hash password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Create new user without storing confirm_Password
        const newUser = new User({
          first_name,
          last_name,
          gender,
          address,
          type,
          code_postal,
          city,
          email,
          password: hashedPassword,
          phone_number,
          image: image || null,
        });

        await newUser.save();

        // Send welcome email
        const subject = "Welcome to WriteData 🎉";
        const html = `
          <h2>Hello ${first_name} ${last_name},</h2>
          <p>You have successfully registered with <b>WriteData</b>.</p>
        `;
        await sendEmail(email, subject, html);

        // Return AuthPayload: token + user
        return {
          user: newUser,
        };

      } catch (err) {
        throw new Error(err.message);
      }
    },

    // =========== User Login ===================== 
    login: async (_, { email, password }) => {
      try {
        const user = await User.findOne({ email });
        if (!user) {
          throw new Error('User not found');
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
          throw new Error('Invalid credentials');
        }

        const token = jwt.sign({ id: user._id }, JWT_SECRET, { expiresIn: '7d' });

        return {
          token,
          user,
        };
      } catch (err) {
        throw new Error(err.message);
      }
    },

    //====================== Change password for logged in user ======================
    changePassword: async (_, { oldPassword, newPassword, confirmPassword }, context) => {
      try {
        const user = getUserFromToken(context.req);
        if (!user) throw new Error('Not authenticated');

        const dbUser = await User.findById(user.id);
        if (!dbUser) throw new Error('User not found');

        const valid = await bcrypt.compare(oldPassword, dbUser.password);
        if (!valid) throw new Error('Old password is incorrect');

        if (newPassword !== confirmPassword) throw new Error('New password and confirm password do not match');

        dbUser.password = await bcrypt.hash(newPassword, 10);
        await dbUser.save();

        return { message: 'Password changed successfully' };
      } catch (error) {
        console.error('Error in changePassword:', error);
        throw new Error(error.message || 'Something went wrong');
      }
    },

    //============ Send password reset link via email =========================
    forgotPassword: async (_, { email }) => {
      try {

        const userRecord = await User.findOne({ email });
        if (!userRecord) {
          return {
            message: 'User not found',
            passwordResetLinkSent: false,
          };
        }

        // Generate 6-digit OTP
        // const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const otp = crypto.randomInt(100000, 999999).toString(); // 6-digit OTP
        console.log('OTP:', otp);

        // Set OTP expiration time (e.g., 15 minutes from now)
        const otpExpires = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

        // Store OTP and expiry in user model
        userRecord.resetPasswordOTP = otp;
        userRecord.resetPasswordOTPExpires = otpExpires;
        await userRecord.save();

        // Configure email transporter
        const transporter = nodemailer.createTransport({
          service: 'gmail',
          auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS,
          },
        });

        // Email content
        const mailOptions = {
          from: process.env.EMAIL_USER,
          to: userRecord.email,
          subject: 'Your Password Reset OTP',
          html: `
        <p>Hello ${userRecord.name || ''},</p>
        <p>Your OTP for resetting your password is: <b>${otp}</b></p>
        <p>This OTP is valid for 15 minutes.</p>
        <p>If you didn't request this, please ignore this email.</p>
      `,
        };

        // Send email
        await transporter.sendMail(mailOptions);

        // console.log('NODE_ENV is:', process.env.NODE_ENV);
        const token = jwt.sign(
          { id: userRecord._id, email: userRecord.email },  // correct user record
          process.env.JWT_SECRET,
          { expiresIn: '1h' }
        );

        const response = {
          token,
          message: 'OTP sent to your email',
          passwordResetLinkSent: true,
          otp: otp
        };

        // if (process.env.NODE_ENV !== 'production') {
        //    // sirf development/testing ke liye
        // }
        return response;

      } catch (error) {
        console.error('Error in forgotPassword:', error.message);
        throw new Error('Server error: ' + error.message);
      }
    },

    //=================== verify OTP ===============================
    verifyOtp: async (_, { otp }, context) => {
      try {
        const userData = getUserFromToken(context.req); //  Token extracted from header
        if (!userData) {
          return { success: false, message: 'Invalid or missing token' };
        }

        const user = await User.findById(userData.id);
        if (!user) {
          return { success: false, message: 'User not found' };
        }

        if (
          user.resetPasswordOTP !== otp ||
          new Date() > new Date(user.resetPasswordOTPExpires)
        ) {
          return { success: false, message: 'Invalid or expired OTP' };
        }

        //  Clear OTP fields
        user.resetPasswordOTP = undefined;
        user.resetPasswordOTPExpires = undefined;
        await user.save();

        return { success: true, message: 'OTP verified successfully' };
      } catch (err) {
        console.error('Error in verifyOtp:', err.message);
        return { success: false, message: err.message || 'Internal server error' };
      }
    },

    //=================== Reset Password ======================
    resetPassword: async (_, { email, newPassword, confirmPassword }, context) => {
      try {
        const userData = getUserFromToken(context.req);
        if (!userData) {
          return { success: false, message: 'Invalid or missing token' };
        }

        if (newPassword !== confirmPassword) {
          return { success: false, message: 'Email or Password incorrect' };
        }

        const user = await User.findOne({ _id: userData.id, email }); //  match both id and email
        if (!user) {
          return { success: false, message: 'User not found or email does not match token' };
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);
        user.password = hashedPassword;

        // Optionally clear OTP & expiry
        user.resetPasswordOTP = undefined;
        user.resetPasswordOTPExpires = undefined;

        await user.save();

        return { success: true, message: 'Password reset successful' };
      } catch (err) {
        console.error('Error in resetPassword:', err.message);
        return { success: false, message: err.message };
      }
    },

    //============ Update user profile info ====================
    updateProfile: async (_, { userId, input }) => {
      try {
        const updateData = {};
        const allowedFields = [
          "first_name",
          "last_name",
          "gender",
          "type",
          "address",
          "code_postal",
          "city",
          "email",
          "phone_number",
        ];

        // Validation regex
        const nameRegex = /^[A-Za-z\s-]+$/;
        const emailRegex = /^\S+@\S+\.\S+$/;
        const phoneRegex = /^\d{10}$/; // exactly 10 digits only

        // Copy and validate fields from input
        allowedFields.forEach((field) => {
          if (input[field] !== undefined) {
            // Validate first_name and last_name
            if ((field === "first_name") && !nameRegex.test(input[field])) {
              throw new Error(`${field} must contain only letters, spaces, or hyphens`);
            }
            // Validate email
            if (field === "email" && !emailRegex.test(input[field])) {
              throw new Error("Invalid email address");
            }
            // Validate phone_number
            if (field === "phone_number" && !phoneRegex.test(input[field])) {
              throw new Error("Phone number must contain exactly 10 digits and only numbers");
            }

            // Save validated field
            updateData[field] = input[field];
          }
        });

        // Handle image upload if present
        if (input.image) {
          const upload = await input.image;
          if (!upload || typeof upload.createReadStream !== "function") {
            throw new Error("File upload failed: createReadStream not available");
          }
          const { createReadStream, filename } = upload;
          const stream = createReadStream();

          const path = require("path");
          const fs = require("fs");
          const uploadDir = path.join(__dirname, "../../../upload");
          if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

          const filePath = path.join(uploadDir, filename);
          const out = fs.createWriteStream(filePath);
          stream.pipe(out);
          await new Promise((resolve, reject) => {
            out.on("finish", resolve);
            out.on("error", reject);
          });

          const BASE_URL = process.env.BASE_URL || "http://13.48.130.179:6001";
          updateData.image = `${BASE_URL}/upload/${filename}`;
        }

        // Check if user exists
        const user = await User.findById(userId);
        if (!user) throw new Error("User not found");

        // Update user document
        const updatedUser = await User.findByIdAndUpdate(
          userId,
          { $set: updateData },
          { new: true }
        );

        return updatedUser;
      } catch (err) {
        throw new Error("Profile update failed: " + err.message);
      }
    },


  }
};

module.exports = userResolvers







