const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const OpenAI = require('openai');
const axios = require('axios');
const mongoose = require('mongoose');
const session = require('express-session');
const jwt = require('jsonwebtoken');
require('dotenv').config();

// Import models
const User = require('./models/User');
const WHR = require('./models/WHR');
const Loan = require('./models/Loan');
const Transaction = require('./models/Transaction');

const app = express();
const PORT = process.env.PORT || 3000;

// Database connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/agritech-platform', {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(() => {
    console.log('Connected to MongoDB');
}).catch(err => {
    console.error('MongoDB connection error:', err);
});

// Middleware
app.use(cors({
    origin: true,
    credentials: true
}));
app.use(bodyParser.json());
app.use(express.static('public'));
app.use(session({
    secret: process.env.SESSION_SECRET || 'agritech-hackathon-secret',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false, maxAge: 24 * 60 * 60 * 1000 } // 24 hours
}));

// Initialize OpenAI
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

// Create an assistant once during initialization
let assistant;
async function createAssistant() {
    try {
        // First verify if the API key is working
        try {
            const models = await openai.models.list();
            console.log("OpenAI API key is valid. Available models:", models.data.length);
        } catch (apiError) {
            console.error("OpenAI API key validation failed:", apiError.message);
            throw new Error('API key validation failed');
        }

        // Check if we already have an assistant
        const assistants = await openai.beta.assistants.list();
        const existingAssistant = assistants.data.find(a => a.name === "KrishiMitra");
        
        if (existingAssistant) {
            console.log("Found existing assistant, reusing it");
            assistant = existingAssistant;
        } else {
            // Create new assistant
            assistant = await openai.beta.assistants.create({
                name: "KrishiMitra",
                instructions: SYSTEM_PROMPT,
                model: "gpt-3.5-turbo",
            });
            console.log("New assistant created successfully");
        }
        
        console.log("Assistant ID:", assistant.id);
        return assistant;
    } catch (error) {
        console.error("Error creating assistant:", error.message);
        if (error.response) {
            console.error("Error details:", error.response.data);
        }
        throw error; // Re-throw the error to be handled by the caller
    }
}

// Authentication middleware
const authenticateUser = (req, res, next) => {
    if (req.session.user) {
        req.user = req.session.user;
        next();
    } else {
        res.status(401).json({ success: false, message: 'Please login to access this resource' });
    }
};

// Role-based access middleware
const authorizeRole = (roles) => {
    return (req, res, next) => {
        if (roles.includes(req.user.role)) {
            next();
        } else {
            res.status(403).json({ success: false, message: 'Access denied' });
        }
    };
};

// Enhanced system prompt for the farming assistant
const SYSTEM_PROMPT = `You are KrishiMitra, an AI-powered financial assistant specifically designed for the KrishiMitra agricultural finance platform. You help Indian farmers navigate our comprehensive financial ecosystem.

🌾 KRISHIMITRA PLATFORM FEATURES YOU MUST GUIDE USERS ON:

1. WHR-BASED LENDING:
   - Step 1: Deposit crops at partnered warehouses
   - Step 2: Get digital Warehouse Receipt (WHR) 
   - Step 3: Apply for instant loans (up to 80% of crop value)
   - Step 4: Get approval in 24 hours with competitive rates
   - Available in: Farmer Dashboard → Loans section → "Apply for Loan"

2. LIVE CROP AUCTIONS:
   - Step 1: Login to farmer dashboard
   - Step 2: Go to Auctions → Create New Auction
   - Step 3: Set base price and auction duration
   - Step 4: Buyers bid in real-time
   - Step 5: Accept best offer and get instant payment
   - Feature: Real-time bidding with transparent price discovery

3. DOCULOCKER (Secure Document Storage):
   - Upload and store: Land records, Aadhaar, bank documents, WHRs
   - Share securely with banks and institutions
   - Access anywhere, anytime
   - Bank-grade security with automatic backup
   - Location: Farmer Dashboard → DocuLocker section

4. GOVERNMENT SCHEME INTEGRATION:
   - PM-KISAN: ₹6,000 annual direct transfer (check status and next payment)
   - Kisan Credit Card: 7% interest, ₹3L collateral-free limit
   - PM Fasal Bima: Comprehensive crop insurance with low premiums
   - Agri-Stack: Part of ₹6,000 Cr digital agriculture infrastructure
   - Access: Available in farmer dashboard under "Government Schemes"

5. AI-POWERED FINANCIAL PLANNING:
   - Personalized loan recommendations based on crop and land size
   - Government scheme eligibility analysis
   - Optimal selling time predictions
   - Risk assessment and insurance advice
   - Budget planning: Input costs vs income optimization

6. WAREHOUSE NETWORK:
   - Find nearby warehouses with GPS integration
   - Real-time capacity and facility information
   - Quality testing and storage certifications
   - Competitive storage rates and processing fees

💰 FINANCIAL PLANNING EXPERTISE:
- Analyze farmer's land size, crops, and financial history
- Recommend optimal loan amounts and tenure
- Calculate total financial benefits from multiple schemes
- Suggest best times to sell crops for maximum profit
- Provide debt management and savings advice
- Help plan for seasonal expenses and emergencies

🌐 LANGUAGE SUPPORT:
- Respond in Hindi if user asks in Hindi
- Support Marathi if requested
- Always use simple, farmer-friendly language
- Include local terms and context

🔢 MOCK DATA TO USE WHEN ASKED:
WEATHER (Sonipat, Haryana region):
- Temperature: 26-32°C, Humidity: 68%
- Next 3 days: Light rain expected, good for wheat sowing
- This week: Sunny with occasional clouds, ideal for harvesting

CURRENT MANDI PRICES (Sonipat/Delhi region):
- Wheat: ₹2,250/quintal (UP Grade A)
- Rice: ₹2,100/quintal (Basmati 1121)
- Cotton: ₹6,800/quintal (Medium staple)
- Sugarcane: ₹380/quintal (10.5% recovery)
- Mustard: ₹5,650/quintal (40% oil content)

FINANCIAL CALCULATIONS:
- WHR Loan: Up to 80% of crop value, 12% annual interest
- Average farmer saves ₹45,000 annually using our integrated services
- Government schemes provide ₹15,000-25,000 additional annual income

🎯 RESPONSE GUIDELINES:
1. When asked about loans: Guide them to WHR-based lending feature
2. When asked about selling crops: Explain live auction system
3. When asked about documents: Direct to DocuLocker
4. When asked about government schemes: Show integrated scheme dashboard
5. For weather/prices: Provide mock data and suggest using our real-time updates
6. Always give step-by-step instructions for platform features
7. Include specific benefits and numbers when possible
8. End with encouraging next steps

Remember: You are not just providing general farming advice - you are specifically helping users navigate and use the KrishiMitra platform effectively!`;

