// Chatbot Action System for KrishiMitra
class ChatbotActionService {
    constructor() {
        this.currentUser = null;
        this.init();
    }
    
    init() {
        // Get current user from storage
        const userData = localStorage.getItem('user');
        if (userData) {
            this.currentUser = JSON.parse(userData);
        }
    }
    
    // Parse user intent from message
    parseIntent(message) {
        const lowerMessage = message.toLowerCase();
        
        // Intent patterns
        const intents = {
            // WHR related
            viewWHRs: [
                'show my whrs', 'view my warehouse receipts', 'list my whrs', 'list all whrs',
                'what whrs do i have', 'my warehouse receipts', 'show whrs', 'list whrs',
                'list all the whr', 'show all my whrs', 'all my whrs', 'my whrs',
                'warehouse receipts', 'whr list', 'show warehouse receipts',
                'मेरे डब्ल्यूएचआर दिखाओ', 'मेरी वेयरहाउस रसीदें दिखाओ'
            ],
            
            // Loan related
            viewLoans: [
                'show my loans', 'view my loans', 'list my loans', 
                'what loans do i have', 'my active loans', 'loan status',
                'मेरे ऋण दिखाओ', 'मेरे लोन दिखाओ'
            ],
            
            applyLoan: [
                'apply for loan', 'i want a loan', 'get loan', 'loan against whr',
                'apply loan', 'need money', 'financial help',
                'ऋण के लिए आवेदन', 'लोन चाहिए', 'पैसे चाहिए'
            ],
            
            repayLoan: [
                'repay loan', 'pay loan', 'make payment', 'loan payment',
                'ऋण का भुगतान', 'लोन का पेमेंट'
            ],
            
            // Transaction related
            viewTransactions: [
                'show transactions', 'transaction history', 'my payments',
                'view transactions', 'payment history',
                'लेनदेन दिखाओ', 'पेमेंट हिस्ट्री'
            ],
            
            // Account related
            checkBalance: [
                'check balance', 'account balance', 'my balance', 'how much money',
                'बैलेंस चेक करो', 'खाते की राशि'
            ],
            
            // Auction related
            createAuction: [
                'create auction', 'start auction', 'sell crops', 'auction my crops',
                'नीलामी शुरू करो', 'फसल बेचना है'
            ],
            
            viewAuctions: [
                'show auctions', 'my auctions', 'auction status',
                'नीलामी दिखाओ'
            ],
            
            // Government schemes
            checkSchemes: [
                'government schemes', 'pm kisan', 'kisan credit card', 'schemes',
                'सरकारी योजना', 'पीएम किसान', 'योजनाएं'
            ]
        };
        
        // First try exact pattern matching
        for (const [intent, patterns] of Object.entries(intents)) {
            for (const pattern of patterns) {
                if (lowerMessage.includes(pattern)) {
                    console.log(`Matched intent ${intent} with pattern: ${pattern}`);
                    return intent;
                }
            }
        }
        
        // Then try keyword-based matching for WHRs
        const whrKeywords = ['whr', 'warehouse receipt', 'receipt'];
        const listKeywords = ['list', 'show', 'view', 'all', 'my'];
        
        const hasWhrKeyword = whrKeywords.some(keyword => lowerMessage.includes(keyword));
        const hasListKeyword = listKeywords.some(keyword => lowerMessage.includes(keyword));
        
        if (hasWhrKeyword && hasListKeyword) {
            console.log('Matched WHR intent via keyword matching');
            return 'viewWHRs';
        }
        
        // Similar for loans
        const loanKeywords = ['loan', 'ऋण', 'लोन'];
        const hasLoanKeyword = loanKeywords.some(keyword => lowerMessage.includes(keyword));
        
        if (hasLoanKeyword && hasListKeyword) {
            console.log('Matched loan intent via keyword matching');
            return 'viewLoans';
        }
        
        console.log('No intent matched, returning general');
        return 'general'; // Default to general chat
    }
    
    // Execute action based on intent
    async executeAction(intent, message) {
        try {
            switch (intent) {
                case 'viewWHRs':
                    return await this.handleViewWHRs();
                    
                case 'viewLoans':
                    return await this.handleViewLoans();
                    
                case 'applyLoan':
                    return await this.handleApplyLoan(message);
                    
                case 'repayLoan':
                    return await this.handleRepayLoan(message);
                    
                case 'viewTransactions':
                    return await this.handleViewTransactions();
                    
                case 'checkBalance':
                    return await this.handleCheckBalance();
                    
                case 'createAuction':
                    return await this.handleCreateAuction(message);
                    
                case 'viewAuctions':
                    return await this.handleViewAuctions();
                    
                case 'checkSchemes':
                    return await this.handleCheckSchemes();
                    
                default:
                    return null; // Let normal chat handle it
            }
        } catch (error) {
            console.error('Action execution error:', error);
            return {
                success: false,
                message: 'Sorry, I encountered an error while processing your request. Please try again.',
                data: null
            };
        }
    }
    
