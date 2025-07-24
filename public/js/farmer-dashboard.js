// Farmer Dashboard JavaScript
let currentUser = null;
let currentSection = 'overview';
let chatbotOpen = false;

document.addEventListener('DOMContentLoaded', () => {
    initializeDashboard();
    setupEventListeners();
    
    // Initialize translation system
    if (window.languageManager) {
        window.languageManager.applyTranslations();
    }
    
    // Initialize voice system
    if (window.voiceManager) {
        console.log('Voice features available:', window.voiceManager.isSupported());
    }
});

async function initializeDashboard() {
    // Check authentication
    await checkAuth();
    
    // Load user data
    loadUserProfile();
    
    // Load dashboard data
    loadDashboardStats();
    loadWarehouses();
    loadWHRs();
    loadLoans();
    loadTransactions();
}

function setupEventListeners() {
    // Navigation
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', () => {
            const section = item.dataset.section;
            switchSection(section);
        });
    });

    // Forms
    document.getElementById('auctionForm').addEventListener('submit', handleAuctionSubmit);
    document.getElementById('loanForm').addEventListener('submit', handleLoanSubmit);
    
    // WHR selection for loan calculation
    document.getElementById('loanWHR').addEventListener('change', calculateLoanEligibility);
    document.getElementById('requestedAmount').addEventListener('input', calculateLoanEligibility);
    
    // WHR filters
    document.querySelectorAll('.whr-filter').forEach(filter => {
        filter.addEventListener('click', (e) => {
            document.querySelectorAll('.whr-filter').forEach(f => f.classList.remove('active'));
            e.target.classList.add('active');
            filterWHRs(e.target.dataset.status);
        });
    });
}

async function checkAuth() {
    try {
        const response = await fetch('/api/auth/me', {
            credentials: 'include'
        });
        
        if (response.ok) {
            const data = await response.json();
            currentUser = data.user;
            
            if (currentUser.role !== 'farmer') {
                window.location.href = '/auth.html';
                return;
            }
        } else {
            window.location.href = '/auth.html';
        }
    } catch (error) {
        console.error('Auth check failed:', error);
        window.location.href = '/auth.html';
    }
}

function loadUserProfile() {
    if (!currentUser) return;
    
    document.getElementById('userName').textContent = 
        `${currentUser.profile.firstName} ${currentUser.profile.lastName}`;
    document.getElementById('userId').textContent = `ID: ${currentUser.userId}`;
    document.getElementById('welcomeName').textContent = currentUser.profile.firstName;
    document.getElementById('accountBalance').textContent = `₹${currentUser.accountBalance?.toLocaleString() || '0'}`;
    document.getElementById('creditScore').textContent = currentUser.creditScore || '500';
}

async function loadDashboardStats() {
    try {
        const [whrsResponse, loansResponse, transactionsResponse] = await Promise.all([
            fetch('/api/farmer/whrs', { credentials: 'include' }),
            fetch('/api/farmer/loans', { credentials: 'include' }),
            fetch('/api/farmer/transactions', { credentials: 'include' })
        ]);

        if (whrsResponse.ok) {
            const whrsData = await whrsResponse.json();
            const activeWHRs = whrsData.whrs?.filter(whr => whr.status === 'active').length || 0;
            document.getElementById('activeWHRs').textContent = activeWHRs;
        }

        if (loansResponse.ok) {
            const loansData = await loansResponse.json();
            const totalLoanAmount = loansData.loans?.reduce((sum, loan) => {
                return sum + (loan.status === 'active' ? loan.loanDetails.principalAmount : 0);
            }, 0) || 0;
            document.getElementById('totalLoans').textContent = `₹${totalLoanAmount.toLocaleString()}`;
        }

        if (transactionsResponse.ok) {
            const transactionsData = await transactionsResponse.json();
            const thisMonth = new Date();
            thisMonth.setDate(1);
            
            const monthlyEarnings = transactionsData.transactions?.filter(t => {
                return t.type === 'auction_payment' && new Date(t.createdAt) >= thisMonth;
            }).reduce((sum, t) => sum + t.amount, 0) || 0;
            
            document.getElementById('monthlyEarnings').textContent = `₹${monthlyEarnings.toLocaleString()}`;
        }
    } catch (error) {
        console.error('Error loading dashboard stats:', error);
    }
}

function switchSection(section) {
    // Update navigation
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
    });
    document.querySelector(`[data-section="${section}"]`).classList.add('active');
    
    // Show section
    document.querySelectorAll('.section').forEach(sec => {
        sec.classList.add('hidden');
    });
    document.getElementById(section).classList.remove('hidden');
    
    currentSection = section;
    
    // Load section-specific data
    if (section === 'warehouses') {
        loadWarehouses();
    } else if (section === 'doculocker') {
        loadWHRs();
    } else if (section === 'loans') {
        loadLoans();
        loadWHRsForLoan();
    } else if (section === 'auction') {
        loadWHRsForAuction();
    } else if (section === 'transactions') {
        loadTransactions();
    } else if (section === 'account') {
        loadAccountSettings();
    }
}