// ================================
// AUTHENTICATION ROUTES
// ================================

// Register new user
app.post('/api/auth/register', async (req, res) => {
    try {
        const { email, password, role, profile } = req.body;
        
        // Check if user already exists
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ 
                success: false, 
                message: 'User with this email already exists' 
            });
        }
        
        // Create new user
        const user = new User({
            email,
            password,
            role,
            profile
        });
        
        // Generate user ID
        user.userId = user.generateUserId();
        
        // Save user
        await user.save();
        
        // Create session
        req.session.user = {
            userId: user.userId,
            email: user.email,
            role: user.role,
            profile: user.profile
        };
        
        res.status(201).json({
            success: true,
            message: 'User registered successfully',
            user: {
                userId: user.userId,
                email: user.email,
                role: user.role,
                profile: user.profile
            }
        });
        
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Registration failed', 
            error: error.message 
        });
    }
});

// Login user
app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        
        // Find user
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(400).json({ 
                success: false, 
                message: 'Invalid email or password' 
            });
        }
        
        // Check password
        const isPasswordValid = await user.comparePassword(password);
        if (!isPasswordValid) {
            return res.status(400).json({ 
                success: false, 
                message: 'Invalid email or password' 
            });
        }
        
        // Update last login
        user.lastLogin = new Date();
        await user.save();
        
        // Create session
        req.session.user = {
            userId: user.userId,
            email: user.email,
            role: user.role,
            profile: user.profile,
            accountBalance: user.accountBalance,
            creditScore: user.creditScore
        };
        
        res.json({
            success: true,
            message: 'Login successful',
            user: req.session.user
        });
        
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Login failed', 
            error: error.message 
        });
    }
});

// Logout user
app.post('/api/auth/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            return res.status(500).json({ 
                success: false, 
                message: 'Logout failed' 
            });
        }
        res.json({ 
            success: true, 
            message: 'Logged out successfully' 
        });
    });
});

// Get current user
app.get('/api/auth/me', authenticateUser, (req, res) => {
    res.json({
        success: true,
        user: req.user
    });
});

// Get demo users (for development purposes)
app.get('/api/auth/demo-users', async (req, res) => {
    try {
        const users = await User.find({ 
            email: { $in: ['farmer@demo.com', 'warehouse@demo.com'] } 
        }).select('-password');
        
        res.json({
            success: true,
            users
        });
    } catch (error) {
        console.error('Error fetching demo users:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch demo users'
        });
    }
});

// ================================
// FARMER ROUTES
// ================================

// Get farmer's WHRs
app.get('/api/farmer/whrs', authenticateUser, authorizeRole(['farmer']), async (req, res) => {
    try {
        const { status } = req.query;
        const query = { farmerId: req.user.userId };
        
        if (status) {
            query.status = status;
        }
        
        const whrs = await WHR.find(query).sort({ createdAt: -1 });
        
        res.json({
            success: true,
            whrs
        });
    } catch (error) {
        console.error('Error fetching WHRs:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch WHRs'
        });
    }
});

