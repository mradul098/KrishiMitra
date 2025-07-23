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

// System prompt for the farming assistant
const SYSTEM_PROMPT = `You are KrishiMitra, an AI assistant helping Indian farmers with financial services. You provide guidance in simple language about:
1. Crop insurance (PM Fasal Bima Yojana)
2. Weather alerts and farming advice
3. Current market prices (mandi rates)
4. Warehouse receipt loans (e-NWR)
5. Government schemes for farmers

Always respond in a friendly, helpful manner. If asked in Hindi, respond in Hindi. Keep responses concise and practical.`;

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
        const { message, location, language = 'en' } = req.body;
        
        // Get context data
        const weatherData = await getWeatherData(location);
        const marketPrices = await getMarketPrices(location);
        
        // Create context-aware prompt
        const contextPrompt = `
Current context:
- Location: ${location || 'Not specified'}
- Weather: ${weatherData ? `${weatherData.temp}°C, ${weatherData.description}` : 'Not available'}
- Market prices: ${marketPrices || 'Check specific crop prices'}

User message: ${message}
`;

        const completion = await openai.chat.completions.create({
            model: "gpt-3.5-turbo",
            messages: [
                { role: "system", content: SYSTEM_PROMPT },
                { role: "user", content: contextPrompt }
            ],
            temperature: 0.7,
            max_tokens: 500
        });

        const botResponse = completion.choices[0].message.content;
        
        res.json({
            success: true,
            message: botResponse,
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

// Weather data endpoint
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

// Mock market prices (in production, integrate with Agmarknet API)
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

// Start server
app.listen(PORT, async () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Visit http://localhost:${PORT}/auth.html to login`);
    console.log(`Demo credentials:`);
    console.log(`Farmer: farmer@demo.com / password123`);
    console.log(`Warehouse Manager: warehouse@demo.com / password123`);
    
    // Create demo users
    await createDemoUsers();
}); 