async function loadWarehouses() {
    try {
        const response = await fetch('/api/warehouses/nearby', {
            credentials: 'include'
        });
        
        if (response.ok) {
            const data = await response.json();
            displayWarehouses(data.warehouses || []);
        }
    } catch (error) {
        console.error('Error loading warehouses:', error);
        displayWarehouses([]);
    }
}

function displayWarehouses(warehouses) {
    const container = document.getElementById('warehousesList');
    
    if (warehouses.length === 0) {
        container.innerHTML = `
            <div class="col-span-full text-center py-12">
                <i class="fas fa-warehouse text-4xl text-gray-400 mb-4"></i>
                <p class="text-gray-500">No warehouses found in your area</p>
                <button onclick="searchWarehouses()" class="enhanced-btn px-4 py-2 mt-4">
                    Search Again
                </button>
            </div>
        `;
        return;
    }
    
    container.innerHTML = warehouses.map(warehouse => `
        <div class="dashboard-card rounded-xl p-6">
            <div class="flex justify-between items-start mb-4">
                <div>
                    <h3 class="text-lg font-semibold text-gray-800">${warehouse.warehouseName}</h3>
                    <p class="text-sm text-gray-600">${warehouse.location}</p>
                </div>
                <span class="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">
                    ${warehouse.distance}km away
                </span>
            </div>
            
            <div class="space-y-2 mb-4">
                <div class="flex justify-between text-sm">
                    <span class="text-gray-600">Capacity:</span>
                    <span class="font-medium">${warehouse.capacity} quintals</span>
                </div>
                <div class="flex justify-between text-sm">
                    <span class="text-gray-600">Available:</span>
                    <span class="font-medium">${warehouse.availableCapacity} quintals</span>
                </div>
                <div class="flex justify-between text-sm">
                    <span class="text-gray-600">Storage Rate:</span>
                    <span class="font-medium">₹${warehouse.storageRate}/quintal/month</span>
                </div>
            </div>
            
            <div class="mb-4">
                <p class="text-xs text-gray-500 mb-1">Facilities:</p>
                <div class="flex flex-wrap gap-1">
                    ${warehouse.facilities.map(facility => `
                        <span class="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded">
                            ${facility.replace('_', ' ')}
                        </span>
                    `).join('')}
                </div>
            </div>
            
            <div class="flex space-x-2">
                <button onclick="contactWarehouse('${warehouse.id}')" 
                        class="flex-1 enhanced-btn px-4 py-2 text-sm">
                    <i class="fas fa-phone mr-1"></i>Contact
                </button>
                <button onclick="viewWarehouseDetails('${warehouse.id}')" 
                        class="flex-1 enhanced-btn px-4 py-2 text-sm">
                    <i class="fas fa-info-circle mr-1"></i>Details
                </button>
            </div>
        </div>
    `).join('');
}

async function searchWarehouses() {
    const location = document.getElementById('farmerLocation').value || currentUser.profile.address.city;
    const radius = document.getElementById('searchRadius').value;
    
    showLoading(true);
    
    try {
        const response = await fetch(`/api/warehouses/search?location=${encodeURIComponent(location)}&radius=${radius}`, {
            credentials: 'include'
        });
        
        if (response.ok) {
            const data = await response.json();
            displayWarehouses(data.warehouses || []);
        } else {
            showNotification('Failed to search warehouses', 'error');
        }
    } catch (error) {
        console.error('Warehouse search error:', error);
        showNotification('Error searching warehouses', 'error');
    } finally {
        showLoading(false);
    }
}

async function loadWHRs() {
    try {
        const response = await fetch('/api/farmer/whrs', {
            credentials: 'include'
        });
        
        if (response.ok) {
            const data = await response.json();
            displayWHRs(data.whrs || []);
        }
    } catch (error) {
        console.error('Error loading WHRs:', error);
        displayWHRs([]);
    }
}