// Get farmer's loans
app.get('/api/farmer/loans', authenticateUser, authorizeRole(['farmer']), async (req, res) => {
    try {
        const loans = await Loan.find({ farmerId: req.user.userId }).sort({ createdAt: -1 });
        
        res.json({
            success: true,
            loans
        });
    } catch (error) {
        console.error('Error fetching loans:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch loans'
        });
    }
});

// Get farmer's transactions
app.get('/api/farmer/transactions', authenticateUser, authorizeRole(['farmer']), async (req, res) => {
    try {
        const transactions = await Transaction.find({ userId: req.user.userId }).sort({ createdAt: -1 });
        
        res.json({
            success: true,
            transactions
        });
    } catch (error) {
        console.error('Error fetching transactions:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch transactions'
        });
    }
});

// Create auction
app.post('/api/farmer/auction/create', authenticateUser, authorizeRole(['farmer']), async (req, res) => {
    try {
        const { whrId, basePrice, duration } = req.body;
        
        // Verify WHR ownership and availability
        const whr = await WHR.findOne({ 
            whrId, 
            farmerId: req.user.userId, 
            status: 'active' 
        });
        
        if (!whr) {
            return res.status(400).json({
                success: false,
                message: 'WHR not found or not available for auction'
            });
        }
        
        // Update WHR status
        whr.auctionDetails.isInAuction = true;
        whr.auctionDetails.basePrice = basePrice;
        whr.status = 'in_auction';
        await whr.save();
        
        res.json({
            success: true,
            message: 'Auction started successfully',
            auction: {
                id: whr.whrId,
                whrId,
                basePrice,
                duration
            }
        });
    } catch (error) {
        console.error('Error creating auction:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create auction'
        });
    }
});

// Accept auction result
app.post('/api/farmer/auction/:auctionId/accept', authenticateUser, authorizeRole(['farmer']), async (req, res) => {
    try {
        const { auctionId } = req.params;
        const { finalPrice } = req.body;
        
        // Find and update WHR
        const whr = await WHR.findOne({ 
            whrId: auctionId, 
            farmerId: req.user.userId 
        });
        
        if (!whr) {
            return res.status(404).json({
                success: false,
                message: 'Auction not found'
            });
        }
        
        // Update WHR
        whr.status = 'sold';
        whr.auctionDetails.finalPrice = finalPrice;
        whr.auctionDetails.soldDate = new Date();
        await whr.save();
        
        // Create transaction
        const transaction = new Transaction({
            userId: req.user.userId,
            type: 'auction_payment',
            amount: finalPrice,
            status: 'completed',
            relatedEntityId: whr.whrId,
            relatedEntityType: 'whr',
            paymentMethod: 'bank_transfer',
            description: `Auction payment for ${whr.cropDetails.cropType} - ${whr.cropDetails.quantity}q`,
            metadata: {
                whrDetails: {
                    whrId: whr.whrId,
                    cropType: whr.cropDetails.cropType,
                    quantity: whr.cropDetails.quantity
                },
                auctionDetails: {
                    basePrice: whr.auctionDetails.basePrice,
                    finalPrice: finalPrice
                }
            },
            balanceAfterTransaction: req.user.accountBalance + finalPrice
        });
        
        transaction.transactionId = transaction.generateTransactionId();
        await transaction.save();
        
        // Update user balance
        await User.findOneAndUpdate(
            { userId: req.user.userId },
            { $inc: { accountBalance: finalPrice } }
        );
        
        res.json({
            success: true,
            message: 'Auction completed successfully',
            finalPrice,
            newBalance: req.user.accountBalance + finalPrice
        });
    } catch (error) {
        console.error('Error accepting auction:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to complete auction'
        });
    }
});

