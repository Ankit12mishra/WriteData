// resolvers/adminResolvers.js

const { GraphQLUpload } = require('graphql-upload');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');
const User = require('../../models/User');
const Data = require('../../models/Data');
const formatSheetData = require('../component/formatedata');

//======== Utility: Extract admin info from token =============
function getAdminFromToken(req) {
  const authHeader = req.headers.authorization || '';
  if (!authHeader.startsWith('Bearer ')) return null;

  const token = authHeader.split(' ')[1];
  if (!token) return null;

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    return {
      userId: decoded.userId || decoded.id || decoded._id,
      role: decoded.role,
    };
  } catch (err) {
    console.error('JWT verify failed:', err.message);
    return null;
  }
}

//============= Admin resolver ====================
const adminResolvers = {
  Upload: GraphQLUpload, // Scalar upload type

  Query: {
    //=============  Get user and admin stats (only for admin) ================
    getStats: async (_, __, context) => {
      const user = getAdminFromToken(context.req);
      if (!user || user.role !== 'admin') throw new Error('Access denied');

      try {
        const userCount = await User.countDocuments({ role: "user" });
        const dataCount = await Data.countDocuments();
        return { userCount, dataCount };
      } catch (error) {
        console.error('Stats Error:', error);
        throw new Error('Server error while fetching stats');
      }
    },

    //================ Get Admin ======================
    getAdmin: async (_, { id }) => {
      const user = await User.findById(id);

      if (!user) throw new Error("User not found");

      // Add full URL if only relative path is stored
      if (user.image && !user.image.startsWith("http")) {
        const BASE_URL = process.env.BASE_URL || "http://13.48.130.179:6001";
        user.image = `${BASE_URL}${user.image}`;
      }
      const obj = user.toObject();
      return {
        ...obj,
        id: obj._id.toString(),  // map _id to id
      };
    },

    //=============  Get all users (only accessible by admin) ======================
    getAllUsers: async (_, __, context) => {
      const admin = getAdminFromToken(context.req);
      if (!admin || admin.role !== 'admin') throw new Error('Access denied');

      try {
        const users = await User.find({ role: 'user' }).select('-password');

        const safeUsers = users.map(user => {
          const obj = user.toObject();
          return {
            ...obj,
            id: obj._id.toString(),   // map _id to id as string
            first_name: obj.first_name || '',
            last_name: obj.last_name || '',
          };
        });

        return safeUsers;
      } catch (error) {
        console.error('Get Users Error:', error);
        throw new Error('Internal server error');
      }
    },

    getUserById: async (_, { id }, context) => {
      const admin = getAdminFromToken(context.req);
      if (!admin || admin.role !== 'admin') throw new Error('Access denied');

      const user = await User.findById(id).select('-password');
      if (!user) throw new Error('User not found');

      const obj = user.toObject();
      return {
        ...obj,
        id: obj._id.toString(),
        first_name: obj.first_name || '',
        last_name: obj.last_name || '',
      };
    },


  },


  Mutation: {
    //============= Update User status ======================
    updateUserStatus: async (_, { userId, status }, context) => {
      const admin = getAdminFromToken(context.req);
      if (!admin || admin.role !== 'admin') throw new Error('Access denied');

      if (!['active', 'inactive'].includes(status)) {
        throw new Error('Invalid status value');
      }
      try {
        const user = await User.findById(userId);
        if (!user) throw new Error('User not found');

        user.status = status;
        await user.save();

        return {
          message: `User status updated to ${status}`,
          user,
        };
      } catch (error) {
        console.error('Update Status Error:', error);
        throw new Error(error.message || 'Internal server error');
      }

    },

    deleteUser: async (_, { id }, context) => {
      const admin = getAdminFromToken(context.req);
      if (!admin || admin.role !== 'admin') throw new Error('Access denied');

      try {
        const user = await User.findById(id);
        if (!user) throw new Error('User not found');

        await User.findByIdAndDelete(id);

        return {
          message: `User ${user.name || user.email || id} deleted successfully `,
          success: true,
        };
      } catch (error) {
        throw new Error('User already deleted ' + error.message);
      }
    },


    //============== Admin login with JWT token ==================
    adminLogin: async (_, { email, password }) => {
      const user = await User.findOne({ email });
      if (!user) throw new Error('User not found');

      const isPasswordCorrect = await bcrypt.compare(password, user.password);
      if (!isPasswordCorrect) throw new Error('Invalid credentials');

      //  Check for admin role
      if (user.role !== 'admin') {
        throw new Error('Access denied: Not an admin user');
      }

      const token = jwt.sign(
        { id: user._id, email: user.email, role: user.role },
        process.env.JWT_SECRET,
        { expiresIn: '3d' }
      );

      return {
        success: true,
        message: 'Login successful',
        token,
        user: {
          id: user._id,
          first_name: user.first_name,
          last_name: user.last_name,
          phone_number: user.phone_number,
          email: user.email,
          role: user.role,
        },
      };
    },

    //================ Admin import datasample sheet =====================
    importExcel: async (_, { file }, context) => {
      const user = getAdminFromToken(context.req);
      if (!user || user.role !== 'admin') throw new Error('Access denied');

      try {
        const { createReadStream, filename } = await file;
        const stream = createReadStream();

        const uploadsDir = path.join(__dirname, '../../../uploads');
        if (!fs.existsSync(uploadsDir)) {
          fs.mkdirSync(uploadsDir, { recursive: true });
        }

        const safeFilename = path.basename(filename);
        const filePath = path.join(uploadsDir, safeFilename);

        const out = fs.createWriteStream(filePath);
        stream.pipe(out);

        await new Promise((resolve, reject) => {
          out.on('finish', resolve);
          out.on('error', reject);
        });

        //  Read Excel file (force text mode so letters don’t get dropped)
        const workbook = XLSX.readFile(filePath, { cellText: true, cellDates: true });
        const sheetName = workbook.SheetNames[0];

        //  Treat all values as text to preserve alphanumeric codes
        const sheetData = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], {
          defval: null,
          raw: false, // converts everything to visible (formatted) text
        });

        //  Make sure codenaf (or similar) stays as a string
        const formattedData = formatSheetData(sheetData).map(row => ({
          ...row,
          codenaf: row.codenaf ? String(row.codenaf).trim() : null,
        }));

        //  Delete all existing data from the collection
        await Data.deleteMany({});

        //  Insert new data (only valid rows)
        const validRows = formattedData.filter(row => row.siret);
        let insertResult = {};
        if (validRows.length > 0) {
          insertResult = await Data.insertMany(validRows);
        }

        //  Cleanup uploaded file
        fs.unlinkSync(filePath);

        return {
          success: true,
          DataImported: true,
          message: `Excel imported successfully! ${validRows.length} new records inserted.`,
        };
      } catch (err) {
        console.error('Import Error:', err);
        throw new Error('Import Error: ' + err.message);
      }
    },

    //============  Admin can update their own or user's profile =============
    editAdminProfile: async (_, { userId, input }, context) => {
      const adminUser = getAdminFromToken(context.req);
      if (!adminUser || adminUser.role !== 'admin')
        return { success: false, message: "Access denied" };

      try {
        const user = await User.findById(userId);
        if (!user)
          return { success: false, message: "User not found" };

        // Regex validations
        const nameRegex = /^[A-Za-z\s-]+$/;
        const emailRegex = /^\S+@\S+\.\S+$/;
        const phoneRegex = /^\d{10}$/; // exactly 10 digits only

        if (input.first_name && !nameRegex.test(input.first_name)) {
          return { success: false, message: "first_name must contain only letters, spaces, or hyphens" };
        }
        // if (input.last_name && !nameRegex.test(input.last_name)) {
        //   return { success: false, message: "last_name must contain only letters, spaces, or hyphens" };
        // }
        if (input.email && !emailRegex.test(input.email)) {
          return { success: false, message: "Invalid email address" };
        }
        if (input.phone_number && !phoneRegex.test(input.phone_number)) {
          return { success: false, message: "Phone number must contain exactly 10 digits and only numbers" };
        }

        let updateData = {
          first_name: input.first_name || user.first_name,
          last_name: input.last_name || user.last_name,
          address: input.address || user.address,
          gender: input.gender || user.gender,
          email: input.email || user.email,
          phone_number: input.phone_number || user.phone_number,
          image: user.image, // keep existing image
        };

        const path = require('path');
        const fs = require('fs');
        const uploadDir = path.join(__dirname, "../../../upload");
        if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

        if (input.image) {
          // Delete old image
          if (user.image) {
            const oldFilename = path.basename(user.image);
            const oldFilePath = path.join(uploadDir, oldFilename);
            if (fs.existsSync(oldFilePath)) fs.unlinkSync(oldFilePath);
          }

          const upload = await input.image;
          const { createReadStream, filename } = upload;
          const safeFilename = filename.replace(/\s+/g, "_").replace(/[()]/g, "");
          const uniqueFilename = `${Date.now()}-${safeFilename}`;

          // const uniqueFilename = `${Date.now()}-${filename}`;
          const filePath = path.join(uploadDir, uniqueFilename);

          const stream = createReadStream();
          const out = fs.createWriteStream(filePath);
          stream.pipe(out);

          await new Promise((resolve, reject) => {
            out.on("finish", resolve);
            out.on("error", reject);
          });

          const BASE_URL = process.env.BASE_URL || "http://13.48.130.179:6001";
          updateData.image = `${BASE_URL}/upload/${uniqueFilename}`;
        }

        const updatedUser = await User.findByIdAndUpdate(
          userId,
          { $set: updateData },
          { new: true }
        );

        return {
          success: true,
          message: "Profile updated successfully",
          user: updatedUser
        };
      } catch (err) {
        return { success: false, message: "Profile update failed: " + err.message };
      }
    }



    // editAdminProfile: async (_, { userId, input }, context) => {
    //   const adminUser = getAdminFromToken(context.req);
    //   if (!adminUser || adminUser.role !== 'admin')
    //     return { success: false, message: "Access denied" };

    //   try {
    //     const user = await User.findById(userId);
    //     if (!user)
    //       return { success: false, message: "User not found" };

    //     // Regex validations
    //     const nameRegex = /^[A-Za-z\s-]+$/;
    //     const emailRegex = /^\S+@\S+\.\S+$/;
    //     const phoneRegex = /^\d{10}$/; // exactly 10 digits only

    //     if (input.first_name && !nameRegex.test(input.first_name)) {
    //       return { success: false, message: "first_name must contain only letters, spaces, or hyphens" };
    //     }
    //     if (input.email && !emailRegex.test(input.email)) {
    //       return { success: false, message: "Invalid email address" };
    //     }
    //     if (input.phone_number && !phoneRegex.test(input.phone_number)) {
    //       return { success: false, message: "Phone number must contain exactly 10 digits and only numbers" };
    //     }

    //     const path = require('path');
    //     const fs = require('fs');

    //     // Make sure the upload/profile_images folder exists
    //     const uploadDir = path.join(__dirname, "../../../upload/profile_images");
    //     if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

    //     let updateData = {
    //       first_name: input.first_name || user.first_name,
    //       last_name: input.last_name || user.last_name,
    //       address: input.address || user.address,
    //       gender: input.gender || user.gender,
    //       email: input.email || user.email,
    //       phone_number: input.phone_number || user.phone_number,
    //       image: user.image, // default to existing image
    //     };

    //     // Handle image upload (same as your REST logic)
    //     if (input.image) {
    //       const upload = await input.image;
    //       const { createReadStream, filename } = upload;
    //       const uniqueFilename = `${Date.now()}-${filename}`;
    //       const filePath = path.join(uploadDir, uniqueFilename);

    //       // Delete old image if exists
    //       if (user.image) {
    //         const oldFilename = user.image.split("/").pop();
    //         const oldFilePath = path.join(uploadDir, oldFilename);
    //         if (fs.existsSync(oldFilePath)) fs.unlinkSync(oldFilePath);
    //       }

    //       // Save new image to upload/profile_images
    //       const stream = createReadStream();
    //       const out = fs.createWriteStream(filePath);
    //       stream.pipe(out);
    //       await new Promise((resolve, reject) => {
    //         out.on("finish", resolve);
    //         out.on("error", reject);
    //       });

    //       const BASE_URL = process.env.BASE_URL || "http://192.168.1.19:5000";
    //       updateData.image = `${BASE_URL}/upload/profile_images/${uniqueFilename}`;
    //     }

    //     // Apply updates
    //     const updatedUser = await User.findByIdAndUpdate(
    //       userId,
    //       { $set: updateData },
    //       { new: true }
    //     );

    //     return {
    //       success: true,
    //       message: "Profile updated successfully",
    //       user: updatedUser,
    //     };
    //   } catch (err) {
    //     console.error("Profile update failed:", err);
    //     return { success: false, message: "Profile update failed: " + err.message };
    //   }
    // },


    //     editAdminProfile: async (_, { userId, input }, context) => {
    //   const adminUser = getAdminFromToken(context.req);
    //   if (!adminUser || adminUser.role !== 'admin')
    //     return { success: false, message: "Access denied" };

    //   try {
    //     const user = await User.findById(userId);
    //     if (!user)
    //       return { success: false, message: "User not found" };

    //     // ===== Validation =====
    //     const nameRegex = /^[A-Za-z\s-]+$/;
    //     const emailRegex = /^\S+@\S+\.\S+$/;
    //     const phoneRegex = /^\d{10}$/;

    //     if (input.first_name && !nameRegex.test(input.first_name))
    //       return { success: false, message: "first_name must contain only letters, spaces, or hyphens" };

    //     if (input.email && !emailRegex.test(input.email))
    //       return { success: false, message: "Invalid email address" };

    //     if (input.phone_number && !phoneRegex.test(input.phone_number))
    //       return { success: false, message: "Phone number must contain exactly 10 digits and only numbers" };

    //     const path = require('path');
    //     const fs = require('fs');

    //     // ===== Upload folder =====
    //     const uploadDir = path.join(__dirname, "../../../upload");
    //     if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

    //     // ===== Update data =====
    //     let updateData = {
    //       first_name: input.first_name || user.first_name,
    //       last_name: input.last_name || user.last_name,
    //       address: input.address || user.address,
    //       gender: input.gender || user.gender,
    //       email: input.email || user.email,
    //       phone_number: input.phone_number || user.phone_number,
    //       image: user.image, // default to old image
    //     };

    //     // ===== Handle image upload =====
    //     if (input.image) {
    //       const upload = await input.image;
    //       const { createReadStream, filename } = upload;
    //       const uniqueFilename = `${Date.now()}-${filename}`;
    //       const filePath = path.join(uploadDir, uniqueFilename);

    //       // Delete old image if exists
    //       if (user.image) {
    //         const oldFilename = user.image.split("/").pop();
    //         const oldFilePath = path.join(uploadDir, oldFilename);
    //         if (fs.existsSync(oldFilePath)) fs.unlinkSync(oldFilePath);
    //       }

    //       // Save new image to /upload
    //       const stream = createReadStream();
    //       const out = fs.createWriteStream(filePath);
    //       stream.pipe(out);
    //       await new Promise((resolve, reject) => {
    //         out.on("finish", resolve);
    //         out.on("error", reject);
    //       });

    //       // ===== Fixed BASE URL =====
    //       const BASE_URL = "http://192.168.1.2:4000";
    //       updateData.image = `${BASE_URL}/upload/${uniqueFilename}`;
    //     }

    //     // ===== Update user =====
    //     const updatedUser = await User.findByIdAndUpdate(
    //       userId,
    //       { $set: updateData },
    //       { new: true }
    //     );

    //     return {
    //       success: true,
    //       message: "Profile updated successfully",
    //       user: updatedUser,
    //     };

    //   } catch (err) {
    //     console.error("Profile update failed:", err);
    //     return { success: false, message: "Profile update failed: " + err.message };
    //   }
    // }


  }
};