function displayWHRs(whrs) {
    const container = document.getElementById('whrList');
    
    if (whrs.length === 0) {
        container.innerHTML = `
            <div class="text-center py-12">
                <i class="fas fa-file-contract text-4xl text-gray-400 mb-4"></i>
                <p class="text-gray-500">No warehouse receipts found</p>
                <p class="text-sm text-gray-400">Deposit your crops at a warehouse to generate WHRs</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = whrs.map(whr => `
        <div class="dashboard-card rounded-xl p-6">
            <div class="flex justify-between items-start mb-4">
                <div>
                    <h3 class="text-lg font-semibold text-gray-800">WHR-${whr.whrId}</h3>
                    <p class="text-sm text-gray-600">${whr.warehouseDetails.warehouseName}</p>
                </div>
                <span class="px-3 py-1 rounded-full text-xs font-medium ${getStatusBadgeClass(whr.status)}">
                    ${whr.status.replace('_', ' ').toUpperCase()}
                </span>
            </div>
            
            <div class="grid grid-cols-2 gap-4 mb-4">
                <div>
                    <p class="text-xs text-gray-500">Crop Type</p>
                    <p class="font-medium">${whr.cropDetails.cropType} (${whr.cropDetails.variety})</p>
                </div>
                <div>
                    <p class="text-xs text-gray-500">Quantity</p>
                    <p class="font-medium">${whr.cropDetails.quantity} quintals</p>
                </div>
                <div>
                    <p class="text-xs text-gray-500">Quality Grade</p>
                    <p class="font-medium">Grade ${whr.cropDetails.qualityGrade}</p>
                </div>
                <div>
                    <p class="text-xs text-gray-500">Estimated Value</p>
                    <p class="font-medium text-green-600">₹${whr.financialDetails.estimatedValue.toLocaleString()}</p>
                </div>
            </div>
            
            <div class="flex space-x-2">
                ${whr.status === 'active' ? `
                    <button onclick="startAuction('${whr.whrId}')" 
                            class="flex-1 enhanced-btn px-4 py-2 text-sm">
                        <i class="fas fa-gavel mr-1"></i>Auction
                    </button>
                    <button onclick="applyLoan('${whr.whrId}')" 
                            class="flex-1 enhanced-btn px-4 py-2 text-sm">
                        <i class="fas fa-hand-holding-usd mr-1"></i>Loan
                    </button>
                ` : ''}
                <button onclick="viewWHRDetails('${whr.whrId}')" 
                        class="enhanced-btn px-4 py-2 text-sm">
                    <i class="fas fa-eye mr-1"></i>View
                </button>
            </div>
        </div>
    `).join('');
}

function getStatusBadgeClass(status) {
    const classes = {
        'active': 'bg-green-100 text-green-800',
        'locked_for_loan': 'bg-yellow-100 text-yellow-800',
        'sold': 'bg-blue-100 text-blue-800',
        'pending_approval': 'bg-gray-100 text-gray-800'
    };
    return classes[status] || 'bg-gray-100 text-gray-800';
}

function filterWHRs(status) {
    // This would filter the displayed WHRs
    // For now, just reload with filter
    loadWHRs();
}

async function loadWHRsForAuction() {
    try {
        const response = await fetch('/api/farmer/whrs?status=active', {
            credentials: 'include'
        });
        
        if (response.ok) {
            const data = await response.json();
            const select = document.getElementById('auctionWHR');
            select.innerHTML = '<option value="">Select a warehouse receipt</option>';
            
            data.whrs?.forEach(whr => {
                select.innerHTML += `
                    <option value="${whr.whrId}" data-value="${whr.financialDetails.estimatedValue}">
                        ${whr.cropDetails.cropType} - ${whr.cropDetails.quantity}q - ₹${whr.financialDetails.estimatedValue.toLocaleString()}
                    </option>
                `;
            });
        }
    } catch (error) {
        console.error('Error loading WHRs for auction:', error);
    }
}

async function loadWHRsForLoan() {
    try {
        const response = await fetch('/api/farmer/whrs?status=active', {
            credentials: 'include'
        });
        
        if (response.ok) {
            const data = await response.json();
            const select = document.getElementById('loanWHR');
            select.innerHTML = '<option value="">Select warehouse receipt</option>';
            
            data.whrs?.forEach(whr => {
                select.innerHTML += `
                    <option value="${whr.whrId}" data-value="${whr.financialDetails.estimatedValue}">
                        ${whr.cropDetails.cropType} - ${whr.cropDetails.quantity}q - ₹${whr.financialDetails.estimatedValue.toLocaleString()}
                    </option>
                `;
            });
        }
    } catch (error) {
        console.error('Error loading WHRs for loan:', error);
    }
}

function calculateLoanEligibility() {
    const whrSelect = document.getElementById('loanWHR');
    const requestedAmount = parseFloat(document.getElementById('requestedAmount').value) || 0;
    const selectedOption = whrSelect.selectedOptions[0];
    
    if (!selectedOption || !selectedOption.dataset.value) {
        document.getElementById('loanCalculation').classList.add('hidden');
        return;
    }
    
    const whrValue = parseFloat(selectedOption.dataset.value);
    const eligibleAmount = Math.floor(whrValue * 0.7); // 70% of WHR value
    const interestRate = 12; // 12% annual
    const tenure = parseInt(document.getElementById('loanTenure').value) || 12;
    
    const actualAmount = Math.min(requestedAmount, eligibleAmount);
    const totalInterest = Math.floor((actualAmount * interestRate * tenure) / (12 * 100));
    const totalRepayment = actualAmount + totalInterest;
    
    document.getElementById('eligibleAmount').textContent = `₹${eligibleAmount.toLocaleString()}`;
    document.getElementById('totalInterest').textContent = `₹${totalInterest.toLocaleString()}`;
    document.getElementById('totalRepayment').textContent = `₹${totalRepayment.toLocaleString()}`;
    
    document.getElementById('loanCalculation').classList.remove('hidden');
}

async function handleAuctionSubmit(e) {
    e.preventDefault();
    
    const formData = {
        whrId: document.getElementById('auctionWHR').value,
        basePrice: parseFloat(document.getElementById('basePrice').value),
        duration: parseInt(document.getElementById('auctionDuration').value)
    };
    
    showLoading(true);
    
    try {
        const response = await fetch('/api/farmer/auction/create', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(formData)
        });
        
        if (response.ok) {
            const data = await response.json();
            showNotification('Auction started successfully!', 'success');
            startAuctionSimulation(data.auction);
            document.getElementById('auctionForm').reset();
        } else {
            const error = await response.json();
            showNotification(error.message || 'Failed to start auction', 'error');
        }
    } catch (error) {
        console.error('Auction creation error:', error);
        showNotification('Error starting auction', 'error');
    } finally {
        showLoading(false);
    }
}

async function handleLoanSubmit(e) {
    e.preventDefault();
    
    const formData = {
        whrId: document.getElementById('loanWHR').value,
        requestedAmount: parseFloat(document.getElementById('requestedAmount').value),
        purpose: document.getElementById('loanPurpose').value,
        tenureMonths: parseInt(document.getElementById('loanTenure').value)
    };
    
    showLoading(true);
    
    try {
        const response = await fetch('/api/farmer/loan/apply', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(formData)
        });
        
        if (response.ok) {
            const data = await response.json();
            showNotification('Loan application submitted successfully!', 'success');
            document.getElementById('loanForm').reset();
            document.getElementById('loanCalculation').classList.add('hidden');
            loadLoans();
        } else {
            const error = await response.json();
            showNotification(error.message || 'Failed to apply for loan', 'error');
        }
    } catch (error) {
        console.error('Loan application error:', error);
        showNotification('Error applying for loan', 'error');
    } finally {
        showLoading(false);
    }
}

function startAuctionSimulation(auction) {
    // Create auction display
    const auctionContainer = document.getElementById('activeAuctions');
    const auctionDiv = document.createElement('div');
    auctionDiv.className = 'dashboard-card rounded-xl p-6';
    auctionDiv.id = `auction-${auction.id}`;
    
    auctionDiv.innerHTML = `
        <div class="flex justify-between items-center mb-4">
            <h3 class="text-lg font-semibold">Live Auction</h3>
            <span class="px-3 py-1 bg-red-100 text-red-800 text-sm rounded-full">
                <i class="fas fa-circle animate-pulse mr-1"></i>LIVE
            </span>
        </div>
        <div class="grid grid-cols-2 gap-4 mb-4">
            <div>
                <p class="text-sm text-gray-600">Base Price</p>
                <p class="text-lg font-bold">₹${auction.basePrice.toLocaleString()}</p>
            </div>
            <div>
                <p class="text-sm text-gray-600">Current Bid</p>
                <p class="text-lg font-bold text-green-600" id="currentBid-${auction.id}">₹${auction.basePrice.toLocaleString()}</p>
            </div>
        </div>
        <div class="mb-4">
            <div class="flex justify-between text-sm text-gray-600 mb-1">
                <span>Time Remaining</span>
                <span id="timeRemaining-${auction.id}">${auction.duration}s</span>
            </div>
            <div class="w-full bg-gray-200 rounded-full h-2">
                <div id="timeProgress-${auction.id}" class="bg-green-600 h-2 rounded-full transition-all duration-1000" 
                     style="width: 100%"></div>
            </div>
        </div>
        <div id="biddingActivity-${auction.id}" class="text-sm text-gray-600 mb-4">
            Waiting for bids...
        </div>
        <div id="auctionActions-${auction.id}">
            <button onclick="acceptCurrentBid('${auction.id}')" 
                    class="enhanced-btn px-4 py-2 w-full" disabled>
                Accept Current Bid
            </button>
        </div>
    `;
    
    auctionContainer.appendChild(auctionDiv);
    
    // Start simulation
    simulateAuctionBidding(auction);
}

function simulateAuctionBidding(auction) {
    let timeLeft = auction.duration;
    let currentBid = auction.basePrice;
    let bidCount = 0;
    
    const timer = setInterval(() => {
        timeLeft--;
        
        // Random bidding simulation
        if (timeLeft > 0 && Math.random() > 0.7) {
            const bidIncrease = Math.floor(Math.random() * 1000) + 500;
            currentBid += bidIncrease;
            bidCount++;
            
            document.getElementById(`currentBid-${auction.id}`).textContent = `₹${currentBid.toLocaleString()}`;
            document.getElementById(`biddingActivity-${auction.id}`).innerHTML = 
                `<i class="fas fa-gavel mr-1"></i>New bid: ₹${currentBid.toLocaleString()} (${bidCount} bids)`;
            
            // Enable accept button
            document.querySelector(`#auctionActions-${auction.id} button`).disabled = false;
        }
        
        // Update timer
        document.getElementById(`timeRemaining-${auction.id}`).textContent = `${timeLeft}s`;
        document.getElementById(`timeProgress-${auction.id}`).style.width = `${(timeLeft / auction.duration) * 100}%`;
        
        if (timeLeft <= 0) {
            clearInterval(timer);
            endAuction(auction.id, currentBid);
        }
    }, 1000);
}