    // WHR Actions
    async handleViewWHRs() {
        console.log('Fetching WHRs from API...');
        try {
            const response = await fetch('/api/farmer/whr', {
                method: 'GET',
                credentials: 'include'
            });
            
            console.log('WHR API response status:', response.status);
            
            if (response.ok) {
                const whrs = await response.json();
                console.log('Retrieved WHRs:', whrs);
                return {
                    success: true,
                    action: 'viewWHRs',
                    message: `You have ${whrs.length} warehouse receipt(s):`,
                    data: whrs
                };
            } else {
                const errorText = await response.text();
                console.error('WHR API error:', errorText);
                return {
                    success: false,
                    message: `Unable to fetch your WHRs. Error: ${response.status}`,
                    data: null
                };
            }
        } catch (error) {
            console.error('Network error fetching WHRs:', error);
            return {
                success: false,
                message: 'Network error. Please check your connection and try again.',
                data: null
            };
        }
    }
    
    // Loan Actions
    async handleViewLoans() {
        const response = await fetch('/api/loans/farmer', {
            method: 'GET',
            credentials: 'include'
        });
        
        if (response.ok) {
            const loans = await response.json();
            return {
                success: true,
                action: 'viewLoans',
                message: `You have ${loans.length} loan(s):`,
                data: loans
            };
        } else {
            return {
                success: false,
                message: 'Unable to fetch your loans. Please try again later.',
                data: null
            };
        }
    }
    
    async handleApplyLoan(message) {
        // First get available WHRs
        const whrResponse = await fetch('/api/whr/farmer', {
            method: 'GET',
            credentials: 'include'
        });
        
        if (whrResponse.ok) {
            const whrs = await whrResponse.json();
            const availableWHRs = whrs.filter(whr => whr.status === 'active');
            
            if (availableWHRs.length === 0) {
                return {
                    success: false,
                    message: 'You don\'t have any available WHRs to use as collateral. Please deposit crops at a warehouse first.',
                    data: null
                };
            }
            
            return {
                success: true,
                action: 'loanForm',
                message: 'I can help you apply for a loan! Here are your available WHRs:',
                data: availableWHRs
            };
        } else {
            return {
                success: false,
                message: 'Unable to check your WHRs. Please try again later.',
                data: null
            };
        }
    }
    
    async submitLoanApplication(loanData) {
        const response = await fetch('/api/loans', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(loanData)
        });
        