// Apply for loan
app.post('/api/farmer/loan/apply', authenticateUser, authorizeRole(['farmer']), async (req, res) => {
    try {
        const { whrId, requestedAmount, purpose, tenureMonths } = req.body;
        
        // Verify WHR ownership and availability
        const whr = await WHR.findOne({ 
            whrId, 
            farmerId: req.user.userId, 
            status: 'active' 
        });
        
        if (!whr) {
            return res.status(400).json({
                success: false,
                message: 'WHR not found or not available for loan'
            });
        }
        
        // Calculate loan details
        const eligibleAmount = Math.floor(whr.financialDetails.estimatedValue * 0.7);
        const principalAmount = Math.min(requestedAmount, eligibleAmount);
        const interestRate = 12; // 12% annual
        const totalInterest = Math.floor((principalAmount * interestRate * tenureMonths) / (12 * 100));
        const totalAmount = principalAmount + totalInterest;
        
        // Create loan
        const loan = new Loan({
            farmerId: req.user.userId,
            whrId: whr.whrId,
            loanDetails: {
                principalAmount,
                interestRate,
                tenureMonths,
                totalInterest,
                totalAmount,
                loanType: 'lump_sum'
            },
            collateral: {
                whrValue: whr.financialDetails.estimatedValue,
                cropType: whr.cropDetails.cropType,
                quantity: whr.cropDetails.quantity
            },
            applicationDetails: {
                purpose,
                requestedAmount
            },
            riskAssessment: {
                creditScore: req.user.creditScore,
                riskCategory: req.user.creditScore >= 750 ? 'low' : req.user.creditScore >= 650 ? 'medium' : 'high'
            },
            repaymentDetails: {
                remainingAmount: totalAmount
            }
        });
        
        loan.loanId = loan.generateLoanId();
        
        // Auto-approve for demo (in real system, this would go through approval process)
        loan.status = 'approved';
        loan.applicationDetails.approvalDate = new Date();
        
        await loan.save();
        
        // Lock WHR
        whr.status = 'locked_for_loan';
        whr.loanDetails.isCollateral = true;
        whr.loanDetails.loanId = loan.loanId;
        whr.loanDetails.lockedDate = new Date();
        await whr.save();
        
        // Create disbursement transaction
        const transaction = new Transaction({
            userId: req.user.userId,
            type: 'loan_disbursement',
            amount: principalAmount,
            status: 'completed',
            relatedEntityId: loan.loanId,
            relatedEntityType: 'loan',
            paymentMethod: 'bank_transfer',
            description: `Loan disbursement - ${purpose.replace('_', ' ')}`,
            metadata: {
                loanDetails: {
                    loanId: loan.loanId,
                    principalAmount,
                    interestAmount: totalInterest
                }
            },
            balanceAfterTransaction: req.user.accountBalance + principalAmount
        });
        
        transaction.transactionId = transaction.generateTransactionId();
        await transaction.save();
        
        // Update user balance
        await User.findOneAndUpdate(
            { userId: req.user.userId },
            { $inc: { accountBalance: principalAmount } }
        );
        
        // Update loan status to active
        loan.status = 'active';
        loan.applicationDetails.disbursementDate = new Date();
        await loan.save();
        
        res.json({
            success: true,
            message: 'Loan approved and disbursed successfully!',
            loan: {
                loanId: loan.loanId,
                principalAmount,
                totalAmount,
                interestRate
            }
        });
    } catch (error) {
        console.error('Error applying for loan:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to apply for loan'
        });
    }
});

// ================================
// WAREHOUSE ROUTES
// ================================

// Get nearby warehouses
app.get('/api/warehouses/nearby', authenticateUser, async (req, res) => {
    try {
        // Mock warehouse data for demo
        const mockWarehouses = [
            {
                id: 'WH001',
                warehouseName: 'Green Valley Storage',
                location: 'Sonipat, Haryana',
                distance: 5.2,
                capacity: 10000,
                availableCapacity: 7500,
                storageRate: 25,
                facilities: ['cold_storage', 'quality_testing', 'fumigation'],
                contact: '+91-9876543211'
            },
            {
                id: 'WH002',
                warehouseName: 'Punjab Agri Warehouse',
                location: 'Karnal, Haryana',
                distance: 12.8,
                capacity: 15000,
                availableCapacity: 12000,
                storageRate: 22,
                facilities: ['quality_testing', 'fumigation', 'pest_control'],
                contact: '+91-9876543212'
            },
            {
                id: 'WH003',
                warehouseName: 'Modern Storage Solutions',
                location: 'Panipat, Haryana',
                distance: 18.5,
                capacity: 8000,
                availableCapacity: 6000,
                storageRate: 28,
                facilities: ['cold_storage', 'quality_testing'],
                contact: '+91-9876543213'
            }
        ];
        
        res.json({
            success: true,
            warehouses: mockWarehouses
        });
    } catch (error) {
        console.error('Error fetching warehouses:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch warehouses'
        });
    }
});

// Search warehouses
app.get('/api/warehouses/search', authenticateUser, async (req, res) => {
    try {
        const { location, radius } = req.query;
        
        // For demo, return the same mock data
        // In production, this would search based on location and radius
        const mockWarehouses = [
            {
                id: 'WH001',
                warehouseName: 'Green Valley Storage',
                location: location || 'Sonipat, Haryana',
                distance: Math.random() * parseInt(radius || 25),
                capacity: 10000,
                availableCapacity: 7500,
                storageRate: 25,
                facilities: ['cold_storage', 'quality_testing', 'fumigation'],
                contact: '+91-9876543211'
            }
        ];
        
        res.json({
            success: true,
            warehouses: mockWarehouses
        });
    } catch (error) {
        console.error('Error searching warehouses:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to search warehouses'
        });
    }
});

// ================================
// WAREHOUSE MANAGER ROUTES
// ================================