module.exports = adminResolvers;

//==============  Admin imports Excel data into DB (skips duplicates by `siret`) ======================

// importExcel: async (_, { file }, context) => {
//   const user = getAdminFromToken(context.req);
//   if (!user || user.role !== 'admin') throw new Error('Access denied');

//   try {
//     const { createReadStream, filename } = await file;
//     const stream = createReadStream();

//     const uploadsDir = path.join(__dirname, '../../../uploads');
//     if (!fs.existsSync(uploadsDir)) {
//       fs.mkdirSync(uploadsDir, { recursive: true });
//     }

//     const safeFilename = path.basename(filename);
//     const filePath = path.join(uploadsDir, safeFilename);

//     const out = fs.createWriteStream(filePath);
//     stream.pipe(out);

//     await new Promise((resolve, reject) => {
//       out.on('finish', resolve);
//       out.on('error', reject);
//     });

//     // console.log(` File saved to: ${filePath}`);

//     // Read and format Excel data
//     const workbook = XLSX.readFile(filePath);
//     const sheetName = workbook.SheetNames[0];
//     const sheetData = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: null });

//     const formattedData = formatSheetData(sheetData);

//     // Filter duplicates by 'siret'
//     const dataToInsert = [];
//     for (const row of formattedData) {
//       if (!row.siret) continue;
//       const exists = await Data.findOne({ siret: row.siret });
//       if (!exists) {
//         dataToInsert.push(row);
//       }
//     }