function endAuction(auctionId, finalPrice) {
    document.getElementById(`auctionActions-${auctionId}`).innerHTML = `
        <div class="text-center">
            <p class="text-lg font-bold text-green-600 mb-2">Auction Ended!</p>
            <p class="text-sm text-gray-600 mb-4">Final Price: ₹${finalPrice.toLocaleString()}</p>
            <button onclick="acceptAuctionResult('${auctionId}', ${finalPrice})" 
                    class="enhanced-btn px-4 py-2 mr-2">
                Accept & Sell
            </button>
            <button onclick="rejectAuctionResult('${auctionId}')" 
                    class="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600">
                Reject
            </button>
        </div>
    `;
}

// Additional helper functions
async function acceptAuctionResult(auctionId, finalPrice) {
    showLoading(true);
    
    try {
        const response = await fetch(`/api/farmer/auction/${auctionId}/accept`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ finalPrice })
        });
        
        if (response.ok) {
            showNotification(`Auction completed! ₹${finalPrice.toLocaleString()} credited to your account.`, 'success');
            document.getElementById(`auction-${auctionId}`).remove();
            loadDashboardStats();
            loadWHRs();
            
            // Trigger celebration
            if (window.particleSystem) {
                window.particleSystem.addBurst(window.innerWidth / 2, window.innerHeight / 2);
            }
        } else {
            showNotification('Failed to complete auction', 'error');
        }
    } catch (error) {
        console.error('Accept auction error:', error);
        showNotification('Error completing auction', 'error');
    } finally {
        showLoading(false);
    }
}

