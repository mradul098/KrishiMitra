const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
    transactionId: {
        type: String,
        unique: true,
        required: true
    },
    userId: {
        type: String,
        required: true,
        ref: 'User'
    },
    type: {
        type: String,
        enum: ['auction_payment', 'loan_disbursement', 'loan_repayment', 'storage_fee', 'processing_fee', 'withdrawal'],
        required: true
    },
    amount: {
        type: Number,
        required: true
    },
    status: {
        type: String,
        enum: ['pending', 'processing', 'completed', 'failed', 'cancelled'],
        default: 'pending'
    },
    relatedEntityId: {
        type: String, // WHR ID, Loan ID, or Auction ID
        required: true
    },
    relatedEntityType: {
        type: String,
        enum: ['whr', 'loan', 'auction'],
        required: true
    },
    paymentMethod: {
        type: String,
        enum: ['bank_transfer', 'upi', 'credit_card', 'debit_card', 'net_banking', 'cash'],
        required: true
    },
    paymentGateway: {
        gatewayName: String,
        gatewayTransactionId: String,
        gatewayResponse: String
    },
    description: {
        type: String,
        required: true
    },
    metadata: {
        whrDetails: {
            whrId: String,
            cropType: String,
            quantity: Number
        },
        loanDetails: {
            loanId: String,
            principalAmount: Number,
            interestAmount: Number
        },
        auctionDetails: {
            auctionId: String,
            basePrice: Number,
            finalPrice: Number
        }
    },
    balanceAfterTransaction: {
        type: Number,
        required: true
    }
}, {
    timestamps: true
});

// Generate Transaction ID
transactionSchema.methods.generateTransactionId = function() {
    const year = new Date().getFullYear().toString().slice(-2);
    const month = (new Date().getMonth() + 1).toString().padStart(2, '0');
    const day = new Date().getDate().toString().padStart(2, '0');
    const random = Math.random().toString(36).substr(2, 6).toUpperCase();
    return `TXN${year}${month}${day}${random}`;
};

module.exports = mongoose.model('Transaction', transactionSchema); 