        if (response.ok) {
            const result = await response.json();
            return {
                success: true,
                action: 'loanApplied',
                message: `Great! Your loan application for ₹${loanData.amount} has been submitted successfully. Loan ID: ${result._id}`,
                data: result
            };
        } else {
            const error = await response.json();
            return {
                success: false,
                message: `Loan application failed: ${error.message}`,
                data: null
            };
        }
    }
    
    async handleRepayLoan(message) {
        // Extract amount if mentioned in message
        const amountMatch = message.match(/₹?(\d+(?:,\d+)*(?:\.\d+)?)/);
        const amount = amountMatch ? parseFloat(amountMatch[1].replace(/,/g, '')) : null;
        
        const response = await fetch('/api/farmer/loans', {
            method: 'GET',
            credentials: 'include'
        });
        
        if (response.ok) {
            const loans = await response.json();
            const activeLoans = loans.filter(loan => loan.status === 'active');
            
            if (activeLoans.length === 0) {
                return {
                    success: false,
                    message: 'You don\'t have any active loans to repay.',
                    data: null
                };
            }
            
            return {
                success: true,
                action: 'repaymentForm',
                message: 'Here are your active loans for repayment:',
                data: { loans: activeLoans, suggestedAmount: amount }
            };
        } else {
            return {
                success: false,
                message: 'Unable to fetch your loans. Please try again later.',
                data: null
            };
        }
    }
    
    async submitLoanRepayment(repaymentData) {
        const response = await fetch(`/api/loans/${repaymentData.loanId}/repay`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ amount: repaymentData.amount })
        });
        
        if (response.ok) {
            const result = await response.json();
            return {
                success: true,
                action: 'repaymentComplete',
                message: `Payment of ₹${repaymentData.amount} successful! Remaining balance: ₹${result.remainingAmount}`,
                data: result
            };
        } else {
            const error = await response.json();
            return {
                success: false,
                message: `Repayment failed: ${error.message}`,
                data: null
            };
        }
    }
    
    // Transaction Actions
    async handleViewTransactions() {
        const response = await fetch('/api/farmer/transactions', {
            method: 'GET',
            credentials: 'include'
        });
        
        if (response.ok) {
            const transactions = await response.json();
            return {
                success: true,
                action: 'viewTransactions',
                message: `Your recent transactions:`,
                data: transactions.slice(0, 10) // Show last 10 transactions
            };
        } else {
            return {
                success: false,
                message: 'Unable to fetch your transaction history.',
                data: null
            };
        }
    }
    
    // Balance Actions
    async handleCheckBalance() {
        if (this.currentUser) {
            return {
                success: true,
                action: 'checkBalance',
                message: `Your current account balance is ₹${this.currentUser.profile?.balance || 0}`,
                data: { balance: this.currentUser.profile?.balance || 0 }
            };
        } else {
            return {
                success: false,
                message: 'Unable to fetch your balance. Please refresh and try again.',
                data: null
            };
        }
    }
    
    // Auction Actions
    async handleCreateAuction(message) {
        // Get available WHRs
        const whrResponse = await fetch('/api/farmer/whr', {
            method: 'GET',
            credentials: 'include'
        });
        
        if (whrResponse.ok) {
            const whrs = await whrResponse.json();
            const availableWHRs = whrs.filter(whr => whr.status === 'active');
            
            if (availableWHRs.length === 0) {
                return {
                    success: false,
                    message: 'You don\'t have any available crops (WHRs) to auction.',
                    data: null
                };
            }
            
            return {
                success: true,
                action: 'auctionForm',
                message: 'I can help you create an auction! Here are your available crops:',
                data: availableWHRs
            };
        } else {
            return {
                success: false,
                message: 'Unable to check your available crops.',
                data: null
            };
        }
    }
    
    async handleViewAuctions() {
        const response = await fetch('/api/farmer/auctions', {
            method: 'GET',
            credentials: 'include'
        });
        
        if (response.ok) {
            const auctions = await response.json();
            return {
                success: true,
                action: 'viewAuctions',
                message: `Your auctions:`,
                data: auctions
            };
        } else {
            return {
                success: false,
                message: 'Unable to fetch your auctions.',
                data: null
            };
        }
    }
    
    // Government Schemes
    async handleCheckSchemes() {
        return {
            success: true,
            action: 'schemes',
            message: 'Here are the government schemes you can access through KrishiMitra:',
            data: [
                {
                    name: 'PM-KISAN',
                    description: '₹6,000 annual direct transfer',
                    status: 'Next payment: Mar 2025 (₹2,000)',
                    eligible: true
                },
                {
                    name: 'Kisan Credit Card',
                    description: 'Up to ₹3 lakh collateral-free credit',
                    status: 'Apply through DocuLocker',
                    eligible: true
                },
                {
                    name: 'PM Fasal Bima',
                    description: 'Comprehensive crop insurance',
                    status: 'Low premium (1.5-5%)',
                    eligible: true
                }
            ]
        };
    }
}

// Enhanced chat message renderer with action support
class ChatMessageRenderer {
    static renderActionMessage(actionResult) {
        const { success, action, message, data } = actionResult;
        
        if (!success) {
            return `<div class="text-red-600">${message}</div>`;
        }
        
        let html = `<div class="mb-3">${message}</div>`;
        
        switch (action) {
            case 'viewWHRs':
                html += this.renderWHRList(data);
                break;
                
            case 'viewLoans':
                html += this.renderLoanList(data);
                break;
                
            case 'loanForm':
                html += this.renderLoanForm(data);
                break;
                
            case 'repaymentForm':
                html += this.renderRepaymentForm(data);
                break;
                
            case 'viewTransactions':
                html += this.renderTransactionList(data);
                break;
                
            case 'auctionForm':
                html += this.renderAuctionForm(data);
                break;
                
            case 'viewAuctions':
                html += this.renderAuctionList(data);
                break;
                
            case 'schemes':
                html += this.renderSchemesList(data);
                break;
        }
        
        return html;
    }
    