function rejectAuctionResult(auctionId) {
    document.getElementById(`auction-${auctionId}`).remove();
    showNotification('Auction rejected. Your crop remains available.', 'info');
}

async function loadLoans() {
    try {
        const response = await fetch('/api/farmer/loans', {
            credentials: 'include'
        });
        
        if (response.ok) {
            const data = await response.json();
            displayLoans(data.loans || []);
        }
    } catch (error) {
        console.error('Error loading loans:', error);
    }
}

function displayLoans(loans) {
    const container = document.getElementById('activeLoans');
    
    if (loans.length === 0) {
        container.innerHTML = `
            <div class="text-center py-12">
                <i class="fas fa-hand-holding-usd text-4xl text-gray-400 mb-4"></i>
                <p class="text-gray-500">No loans found</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = loans.map(loan => `
        <div class="dashboard-card rounded-xl p-6">
            <div class="flex justify-between items-start mb-4">
                <div>
                    <h3 class="text-lg font-semibold">Loan ${loan.loanId}</h3>
                    <p class="text-sm text-gray-600">${loan.applicationDetails.purpose.replace('_', ' ')}</p>
                </div>
                <span class="px-3 py-1 rounded-full text-xs font-medium ${getLoanStatusClass(loan.status)}">
                    ${loan.status.toUpperCase()}
                </span>
            </div>
            
            <div class="grid grid-cols-2 gap-4 mb-4">
                <div>
                    <p class="text-xs text-gray-500">Principal Amount</p>
                    <p class="font-medium">₹${loan.loanDetails.principalAmount.toLocaleString()}</p>
                </div>
                <div>
                    <p class="text-xs text-gray-500">Interest Rate</p>
                    <p class="font-medium">${loan.loanDetails.interestRate}% p.a.</p>
                </div>
                <div>
                    <p class="text-xs text-gray-500">Total Amount</p>
                    <p class="font-medium">₹${loan.loanDetails.totalAmount.toLocaleString()}</p>
                </div>
                <div>
                    <p class="text-xs text-gray-500">Remaining</p>
                    <p class="font-medium text-red-600">₹${(loan.loanDetails.totalAmount - loan.repaymentDetails.totalPaid).toLocaleString()}</p>
                </div>
            </div>
            
            ${loan.status === 'active' ? `
                <button onclick="showRepaymentModal('${loan.loanId}')" 
                        class="enhanced-btn px-4 py-2 w-full">
                    <i class="fas fa-credit-card mr-2"></i>Make Repayment
                </button>
            ` : ''}
        </div>
    `).join('');
}

function getLoanStatusClass(status) {
    const classes = {
        'pending': 'bg-yellow-100 text-yellow-800',
        'approved': 'bg-green-100 text-green-800',
        'active': 'bg-blue-100 text-blue-800',
        'completed': 'bg-gray-100 text-gray-800'
    };
    return classes[status] || 'bg-gray-100 text-gray-800';
}

async function loadTransactions() {
    try {
        const response = await fetch('/api/farmer/transactions', {
            credentials: 'include'
        });
        
        if (response.ok) {
            const data = await response.json();
            displayTransactions(data.transactions || []);
        }
    } catch (error) {
        console.error('Error loading transactions:', error);
    }
}

function displayTransactions(transactions) {
    const container = document.getElementById('transactionsList');
    
    if (transactions.length === 0) {
        container.innerHTML = `
            <div class="text-center py-12">
                <i class="fas fa-receipt text-4xl text-gray-400 mb-4"></i>
                <p class="text-gray-500">No transactions found</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = transactions.map(txn => `
        <div class="dashboard-card rounded-xl p-4">
            <div class="flex justify-between items-center">
                <div class="flex items-center space-x-3">
                    <div class="w-10 h-10 rounded-full flex items-center justify-center ${getTransactionIconClass(txn.type)}">
                        <i class="fas ${getTransactionIcon(txn.type)}"></i>
                    </div>
                    <div>
                        <p class="font-medium">${txn.description}</p>
                        <p class="text-sm text-gray-600">${new Date(txn.createdAt).toLocaleDateString()}</p>
                    </div>
                </div>
                <div class="text-right">
                    <p class="font-bold ${txn.type.includes('payment') || txn.type.includes('disbursement') ? 'text-green-600' : 'text-red-600'}">
                        ${txn.type.includes('payment') || txn.type.includes('disbursement') ? '+' : '-'}₹${txn.amount.toLocaleString()}
                    </p>
                    <p class="text-xs text-gray-500">${txn.status}</p>
                </div>
            </div>
        </div>
    `).join('');
}

function getTransactionIcon(type) {
    const icons = {
        'auction_payment': 'fa-gavel',
        'loan_disbursement': 'fa-hand-holding-usd',
        'loan_repayment': 'fa-credit-card',
        'storage_fee': 'fa-warehouse'
    };
    return icons[type] || 'fa-exchange-alt';
}

function getTransactionIconClass(type) {
    const classes = {
        'auction_payment': 'bg-green-100 text-green-600',
        'loan_disbursement': 'bg-blue-100 text-blue-600',
        'loan_repayment': 'bg-red-100 text-red-600',
        'storage_fee': 'bg-yellow-100 text-yellow-600'
    };
    return classes[type] || 'bg-gray-100 text-gray-600';
}

function loadAccountSettings() {
    if (!currentUser) return;
    
    const container = document.getElementById('profileInfo');
    container.innerHTML = `
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
                <h4 class="font-semibold mb-2">Personal Information</h4>
                <div class="space-y-2 text-sm">
                    <div class="flex justify-between">
                        <span class="text-gray-600">Name:</span>
                        <span>${currentUser.profile.firstName} ${currentUser.profile.lastName}</span>
                    </div>
                    <div class="flex justify-between">
                        <span class="text-gray-600">Email:</span>
                        <span>${currentUser.email}</span>
                    </div>
                    <div class="flex justify-between">
                        <span class="text-gray-600">Phone:</span>
                        <span>${currentUser.profile.phone}</span>
                    </div>
                    <div class="flex justify-between">
                        <span class="text-gray-600">Location:</span>
                        <span>${currentUser.profile.address.city}, ${currentUser.profile.address.state}</span>
                    </div>
                </div>
            </div>
            <div>
                <h4 class="font-semibold mb-2">Farm Details</h4>
                <div class="space-y-2 text-sm">
                    <div class="flex justify-between">
                        <span class="text-gray-600">Farm Size:</span>
                        <span>${currentUser.profile.farmDetails.farmSize} acres</span>
                    </div>
                    <div class="flex justify-between">
                        <span class="text-gray-600">Experience:</span>
                        <span>${currentUser.profile.farmDetails.farmingExperience} years</span>
                    </div>
                    <div class="flex justify-between">
                        <span class="text-gray-600">Primary Crops:</span>
                        <span>${currentUser.profile.farmDetails.primaryCrops.join(', ')}</span>
                    </div>
                    <div class="flex justify-between">
                        <span class="text-gray-600">Credit Score:</span>
                        <span class="font-bold text-green-600">${currentUser.creditScore}</span>
                    </div>
                </div>
            </div>
        </div>
    `;
}

// Chatbot functions
function toggleChatbot() {
    chatbotOpen = !chatbotOpen;
    const panel      = document.getElementById('chatbotPanel');
    const toggleBtn  = document.getElementById('chatbotToggle');   // ← the green FAB

    if (chatbotOpen) {
        panel.classList.add('open');
        toggleBtn.style.display = 'none';          // hide button
    } else {
        panel.classList.remove('open');
        toggleBtn.style.display = 'block';         // show again
    }
}


function handleChatKeyPress(event) {
    if (event.key === 'Enter') {
        sendChatMessage();
    }
}

async function sendChatMessage() {
    const input = document.getElementById('chatInput');
    const message = input.value.trim();
    
    if (!message) return;
    
    // Detect language (simple detection)
    const language = detectLanguage(message);
    
    // Add user message to chat
    addChatMessage(message, 'user');
    input.value = '';
    
    // Show enhanced typing indicator
    const typingText = language === 'hi' ? 'टाइप कर रहा है...' : 
                      language === 'mr' ? 'टाइप करत आहे...' : 'Typing...';
    addChatMessage(typingText, 'bot', true);
    
    // First check if this is an actionable command
    console.log('Checking intent for message:', message);
    console.log('chatbotActionService available:', !!window.chatbotActionService);
    
    if (window.chatbotActionService) {
        const intent = window.chatbotActionService.parseIntent(message);
        console.log('Detected intent:', intent);
        
        if (intent !== 'general') {
            // Handle action
            try {
                console.log('Executing action for intent:', intent);
                const actionResult = await window.chatbotActionService.executeAction(intent, message);
                console.log('Action result:', actionResult);
                
                if (actionResult) {
                    // Remove typing indicator
                    removeLastChatMessage();
                    
                    // Render action result
                    const actionHtml = ChatMessageRenderer.renderActionMessage(actionResult);
                    console.log('Rendered HTML:', actionHtml);
                    addChatMessage(actionHtml, 'bot', true); // true for HTML content
                    
                    // If action was successful, also update the dashboard
                    if (actionResult.success && actionResult.action) {
                        refreshDashboardAfterAction(actionResult.action);
                        return;
                    }
                    
                    return; // Don't proceed to normal chat
                }
            } catch (error) {
                console.error('Action execution error:', error);
                return;
            }
        }
    } else {
        console.error('chatbotActionService not available');
    }
    
    try {
        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ 
                message,
                language,
                location: currentUser?.profile?.address?.city || 'Sonipat',
                context: 'farmer_dashboard',
                user: currentUser,
                threadId: window.chatThreadId // Maintain conversation context
            })
        });
        
        if (response.ok) {
            const data = await response.json();
            // Store thread ID for conversation continuity
            window.chatThreadId = data.threadId;
            
            // Remove typing indicator
            removeLastChatMessage();
            addChatMessage(data.message, 'bot');
        } else {
            removeLastChatMessage();
            const errorMsg = language === 'hi' ? 'माफ करें, कोई त्रुटि हुई। कृपया पुनः प्रयास करें।' :
                           language === 'mr' ? 'माफ करा, काही त्रुटी झाली. कृपया पुन्हा प्रयत्न करा.' :
                           'Sorry, I encountered an error. Please try again.';
            addChatMessage(errorMsg, 'bot');
        }
    } catch (error) {
        removeLastChatMessage();
        const errorMsg = language === 'hi' ? 'कनेक्शन नहीं हो सका। कृपया पुनः प्रयास करें।' :
                       language === 'mr' ? 'कनेक्शन होऊ शकले नाही. कृपया पुन्हा प्रयत्न करा.' :
                       'Sorry, I could not connect. Please try again.';
        addChatMessage(errorMsg, 'bot');
    }
}

