const mongoose = require('mongoose');

const loanSchema = new mongoose.Schema({
    loanId: {
        type: String,
        unique: true,
        required: true
    },
    farmerId: {
        type: String,
        required: true,
        ref: 'User'
    },
    whrId: {
        type: String,
        required: true,
        ref: 'WHR'
    },
    loanDetails: {
        principalAmount: { type: Number, required: true },
        interestRate: { type: Number, required: true, default: 12 }, // annual percentage
        tenureMonths: { type: Number, required: true, default: 12 },
        totalInterest: { type: Number, required: true },
        totalAmount: { type: Number, required: true }, // principal + interest
        emiAmount: { type: Number }, // if EMI option chosen
        loanType: { 
            type: String, 
            enum: ['lump_sum', 'emi'],
            default: 'lump_sum'
        }
    },
    collateral: {
        whrValue: { type: Number, required: true },
        loanToValueRatio: { type: Number, default: 70 }, // percentage
        cropType: { type: String, required: true },
        quantity: { type: Number, required: true }
    },
    applicationDetails: {
        applicationDate: { type: Date, default: Date.now },
        approvalDate: { type: Date },
        disbursementDate: { type: Date },
        purpose: { 
            type: String,
            enum: ['farming_inputs', 'family_expenses', 'debt_consolidation', 'business_expansion', 'emergency'],
            required: true
        },
        requestedAmount: { type: Number, required: true }
    },
    status: {
        type: String,
        enum: ['pending', 'under_review', 'approved', 'disbursed', 'active', 'completed', 'overdue', 'defaulted', 'rejected'],
        default: 'pending'
    },
    repaymentDetails: {
        totalPaid: { type: Number, default: 0 },
        remainingAmount: { type: Number },
        lastPaymentDate: { type: Date },
        nextDueDate: { type: Date },
        paymentHistory: [{
            amount: Number,
            paymentDate: Date,
            paymentMethod: String,
            transactionId: String,
            interestPortion: Number,
            principalPortion: Number
        }]
    },
    riskAssessment: {
        creditScore: { type: Number, required: true },
        riskCategory: { 
            type: String,
            enum: ['low', 'medium', 'high'],
            required: true
        },
        approvalComments: { type: String },
        rejectionReason: { type: String }
    },
    fees: {
        processingFee: { type: Number, default: 0 },
        documentationFee: { type: Number, default: 0 },
        totalFees: { type: Number, default: 0 }
    }
}, {
    timestamps: true
});

// Generate Loan ID
loanSchema.methods.generateLoanId = function() {
    const year = new Date().getFullYear().toString().slice(-2);
    const month = (new Date().getMonth() + 1).toString().padStart(2, '0');
    const random = Math.random().toString(36).substr(2, 6).toUpperCase();
    return `LN${year}${month}${random}`;
};

// Calculate total interest
loanSchema.methods.calculateInterest = function() {
    const principal = this.loanDetails.principalAmount;
    const rate = this.loanDetails.interestRate / 100;
    const time = this.loanDetails.tenureMonths / 12;
    return Math.floor(principal * rate * time);
};

// Calculate EMI amount
loanSchema.methods.calculateEMI = function() {
    const principal = this.loanDetails.principalAmount;
    const monthlyRate = this.loanDetails.interestRate / (12 * 100);
    const months = this.loanDetails.tenureMonths;
    
    if (monthlyRate === 0) return principal / months;
    
    const emi = principal * monthlyRate * Math.pow(1 + monthlyRate, months) / 
                (Math.pow(1 + monthlyRate, months) - 1);
    return Math.ceil(emi);
};

// Calculate remaining amount
loanSchema.methods.calculateRemainingAmount = function() {
    return this.loanDetails.totalAmount - this.repaymentDetails.totalPaid;
};

// Determine risk category based on credit score
loanSchema.methods.determineRiskCategory = function(creditScore) {
    if (creditScore >= 750) return 'low';
    if (creditScore >= 650) return 'medium';
    return 'high';
};

module.exports = mongoose.model('Loan', loanSchema); 