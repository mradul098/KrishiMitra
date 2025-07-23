const mongoose = require('mongoose');

const whrSchema = new mongoose.Schema({
    whrId: {
        type: String,
        unique: true,
        required: true
    },
    farmerId: {
        type: String,
        required: true,
        ref: 'User'
    },
    warehouseManagerId: {
        type: String,
        required: true,
        ref: 'User'
    },
    warehouseDetails: {
        warehouseName: { type: String, required: true },
        warehouseLocation: { type: String, required: true },
        warehouseId: { type: String, required: true }
    },
    cropDetails: {
        cropType: { 
            type: String, 
            required: true,
            enum: ['wheat', 'rice', 'cotton', 'soybean', 'corn', 'sugarcane', 'barley', 'gram']
        },
        variety: { type: String, required: true },
        quantity: { type: Number, required: true }, // in quintals
        qualityGrade: { 
            type: String, 
            required: true,
            enum: ['A', 'B', 'C']
        },
        moistureContent: { type: Number }, // percentage
        dateOfDeposit: { type: Date, default: Date.now },
        expectedStoragePeriod: { type: Number, default: 6 } // months
    },
    financialDetails: {
        estimatedValue: { type: Number, required: true }, // total value in INR
        pricePerQuintal: { type: Number, required: true },
        storageCharges: { type: Number, default: 0 },
        insuranceValue: { type: Number, default: 0 }
    },
    status: {
        type: String,
        enum: ['pending_approval', 'active', 'locked_for_loan', 'sold', 'expired', 'withdrawn'],
        default: 'pending_approval'
    },
    loanDetails: {
        isCollateral: { type: Boolean, default: false },
        loanId: { type: String, ref: 'Loan' },
        lockedDate: { type: Date }
    },
    auctionDetails: {
        isInAuction: { type: Boolean, default: false },
        auctionId: { type: String },
        basePrice: { type: Number },
        finalPrice: { type: Number },
        soldDate: { type: Date }
    },
    documents: {
        qualityCertificate: { type: String }, // file path
        depositReceipt: { type: String }, // file path
        photographs: [String] // array of file paths
    },
    approvalDetails: {
        approvedBy: { type: String, ref: 'User' },
        approvedAt: { type: Date },
        rejectionReason: { type: String }
    },
    validityPeriod: {
        issueDate: { type: Date, default: Date.now },
        expiryDate: { type: Date }
    }
}, {
    timestamps: true
});

// Generate WHR ID
whrSchema.methods.generateWHRId = function() {
    const year = new Date().getFullYear().toString().slice(-2);
    const month = (new Date().getMonth() + 1).toString().padStart(2, '0');
    const random = Math.random().toString(36).substr(2, 6).toUpperCase();
    return `WHR${year}${month}${random}`;
};

// Calculate expiry date (typically 1 year from issue)
whrSchema.methods.calculateExpiryDate = function() {
    const issueDate = this.validityPeriod.issueDate || new Date();
    const expiryDate = new Date(issueDate);
    expiryDate.setFullYear(expiryDate.getFullYear() + 1);
    return expiryDate;
};

// Calculate loan eligibility (70% of estimated value)
whrSchema.methods.calculateLoanEligibility = function() {
    return Math.floor(this.financialDetails.estimatedValue * 0.7);
};

module.exports = mongoose.model('WHR', whrSchema); 