// Get warehouse manager's WHRs
app.get('/api/warehouse/whrs', authenticateUser, authorizeRole(['warehouse_manager']), async (req, res) => {
    try {
        const whrs = await WHR.find({ 
            warehouseManagerId: req.user.userId 
        }).sort({ createdAt: -1 });
        
        res.json({
            success: true,
            whrs
        });
    } catch (error) {
        console.error('Error fetching warehouse WHRs:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch WHRs'
        });
    }
});

// Get warehouse inventory
app.get('/api/warehouse/inventory', authenticateUser, authorizeRole(['warehouse_manager']), async (req, res) => {
    try {
        const whrs = await WHR.find({ 
            warehouseManagerId: req.user.userId,
            status: { $in: ['active', 'locked_for_loan'] }
        });
        
        // Calculate summary
        let totalOccupied = 0;
        const cropBreakdown = {};
        
        whrs.forEach(whr => {
            totalOccupied += whr.cropDetails.quantity;
            
            if (cropBreakdown[whr.cropDetails.cropType]) {
                cropBreakdown[whr.cropDetails.cropType] += whr.cropDetails.quantity;
            } else {
                cropBreakdown[whr.cropDetails.cropType] = whr.cropDetails.quantity;
            }
        });
        
        res.json({
            success: true,
            whrs: whrs.map(whr => ({
                whrId: whr.whrId,
                farmerId: whr.farmerId,
                farmerName: `Farmer ${whr.farmerId.slice(-4)}`, // Mock farmer name
                cropDetails: whr.cropDetails,
                status: whr.status
            })),
            summary: {
                totalOccupied,
                cropBreakdown
            }
        });
    } catch (error) {
        console.error('Error fetching warehouse inventory:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch inventory'
        });
    }
});

// Get pending deposits
app.get('/api/warehouse/pending-deposits', authenticateUser, authorizeRole(['warehouse_manager']), async (req, res) => {
    try {
        // For demo, return empty array - deposits will be added via demo button
        res.json({
            success: true,
            deposits: []
        });
    } catch (error) {
        console.error('Error fetching pending deposits:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch pending deposits'
        });
    }
});

// Generate WHR
app.post('/api/warehouse/generate-whr', authenticateUser, authorizeRole(['warehouse_manager']), async (req, res) => {
    try {
        const { farmerId, cropDetails, financialDetails, storageDetails } = req.body;
        
        // Create new WHR
        const whr = new WHR({
            farmerId,
            warehouseManagerId: req.user.userId,
            warehouseDetails: {
                warehouseName: req.user.profile.warehouseDetails?.warehouseName || 'Demo Warehouse',
                warehouseLocation: `${req.user.profile.address.city}, ${req.user.profile.address.state}`,
                warehouseId: req.user.profile.warehouseDetails?.warehouseId || 'WH001'
            },
            cropDetails: {
                ...cropDetails,
                dateOfDeposit: new Date(),
                expectedStoragePeriod: storageDetails.expectedStoragePeriod
            },
            financialDetails: {
                ...financialDetails,
                storageCharges: financialDetails.storageCharges * cropDetails.quantity * storageDetails.expectedStoragePeriod,
                insuranceValue: Math.floor(financialDetails.estimatedValue * 0.02)
            },
            status: 'active',
            approvalDetails: {
                approvedBy: req.user.userId,
                approvedAt: new Date()
            },
            validityPeriod: {
                issueDate: new Date(),
                expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) // 1 year
            }
        });
        
        // Generate WHR ID
        whr.whrId = whr.generateWHRId();
        whr.validityPeriod.expiryDate = whr.calculateExpiryDate();
        
        await whr.save();
        
        res.json({
            success: true,
            message: 'WHR generated successfully',
            whr: {
                whrId: whr.whrId,
                farmerId: whr.farmerId,
                farmerName: `Farmer ${farmerId.slice(-4)}`, // Mock name
                cropDetails: whr.cropDetails,
                financialDetails: whr.financialDetails,
                status: whr.status
            }
        });
    } catch (error) {
        console.error('Error generating WHR:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to generate WHR'
        });
    }
});

// Update warehouse settings
app.put('/api/warehouse/settings', authenticateUser, authorizeRole(['warehouse_manager']), async (req, res) => {
    try {
        const { capacity, storageRate, processingFee, facilities, contactPhone } = req.body;
        
        // Update user profile
        await User.findOneAndUpdate(
            { userId: req.user.userId },
            {
                $set: {
                    'profile.warehouseDetails.capacity': capacity,
                    'profile.warehouseDetails.facilities': facilities,
                    'profile.phone': contactPhone
                }
            }
        );
        
        res.json({
            success: true,
            message: 'Warehouse settings updated successfully'
        });
    } catch (error) {
        console.error('Error updating warehouse settings:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update settings'
        });
    }
});

// ================================
// WAREHOUSE MANAGER ROUTES
// ================================