    static renderWHRList(whrs) {
        if (whrs.length === 0) {
            return '<div class="text-gray-500 mt-2">No warehouse receipts found.</div>';
        }
        
        let html = '<div class="mt-3 space-y-2 max-h-40 overflow-y-auto">';
        whrs.forEach(whr => {
            const statusColor = whr.status === 'active' ? 'green' : 
                               whr.status === 'locked_for_loan' ? 'yellow' : 'gray';
            html += `
                <div class="bg-gray-50 p-3 rounded border">
                    <div class="flex justify-between items-start">
                        <div>
                            <div class="font-medium">${whr.cropType} (${whr.quantity} kg)</div>
                            <div class="text-sm text-gray-600">Quality: ${whr.quality} | Value: ₹${whr.estimatedValue}</div>
                            <div class="text-sm text-gray-600">Warehouse: ${whr.warehouseId}</div>
                        </div>
                        <span class="text-xs px-2 py-1 rounded bg-${statusColor}-100 text-${statusColor}-600">
                            ${whr.status.replace('_', ' ')}
                        </span>
                    </div>
                </div>
            `;
        });
        html += '</div>';
        
        return html;
    }
    
    static renderLoanList(loans) {
        if (loans.length === 0) {
            return '<div class="text-gray-500 mt-2">No loans found.</div>';
        }
        
        let html = '<div class="mt-3 space-y-2 max-h-40 overflow-y-auto">';
        loans.forEach(loan => {
            const statusColor = loan.status === 'active' ? 'blue' : 
                               loan.status === 'completed' ? 'green' : 'gray';
            html += `
                <div class="bg-gray-50 p-3 rounded border">
                    <div class="flex justify-between items-start">
                        <div>
                            <div class="font-medium">₹${loan.amount}</div>
                            <div class="text-sm text-gray-600">Purpose: ${loan.purpose}</div>
                            <div class="text-sm text-gray-600">Remaining: ₹${loan.remainingAmount}</div>
                        </div>
                        <span class="text-xs px-2 py-1 rounded bg-${statusColor}-100 text-${statusColor}-600">
                            ${loan.status}
                        </span>
                    </div>
                    ${loan.status === 'active' ? `
                        <button onclick="window.chatbotService.quickRepayment('${loan._id}', ${loan.remainingAmount})" 
                                class="mt-2 text-xs bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700">
                            Repay Now
                        </button>
                    ` : ''}
                </div>
            `;
        });
        html += '</div>';
        
        return html;
    }
    
    static renderLoanForm(whrs) {
        let html = `
            <div class="mt-3 bg-blue-50 p-4 rounded">
                <div class="mb-3">
                    <label class="block text-sm font-medium mb-1">Select WHR for Collateral:</label>
                    <select id="chatLoanWHR" class="w-full p-2 border rounded text-sm">
        `;
        
        whrs.forEach(whr => {
            html += `<option value="${whr._id}">${whr.cropType} - ${whr.quantity}kg (₹${whr.estimatedValue})</option>`;
        });
        
        html += `
                    </select>
                </div>
                <div class="mb-3">
                    <label class="block text-sm font-medium mb-1">Loan Amount (₹):</label>
                    <input type="number" id="chatLoanAmount" class="w-full p-2 border rounded text-sm" placeholder="Enter amount">
                </div>
                <div class="mb-3">
                    <label class="block text-sm font-medium mb-1">Purpose:</label>
                    <select id="chatLoanPurpose" class="w-full p-2 border rounded text-sm">
                        <option value="farming_inputs">Farming Inputs</option>
                        <option value="family_expenses">Family Expenses</option>
                        <option value="business_expansion">Business Expansion</option>
                        <option value="emergency">Emergency</option>
                    </select>
                </div>
                <button onclick="window.chatbotService.submitChatLoan()" 
                        class="bg-green-600 text-white px-4 py-2 rounded text-sm hover:bg-green-700">
                    Apply for Loan
                </button>
            </div>
        `;
        
        return html;
    }
    
    static renderRepaymentForm(data) {
        const { loans, suggestedAmount } = data;
        
        let html = `
            <div class="mt-3 bg-green-50 p-4 rounded">
                <div class="mb-3">
                    <label class="block text-sm font-medium mb-1">Select Loan:</label>
                    <select id="chatRepayLoan" class="w-full p-2 border rounded text-sm">
        `;
        
        loans.forEach(loan => {
            html += `<option value="${loan._id}">₹${loan.amount} - Remaining: ₹${loan.remainingAmount}</option>`;
        });
        
        html += `
                    </select>
                </div>
                <div class="mb-3">
                    <label class="block text-sm font-medium mb-1">Payment Amount (₹):</label>
                    <input type="number" id="chatRepayAmount" class="w-full p-2 border rounded text-sm" 
                           placeholder="Enter amount" ${suggestedAmount ? `value="${suggestedAmount}"` : ''}>
                </div>
                <button onclick="window.chatbotService.submitChatRepayment()" 
                        class="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700">
                    Make Payment
                </button>
            </div>
        `;
        
        return html;
    }
    
