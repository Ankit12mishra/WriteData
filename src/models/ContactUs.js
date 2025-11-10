//================== Contact Model ====================
const mongoose = require('mongoose');

const contactSchema = new mongoose.Schema({
    firstname: { type: String, required: true, trim: true, match: [/^[A-Za-z]+$/, 'First name must contain only letters'] },
    lastname: { type: String, trim: true, match: [/^[A-Za-z]+$/, 'Last name must contain only letters'] },
    company_name: { type: String, required: true },
    email: { type: String, required: true },
    address: { type: String, required: true },
    cp: { type: String, required: true },
    city: { type: String, required: true },
    phone: { type: String, required: true },
    website: { type: String },
    object: { type: String, required: true },
    message: { type: String, required: true },
},
    {
        timestamps: true
    });

const Contact = mongoose.model('Contact', contactSchema);

module.exports = Contact;