// Get warehouse manager's WHRs
app.get('/api/warehouse/whrs', authenticateUser, authorizeRole(['warehouse_manager']), async (req, res) => {
    try {
        const whrs = await WHR.find({ 
            warehouseManagerId: req.user.userId 
        }).sort({ createdAt: -1 });
        
        res.json({
            success: true,
            whrs
        });
    } catch (error) {
        console.error('Error fetching warehouse WHRs:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch WHRs'
        });
    }
});

// Generate WHR
app.post('/api/warehouse/generate-whr', authenticateUser, authorizeRole(['warehouse_manager']), async (req, res) => {
    try {
        const { farmerId, cropDetails, financialDetails, storageDetails } = req.body;
        
        // Create new WHR
        const whr = new WHR({
            farmerId,
            warehouseManagerId: req.user.userId,
            warehouseDetails: {
                warehouseName: req.user.profile.warehouseDetails?.warehouseName || 'Demo Warehouse',
                warehouseLocation: `${req.user.profile.address.city}, ${req.user.profile.address.state}`,
                warehouseId: req.user.profile.warehouseDetails?.warehouseId || 'WH001'
            },
            cropDetails: {
                ...cropDetails,
                dateOfDeposit: new Date(),
                expectedStoragePeriod: storageDetails.expectedStoragePeriod
            },
            financialDetails: {
                ...financialDetails,
                storageCharges: financialDetails.storageCharges * cropDetails.quantity * storageDetails.expectedStoragePeriod,
                insuranceValue: Math.floor(financialDetails.estimatedValue * 0.02)
            },
            status: 'active',
            approvalDetails: {
                approvedBy: req.user.userId,
                approvedAt: new Date()
            },
            validityPeriod: {
                issueDate: new Date(),
                expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) // 1 year
            }
        });
        
        // Generate WHR ID
        whr.whrId = whr.generateWHRId();
        whr.validityPeriod.expiryDate = whr.calculateExpiryDate();
        
        await whr.save();
        
        res.json({
            success: true,
            message: 'WHR generated successfully',
            whr: {
                whrId: whr.whrId,
                farmerId: whr.farmerId,
                farmerName: `Farmer ${farmerId.slice(-4)}`,
                cropDetails: whr.cropDetails,
                financialDetails: whr.financialDetails,
                status: whr.status
            }
        });
    } catch (error) {
        console.error('Error generating WHR:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to generate WHR'
        });
    }
});

// Chat endpoint
app.post('/api/chat', async (req, res) => {
    try {
        const { message, location, language = 'en', threadId } = req.body;
        
        // Verify assistant is properly initialized
        if (!assistant || !assistant.id) {
            console.error("Assistant not properly initialized");
            return res.status(500).json({
                success: false,
                error: 'Chat service not ready. Please try again in a few moments.'
            });
        }
        
        // Get user context if authenticated
        let userContext = '';
        if (req.session && req.session.user) {
            const user = req.session.user;
            userContext = `
CURRENT USER PROFILE:
- Role: ${user.role}
- Location: ${user.profile?.address?.city}, ${user.profile?.address?.state}
- Farm Size: ${user.profile?.farmDetails?.farmSize || 'Not specified'} hectares
- Primary Crops: ${user.profile?.farmDetails?.primaryCrops?.join(', ') || 'Not specified'}
- Credit Score: ${user.creditScore || 'Not available'}
- Account Balance: ₹${user.accountBalance || 0}
`;
        }
        
        // Get enhanced context data
        const weatherData = await getEnhancedWeatherData(location);
        const marketPrices = await getEnhancedMarketPrices(location);
        const financialAdvice = await generateFinancialAdvice(req.session?.user);
        
        // Create comprehensive context-aware message
        const contextMessage = `
${userContext}

CURRENT CONTEXT DATA:
- Location: ${location || 'Sonipat, Haryana (Default)'}
- Weather: ${weatherData}
- Market Prices: ${marketPrices}
- Financial Recommendations: ${financialAdvice}

USER QUESTION: ${message}

Please provide a helpful response that includes:
1. Direct answer to the question
2. Relevant KrishiMitra platform features
3. Step-by-step guidance if applicable
4. Specific financial benefits or numbers
5. Next action steps
`;

        // Create or retrieve thread
        let thread;
        if (!threadId) {
            thread = await openai.beta.threads.create();
        } else {
            thread = { id: threadId };
        }

        // Add message to thread
        await openai.beta.threads.messages.create(thread.id, {
            role: "user",
            content: contextMessage
        });

        // Run the assistant
        const run = await openai.beta.threads.runs.create(thread.id, {
            assistant_id: assistant.id
        });

        // Wait for the completion
        let runStatus = await openai.beta.threads.runs.retrieve(thread.id, run.id);
        while (runStatus.status !== 'completed') {
            await new Promise(resolve => setTimeout(resolve, 1000));
            runStatus = await openai.beta.threads.runs.retrieve(thread.id, run.id);
            
            if (runStatus.status === 'failed') {
                throw new Error('Assistant run failed');
            }
        }

        // Get the messages
        const messages = await openai.beta.threads.messages.list(thread.id);
        const lastMessage = messages.data[0];
        const botResponse = lastMessage.content[0].text.value;
        
        res.json({
            success: true,
            message: botResponse,
            threadId: thread.id,
            context: {
                weather: weatherData,
                prices: marketPrices
            }
        });
    } catch (error) {
        console.error('Chat error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to process message'
        });
    }
});