// Simple language detection function
function detectLanguage(text) {
    // Check manual language selection first
    const selectedLang = document.getElementById('chatLanguage')?.value;
    if (selectedLang && selectedLang !== 'auto') {
        return selectedLang;
    }
    
    // Auto-detect from text
    if (/[\u0900-\u097F]/.test(text)) {
        // Check for specific Marathi words/patterns
        if (text.includes('काय') || text.includes('कसे') || text.includes('कोणत्या')) {
            return 'mr'; // Marathi
        }
        return 'hi'; // Hindi
    }
    return 'en'; // English
}

// Update chat language and interface
function updateChatLanguage() {
    const language = document.getElementById('chatLanguage').value;
    const input = document.getElementById('chatInput');
    
    // Update placeholder text based on selected language
    const placeholders = {
        'en': 'Ask me anything...',
        'hi': 'कुछ भी पूछें...',
        'mr': 'काहीही विचारा...'
    };
    
    input.placeholder = placeholders[language] || placeholders['en'];
    
    // Add a system message about language change
    const greetings = {
        'en': 'Language switched to English. How can I help you?',
        'hi': 'भाषा हिन्दी में बदल गई है। मैं आपकी कैसे सहायता कर सकता हूँ?',
        'mr': 'भाषा मराठीत बदलली आहे. मी तुमची कशी मदत करू शकतो?'
    };
    
    // Clear previous conversation context when language changes
    window.chatThreadId = null;
    
    // Optionally add greeting message
    if (language !== 'en') {
        addChatMessage(greetings[language], 'bot');
    }
}

