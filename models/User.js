const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
    userId: {
        type: String,
        unique: true,
        required: true
    },
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true
    },
    password: {
        type: String,
        required: true,
        minlength: 6
    },
    role: {
        type: String,
        enum: ['farmer', 'warehouse_manager'],
        required: true
    },
    profile: {
        firstName: { type: String, required: true },
        lastName: { type: String, required: true },
        phone: { type: String, required: true },
        address: {
            street: String,
            city: String,
            state: String,
            pincode: String
        },
        // Farmer specific fields
        farmDetails: {
            farmSize: Number, // in acres
            primaryCrops: [String],
            farmingExperience: Number // in years
        },
        // Warehouse manager specific fields
        warehouseDetails: {
            warehouseName: String,
            warehouseId: String,
            capacity: Number, // in quintals
            location: {
                latitude: Number,
                longitude: Number
            },
            facilities: [String], // ['cold_storage', 'quality_testing', 'fumigation']
            certifications: [String]
        }
    },
    accountBalance: {
        type: Number,
        default: 0
    },
    creditScore: {
        type: Number,
        default: 500,
        min: 300,
        max: 900
    },
    isActive: {
        type: Boolean,
        default: true
    },
    lastLogin: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

// Hash password before saving
userSchema.pre('save', async function(next) {
    if (!this.isModified('password')) return next();
    
    try {
        const salt = await bcrypt.genSalt(10);
        this.password = await bcrypt.hash(this.password, salt);
        next();
    } catch (error) {
        next(error);
    }
});

// Compare password method
userSchema.methods.comparePassword = async function(candidatePassword) {
    return bcrypt.compare(candidatePassword, this.password);
};

// Generate user ID
userSchema.methods.generateUserId = function() {
    const prefix = this.role === 'farmer' ? 'FRM' : 'WHM';
    const timestamp = Date.now().toString().slice(-6);
    const random = Math.random().toString(36).substr(2, 4).toUpperCase();
    return `${prefix}${timestamp}${random}`;
};

module.exports = mongoose.model('User', userSchema); 