//     if (dataToInsert.length > 0) {
//       await Data.insertMany(dataToInsert);
//     }

//     // Remove file after import
//     // fs.unlinkSync(filePath);

//     return {
//       success: true,
//       DataImported: true,
//       message: `Excel imported successfully! ${dataToInsert.length} new records added.`,
//     };
//   } catch (err) {
//     console.error(' Import Error:', err);
//     throw new Error('Import Error: ' + err.message);
//   }
// },


// importExcel: async (_, { file }, context) => {
//   const user = getAdminFromToken(context.req);
//   if (!user || user.role !== 'admin') throw new Error('Access denied');

//   try {
//     const { createReadStream, filename } = await file;
//     const stream = createReadStream();

//     const uploadsDir = path.join(__dirname, '../../../uploads');
//     if (!fs.existsSync(uploadsDir)) {
//       fs.mkdirSync(uploadsDir, { recursive: true });
//     }

//     const safeFilename = path.basename(filename);
//     const filePath = path.join(uploadsDir, safeFilename);

//     const out = fs.createWriteStream(filePath);
//     stream.pipe(out);

//     await new Promise((resolve, reject) => {
//       out.on('finish', resolve);
//       out.on('error', reject);
//     });

//     const workbook = XLSX.readFile(filePath);
//     const sheetName = workbook.SheetNames[0];
//     const sheetData = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: null });

//     const formattedData = formatSheetData(sheetData);

//     // Prepare bulk operations for upsert
//     const bulkOps = formattedData
//       .filter(row => row.siret)
//       .map(row => ({
//         updateOne: {
//           filter: { siret: row.siret },
//           update: { $set: row },
//           upsert: true
//         }
//       }));

//     if (bulkOps.length > 0) {
//       await Data.bulkWrite(bulkOps);
//     }

//     // Clean up
//     fs.unlinkSync(filePath);

//     return {
//       success: true,
//       DataImported: true,
//       message: `Excel imported successfully! ${bulkOps.length} records processed (inserted or updated).`,
//     };
//   } catch (err) {
//     console.error('Import Error:', err);
//     throw new Error('Import Error: ' + err.message);
//   }
// }, 