// Enhanced weather data with mock information
async function getEnhancedWeatherData(location) {
    // For demo purposes, return comprehensive mock weather data
    const mockWeather = `Temperature: 28°C, Humidity: 65%, Partly cloudy. 
Tomorrow: Light rain expected (good for wheat sowing). 
This week: Mostly sunny, ideal for harvesting mature crops.
Wind: 12 km/h from southwest. UV Index: Moderate.`;
    
    return mockWeather;
}

// Legacy weather function (kept for compatibility)
async function getWeatherData(location) {
    if (!location) return null;
    
    try {
        const response = await axios.get(
            `https://api.openweathermap.org/data/2.5/weather?q=${location},IN&appid=${process.env.WEATHER_API_KEY}&units=metric`
        );
        
        return {
            temp: Math.round(response.data.main.temp),
            description: response.data.weather[0].description,
            humidity: response.data.main.humidity,
            rain: response.data.rain ? response.data.rain['1h'] : 0
        };
    } catch (error) {
        console.error('Weather API error:', error);
        return null;
    }
}

// Enhanced market prices with detailed mock data
async function getEnhancedMarketPrices(location) {
    const enhancedPrices = `Current Mandi Rates (Sonipat/Delhi region):
• Wheat: ₹2,250/quintal (Grade A) - UP 5% from last week
• Rice: ₹2,100/quintal (Basmati 1121) - Stable, good demand
• Cotton: ₹6,800/quintal (Medium staple) - DOWN 2% due to weather
• Sugarcane: ₹380/quintal (10.5% recovery) - Peak season rates
• Mustard: ₹5,650/quintal (40% oil content) - Expected to rise 8%

💡 Best selling advice: Hold wheat for 2 weeks for better prices. Cotton prices may drop further.`;
    
    return enhancedPrices;
}

// Legacy market prices function (kept for compatibility)
async function getMarketPrices(location) {
    // Mock data for demo
    const prices = {
        wheat: { min: 2000, max: 2200, unit: 'Rs/quintal' },
        rice: { min: 1800, max: 2000, unit: 'Rs/quintal' },
        cotton: { min: 5500, max: 6000, unit: 'Rs/quintal' },
        soybean: { min: 4000, max: 4500, unit: 'Rs/quintal' }
    };
    
    return prices;
}

// AI-powered financial planning advice
async function generateFinancialAdvice(user) {
    if (!user) {
        return `General Financial Recommendations:
• Consider WHR-based loans for immediate cash needs (12% interest)
• Apply for PM-KISAN scheme for ₹6,000 annual benefit
• Use crop insurance to protect against weather risks
• Store crops in warehouses for better prices and loan eligibility`;
    }
    
    const farmSize = user.profile?.farmDetails?.farmSize || 5;
    const crops = user.profile?.farmDetails?.primaryCrops || ['wheat', 'rice'];
    const creditScore = user.creditScore || 720;
    const balance = user.accountBalance || 25000;
    
    // Calculate personalized advice
    const maxLoanEligible = Math.floor(farmSize * 50000); // ₹50k per hectare approx
    const expectedAnnualIncome = farmSize * 80000; // ₹80k per hectare
    const governmentBenefits = 6000 + (farmSize * 2000); // PM-KISAN + other schemes
    
    const advice = `PERSONALIZED FINANCIAL PLAN (Based on ${farmSize} hectare farm):

💰 LOAN ELIGIBILITY:
• WHR-based loan: Up to ₹${Math.floor(maxLoanEligible * 0.8).toLocaleString()} (80% of crop value)
• KCC limit: ₹${Math.min(maxLoanEligible, 300000).toLocaleString()} at 4% interest (with prompt repayment)
• Credit score: ${creditScore} - ${creditScore >= 750 ? 'Excellent, get best rates' : creditScore >= 650 ? 'Good, eligible for most schemes' : 'Fair, improve for better terms'}

📈 INCOME OPTIMIZATION:
• Expected annual income: ₹${expectedAnnualIncome.toLocaleString()}
• Government benefits available: ₹${governmentBenefits.toLocaleString()}/year
• Total potential: ₹${(expectedAnnualIncome + governmentBenefits).toLocaleString()}/year
• Current balance: ₹${balance.toLocaleString()}

🎯 RECOMMENDED ACTIONS:
1. Apply for PM-KISAN if not enrolled (₹6,000/year)
2. Use DocuLocker to store documents for quick loan processing
3. Consider crop insurance for ${crops.join(', ')} (premium: ₹${farmSize * 500}/year)
4. Store crops in warehouses for 15-20% better prices
5. Budget: 60% for inputs, 25% family expenses, 15% savings

💡 THIS MONTH'S PRIORITY: ${balance < 50000 ? 'Apply for WHR loan for working capital' : 'Consider storing crops for better market prices'}`;

    return advice;
}