// Quick question function for demo purposes
function quickQuestion(question) {
    document.getElementById('chatInput').value = question;
    sendChatMessage();
}

function addChatMessage(message, sender, isHtmlOrTyping = false) {
    const container = document.getElementById('chatbotContent');
    const messageDiv = document.createElement('div');
    
    // Handle both typing and HTML cases
    const isTyping = (typeof isHtmlOrTyping === 'boolean' && isHtmlOrTyping && message.includes('Typing')) || 
                     (typeof isHtmlOrTyping === 'boolean' && isHtmlOrTyping && message.includes('टाइप')) ||
                     (typeof isHtmlOrTyping === 'boolean' && isHtmlOrTyping && message.includes('टाइप करत'));
    const isHtml = (typeof isHtmlOrTyping === 'boolean' && isHtmlOrTyping && !isTyping);
    
    messageDiv.className = `mb-3 ${isTyping ? 'typing-message' : ''}`;
    
    if (sender === 'user') {
        messageDiv.innerHTML = `
            <div class="flex justify-end">
                <div class="bg-green-600 text-white p-3 rounded-lg max-w-sm">
                    ${escapeHtml(message)}
                </div>
            </div>
        `;
    } else {
        const content = isTyping ? '<i class="fas fa-circle animate-pulse"></i> ' + message :
                       isHtml ? message : escapeHtml(message);
        messageDiv.innerHTML = `
            <div class="flex justify-start">
                <div class="bg-gray-100 text-gray-800 p-3 rounded-lg max-w-sm">
                    ${content}
                </div>
            </div>
        `;
    }
    
    container.appendChild(messageDiv);
    container.scrollTop = container.scrollHeight;
}

function removeLastChatMessage() {
    const container = document.getElementById('chatbotContent');
    const typingMessage = container.querySelector('.typing-message');
    if (typingMessage) {
        typingMessage.remove();
    }
}

// Utility functions
function showLoading(show) {
    const overlay = document.getElementById('loadingOverlay');
    if (show) {
        overlay.classList.remove('hidden');
    } else {
        overlay.classList.add('hidden');
    }
}