    static renderTransactionList(transactions) {
        if (transactions.length === 0) {
            return '<div class="text-gray-500 mt-2">No transactions found.</div>';
        }
        
        let html = '<div class="mt-3 space-y-2 max-h-40 overflow-y-auto">';
        transactions.forEach(txn => {
            const typeColor = txn.type === 'loan_disbursement' ? 'green' : 
                             txn.type === 'loan_repayment' ? 'red' : 'blue';
            html += `
                <div class="bg-gray-50 p-2 rounded border">
                    <div class="flex justify-between items-center">
                        <div>
                            <div class="text-sm font-medium">₹${txn.amount}</div>
                            <div class="text-xs text-gray-600">${txn.type.replace('_', ' ')}</div>
                        </div>
                        <div class="text-xs text-gray-500">
                            ${new Date(txn.date).toLocaleDateString()}
                        </div>
                    </div>
                </div>
            `;
        });
        html += '</div>';
        
        return html;
    }
    
    static renderAuctionForm(whrs) {
        let html = `
            <div class="mt-3 bg-purple-50 p-4 rounded">
                <div class="mb-3">
                    <label class="block text-sm font-medium mb-1">Select Crop to Auction:</label>
                    <select id="chatAuctionWHR" class="w-full p-2 border rounded text-sm">
        `;
        
        whrs.forEach(whr => {
            html += `<option value="${whr._id}">${whr.cropType} - ${whr.quantity}kg</option>`;
        });
        
        html += `
                    </select>
                </div>
                <div class="mb-3">
                    <label class="block text-sm font-medium mb-1">Base Price (₹):</label>
                    <input type="number" id="chatAuctionPrice" class="w-full p-2 border rounded text-sm" placeholder="Minimum price">
                </div>
                <button onclick="window.chatbotService.submitChatAuction()" 
                        class="bg-purple-600 text-white px-4 py-2 rounded text-sm hover:bg-purple-700">
                    Start Auction
                </button>
            </div>
        `;
        
        return html;
    }
    
    static renderAuctionList(auctions) {
        if (auctions.length === 0) {
            return '<div class="text-gray-500 mt-2">No auctions found.</div>';
        }
        
        let html = '<div class="mt-3 space-y-2 max-h-40 overflow-y-auto">';
        auctions.forEach(auction => {
            const statusColor = auction.status === 'active' ? 'green' : 
                               auction.status === 'completed' ? 'blue' : 'gray';
            html += `
                <div class="bg-gray-50 p-3 rounded border">
                    <div class="flex justify-between items-start">
                        <div>
                            <div class="font-medium">${auction.cropType}</div>
                            <div class="text-sm text-gray-600">Base: ₹${auction.basePrice}</div>
                            <div class="text-sm text-gray-600">Current: ₹${auction.currentPrice}</div>
                        </div>
                        <span class="text-xs px-2 py-1 rounded bg-${statusColor}-100 text-${statusColor}-600">
                            ${auction.status}
                        </span>
                    </div>
                </div>
            `;
        });
        html += '</div>';
        
        return html;
    }
    
    static renderSchemesList(schemes) {
        let html = '<div class="mt-3 space-y-2">';
        schemes.forEach(scheme => {
            const bgColor = scheme.eligible ? 'green' : 'gray';
            html += `
                <div class="bg-${bgColor}-50 p-3 rounded border border-${bgColor}-200">
                    <div class="font-medium text-${bgColor}-800">${scheme.name}</div>
                    <div class="text-sm text-${bgColor}-700">${scheme.description}</div>
                    <div class="text-xs text-${bgColor}-600 mt-1">${scheme.status}</div>
                </div>
            `;
        });
        html += '</div>';
        
        return html;
    }
}

// Global instance - initialize after DOM loads
console.log('Loading ChatbotActionService script...');
window.ChatMessageRenderer = ChatMessageRenderer;

// Initialize when document is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeChatbotService);
} else {
    initializeChatbotService();
}

function initializeChatbotService() {
    console.log('Initializing ChatbotActionService...');
    window.chatbotActionService = new ChatbotActionService();
    console.log('ChatbotActionService initialized:', !!window.chatbotActionService);
} 