// Crop insurance calculator endpoint
app.post('/api/insurance/calculate', async (req, res) => {
    try {
        const { cropType, area, season } = req.body;
        
        // Simplified calculation for demo
        const premiumRates = {
            kharif: { farmer: 2, govt: 98 },
            rabi: { farmer: 1.5, govt: 98.5 }
        };
        
        const sumInsured = area * 40000; // Rs 40,000 per hectare (example)
        const rate = premiumRates[season] || premiumRates.kharif;
        const farmerPremium = (sumInsured * rate.farmer) / 100;
        
        res.json({
            success: true,
            data: {
                sumInsured,
                farmerPremium: Math.round(farmerPremium),
                govtSubsidy: Math.round((sumInsured * rate.govt) / 100),
                cropType,
                area,
                season
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Failed to calculate insurance'
        });
    }
});

// Warehouse receipt loan eligibility
app.post('/api/loans/warehouse', async (req, res) => {
    try {
        const { commodity, quantity, quality } = req.body;
        
        // Mock calculation
        const rates = {
            wheat: { A: 2000, B: 1800, C: 1600 },
            rice: { A: 1900, B: 1700, C: 1500 },
            cotton: { A: 5500, B: 5000, C: 4500 }
        };
        
        const rate = rates[commodity]?.[quality] || 1500;
        const estimatedValue = quantity * rate;
        const loanAmount = estimatedValue * 0.7; // 70% of commodity value
        
        res.json({
            success: true,
            data: {
                commodity,
                quantity,
                quality,
                estimatedValue,
                eligibleLoanAmount: Math.round(loanAmount),
                interestRate: '7% per annum',
                tenure: '6 months'
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Failed to calculate loan eligibility'
        });
    }
});

// Create demo users on startup
async function createDemoUsers() {
    try {
        // Check if demo users already exist
        const existingFarmer = await User.findOne({ email: 'farmer@demo.com' });
        const existingWarehouse = await User.findOne({ email: 'warehouse@demo.com' });
        
        if (!existingFarmer) {
            const demoFarmer = new User({
                email: 'farmer@demo.com',
                password: 'password123',
                role: 'farmer',
                profile: {
                    firstName: 'Rajesh',
                    lastName: 'Kumar',
                    phone: '+91-9876543210',
                    address: {
                        street: 'Village Kharkhoda',
                        city: 'Sonipat',
                        state: 'Haryana',
                        pincode: '131402'
                    },
                    farmDetails: {
                        farmSize: 5.5,
                        primaryCrops: ['wheat', 'rice', 'cotton'],
                        farmingExperience: 15
                    }
                },
                accountBalance: 25000,
                creditScore: 720
            });
            demoFarmer.userId = demoFarmer.generateUserId();
            await demoFarmer.save();
            console.log('Demo farmer created');
        }
        
        if (!existingWarehouse) {
            const demoWarehouse = new User({
                email: 'warehouse@demo.com',
                password: 'password123',
                role: 'warehouse_manager',
                profile: {
                    firstName: 'Suresh',
                    lastName: 'Singh',
                    phone: '+91-9876543211',
                    address: {
                        street: 'Industrial Area Phase-1',
                        city: 'Sonipat',
                        state: 'Haryana',
                        pincode: '131402'
                    },
                    warehouseDetails: {
                        warehouseName: 'Green Valley Storage',
                        warehouseId: 'WH2024001',
                        capacity: 10000,
                        location: {
                            latitude: 28.9931,
                            longitude: 77.0151
                        },
                        facilities: ['cold_storage', 'quality_testing', 'fumigation'],
                        certifications: ['ISO_9001', 'FSSAI']
                    }
                }
            });
            demoWarehouse.userId = demoWarehouse.generateUserId();
            await demoWarehouse.save();
            console.log('Demo warehouse manager created');
        }
    } catch (error) {
        console.error('Error creating demo users:', error);
    }
}

// Initialize server
async function initializeServer() {
    try {
        // First create the assistant
        await createAssistant();
        if (!assistant) {
            throw new Error('Failed to create assistant');
        }
        console.log('Assistant initialized successfully');

        // Create demo users
        await createDemoUsers();

        // Start server
        app.listen(PORT, () => {
            console.log(`Server running on port ${PORT}`);
            console.log(`Visit http://localhost:${PORT}/auth.html to login`);
            console.log(`Demo credentials:`);
            console.log(`Farmer: farmer@demo.com / password123`);
            console.log(`Warehouse Manager: warehouse@demo.com / password123`);
        });
    } catch (error) {
        console.error('Failed to initialize server:', error);
        process.exit(1);
    }
}

// Start initialization
initializeServer();