function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `fixed top-4 right-4 p-4 rounded-lg text-white z-50 transform transition-all duration-300 translate-x-full`;
    
    if (type === 'success') {
        notification.classList.add('bg-green-500');
    } else if (type === 'error') {
        notification.classList.add('bg-red-500');
    } else {
        notification.classList.add('bg-blue-500');
    }
    
    notification.innerHTML = `
        <div class="flex items-center">
            <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'} mr-2"></i>
            <span>${message}</span>
        </div>
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.classList.remove('translate-x-full');
    }, 100);
    
    setTimeout(() => {
        notification.classList.add('translate-x-full');
        setTimeout(() => notification.remove(), 300);
    }, 5000);
}

async function logout() {
    try {
        await fetch('/api/auth/logout', {
            method: 'POST',
            credentials: 'include'
        });
        
        localStorage.removeItem('user');
        window.location.href = '/auth.html';
    } catch (error) {
        console.error('Logout error:', error);
        window.location.href = '/auth.html';
    }
}

// Language change function
function changeLanguage(language) {
    if (window.languageManager) {
        window.languageManager.setLanguage(language);
    }
}

// Voice integration functions
function speakLastMessage() {
    const messages = document.querySelectorAll('#chatbotContent .mb-3');
    const lastBotMessage = Array.from(messages).reverse().find(msg => 
        msg.querySelector('.bg-gray-100')
    );
    
    if (lastBotMessage && window.voiceManager) {
        const text = lastBotMessage.querySelector('.bg-gray-100').textContent;
        window.voiceManager.speak(text);
    }
}

// Enhanced voice input integration
if (typeof window !== 'undefined') {
    window.addEventListener('load', () => {
        if (window.voiceManager) {
            // Override voice manager's speech result handler for farmer dashboard
            const originalSpeechResult = window.voiceManager.onSpeechResult;
            window.voiceManager.onSpeechResult = function(result) {
                console.log('Voice input result:', result);
                const chatInput = document.getElementById('chatInput');
                if (chatInput) {
                    chatInput.value = result;
                    sendChatMessage();
                }
            };
        }
    });
}

// Chatbot Action Helper Functions
window.chatbotService = {
    async submitChatLoan() {
        const whrId = document.getElementById('chatLoanWHR').value;
        const amount = document.getElementById('chatLoanAmount').value;
        const purpose = document.getElementById('chatLoanPurpose').value;
        
        if (!whrId || !amount || !purpose) {
            addChatMessage('Please fill all loan details.', 'bot');
            return;
        }
        
        const loanData = {
            whrId,
            amount: parseFloat(amount),
            purpose,
            tenure: 12 // Default 12 months
        };
        
        const result = await window.chatbotActionService.submitLoanApplication(loanData);
        const actionHtml = ChatMessageRenderer.renderActionMessage(result);
        addChatMessage(actionHtml, 'bot', true);
        
        if (result.success) {
            refreshDashboardAfterAction('loanApplied');
        }
    },
    
    async submitChatRepayment() {
        const loanId = document.getElementById('chatRepayLoan').value;
        const amount = document.getElementById('chatRepayAmount').value;
        
        if (!loanId || !amount) {
            addChatMessage('Please fill all repayment details.', 'bot');
            return;
        }
        
        const repaymentData = {
            loanId,
            amount: parseFloat(amount)
        };
        
        const result = await window.chatbotActionService.submitLoanRepayment(repaymentData);
        const actionHtml = ChatMessageRenderer.renderActionMessage(result);
        addChatMessage(actionHtml, 'bot', true);
        
        if (result.success) {
            refreshDashboardAfterAction('repaymentComplete');
        }
    },
    
    async submitChatAuction() {
        const whrId = document.getElementById('chatAuctionWHR').value;
        const basePrice = document.getElementById('chatAuctionPrice').value;
        
        if (!whrId || !basePrice) {
            addChatMessage('Please fill all auction details.', 'bot');
            return;
        }
        
        // Submit auction (you'll need to implement this API endpoint)
        try {
            const response = await fetch('/api/auctions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    whrId,
                    basePrice: parseFloat(basePrice),
                    duration: 30 // 30 seconds for demo
                })
            });
            
            if (response.ok) {
                const auction = await response.json();
                addChatMessage(`✅ Auction created successfully! Auction ID: ${auction._id}`, 'bot');
                refreshDashboardAfterAction('auctionCreated');
            } else {
                const error = await response.json();
                addChatMessage(`❌ Auction creation failed: ${error.message}`, 'bot');
            }
        } catch (error) {
            addChatMessage('❌ Network error. Please try again.', 'bot');
        }
    },
    
    async quickRepayment(loanId, amount) {
        const result = await window.chatbotActionService.submitLoanRepayment({
            loanId,
            amount
        });
        
        const actionHtml = ChatMessageRenderer.renderActionMessage(result);
        addChatMessage(actionHtml, 'bot', true);
        
        if (result.success) {
            refreshDashboardAfterAction('repaymentComplete');
        }
    }
};

// Dashboard refresh after actions
function refreshDashboardAfterAction(action) {
    switch (action) {
        case 'loanApplied':
        case 'repaymentComplete':
            // Refresh loans section
            if (document.getElementById('loans').style.display !== 'none') {
                loadLoans();
            }
            // Update stats
            updateDashboardStats();
            break;
            
        case 'auctionCreated':
            // Refresh auctions section
            if (document.getElementById('auction').style.display !== 'none') {
                loadAuctions();
            }
            break;
            
        default:
            // General refresh
            updateDashboardStats();
    }
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}