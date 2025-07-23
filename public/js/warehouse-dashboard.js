// Warehouse Manager Dashboard JavaScript
let currentUser = null;
let currentSection = 'overview';
let pendingDeposits = [];
let approvedDeposits = [];
let generatedWHRs = [];

document.addEventListener('DOMContentLoaded', () => {
    initializeDashboard();
    setupEventListeners();
});

async function initializeDashboard() {
    // Check authentication
    await checkAuth();
    
    // Load user data
    loadUserProfile();
    
    // Load dashboard data
    loadDashboardStats();
    loadPendingDeposits();
    loadWHRHistory();
    loadInventory();
    loadWarehouseSettings();
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
    document.getElementById('whrForm').addEventListener('submit', handleWHRGeneration);
    document.getElementById('settingsForm').addEventListener('submit', handleSettingsUpdate);
    
    // Real-time calculations
    document.getElementById('quantity').addEventListener('input', calculateWHRValues);
    document.getElementById('pricePerQuintal').addEventListener('input', calculateWHRValues);
    document.getElementById('storagePeriod').addEventListener('input', calculateWHRValues);
    document.getElementById('storageCharges').addEventListener('input', calculateWHRValues);
}

async function checkAuth() {
    try {
        const response = await fetch('/api/auth/me', {
            credentials: 'include'
        });
        
        if (response.ok) {
            const data = await response.json();
            currentUser = data.user;
            
            if (currentUser.role !== 'warehouse_manager') {
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
    document.getElementById('warehouseName').textContent = 
        currentUser.profile.warehouseDetails?.warehouseName || 'Warehouse';
    document.getElementById('welcomeName').textContent = currentUser.profile.firstName;
}

async function loadDashboardStats() {
    try {
        const [whrResponse, inventoryResponse] = await Promise.all([
            fetch('/api/warehouse/whrs', { credentials: 'include' }),
            fetch('/api/warehouse/inventory', { credentials: 'include' })
        ]);

        // Load capacity stats
        const totalCapacity = currentUser.profile.warehouseDetails?.capacity || 10000;
        document.getElementById('totalCapacity').textContent = `${totalCapacity.toLocaleString()}q`;

        if (inventoryResponse.ok) {
            const inventoryData = await inventoryResponse.json();
            const occupiedSpace = inventoryData.totalOccupied || 0;
            const utilization = ((occupiedSpace / totalCapacity) * 100).toFixed(1);
            
            document.getElementById('occupiedSpace').textContent = `${occupiedSpace.toLocaleString()}q`;
            document.getElementById('storageUtilization').textContent = `${utilization}%`;
        }

        if (whrResponse.ok) {
            const whrData = await whrResponse.json();
            const activeWHRs = whrData.whrs?.filter(whr => whr.status === 'active').length || 0;
            document.getElementById('activeWHRCount').textContent = activeWHRs;
        }

        // Load pending requests count
        const pendingCount = pendingDeposits.length;
        document.getElementById('pendingRequests').textContent = pendingCount;

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
    if (section === 'pending-deposits') {
        loadPendingDeposits();
    } else if (section === 'generate-whr') {
        loadFarmersForWHR();
    } else if (section === 'inventory') {
        loadInventory();
    } else if (section === 'whr-history') {
        loadWHRHistory();
    } else if (section === 'warehouse-settings') {
        loadWarehouseSettings();
    }
}

async function loadPendingDeposits() {
    try {
        const response = await fetch('/api/warehouse/pending-deposits', {
            credentials: 'include'
        });
        
        if (response.ok) {
            const data = await response.json();
            pendingDeposits = data.deposits || [];
            displayPendingDeposits(pendingDeposits);
        } else {
            // Show demo data if no real deposits
            displayPendingDeposits([]);
        }
    } catch (error) {
        console.error('Error loading pending deposits:', error);
        displayPendingDeposits([]);
    }
}

function displayPendingDeposits(deposits) {
    const container = document.getElementById('depositsList');
    
    if (deposits.length === 0) {
        container.innerHTML = `
            <div class="text-center py-12">
                <i class="fas fa-inbox text-4xl text-gray-400 mb-4"></i>
                <p class="text-gray-500">No pending deposit requests</p>
                <p class="text-sm text-gray-400">Farmers will submit deposit requests that appear here</p>
                <button onclick="addDemoDeposit()" class="enhanced-btn px-4 py-2 mt-4">
                    Add Demo Request
                </button>
            </div>
        `;
        return;
    }
    
    container.innerHTML = deposits.map(deposit => `
        <div class="dashboard-card rounded-xl p-6" id="deposit-${deposit.id}">
            <div class="flex justify-between items-start mb-4">
                <div>
                    <h3 class="text-lg font-semibold text-gray-800">${deposit.farmerName}</h3>
                    <p class="text-sm text-gray-600">Farmer ID: ${deposit.farmerId}</p>
                    <p class="text-sm text-gray-600">Phone: ${deposit.phone}</p>
                </div>
                <span class="px-3 py-1 status-pending text-white text-sm rounded-full">
                    PENDING
                </span>
            </div>
            
            <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                <div>
                    <p class="text-xs text-gray-500">Crop Type</p>
                    <p class="font-medium">${deposit.cropType}</p>
                </div>
                <div>
                    <p class="text-xs text-gray-500">Variety</p>
                    <p class="font-medium">${deposit.variety}</p>
                </div>
                <div>
                    <p class="text-xs text-gray-500">Quantity</p>
                    <p class="font-medium">${deposit.quantity} quintals</p>
                </div>
                <div>
                    <p class="text-xs text-gray-500">Expected Grade</p>
                    <p class="font-medium">Grade ${deposit.expectedGrade}</p>
                </div>
            </div>
            
            <div class="mb-4">
                <p class="text-xs text-gray-500 mb-1">Requested Date:</p>
                <p class="text-sm">${new Date(deposit.requestDate).toLocaleDateString()}</p>
            </div>
            
            <div class="flex space-x-2">
                <button onclick="approveDeposit('${deposit.id}')" 
                        class="flex-1 enhanced-btn px-4 py-2 text-sm">
                    <i class="fas fa-check mr-1"></i>Approve
                </button>
                <button onclick="inspectDeposit('${deposit.id}')" 
                        class="flex-1 bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700">
                    <i class="fas fa-search mr-1"></i>Inspect
                </button>
                <button onclick="rejectDeposit('${deposit.id}')" 
                        class="bg-red-600 text-white px-4 py-2 rounded text-sm hover:bg-red-700">
                    <i class="fas fa-times mr-1"></i>Reject
                </button>
            </div>
        </div>
    `).join('');
}

async function addDemoDeposit() {
    try {
        // Get the actual demo farmer data
        const farmersResponse = await fetch('/api/auth/demo-users', { credentials: 'include' });
        const farmersData = await farmersResponse.json();
        const demoFarmer = farmersData.users?.find(user => user.role === 'farmer');
        
        if (!demoFarmer) {
            showNotification('Demo farmer not found. Please restart the application.', 'error');
            return;
        }
        
        const demoDeposit = {
            id: `DEP${Date.now()}`,
            farmerId: demoFarmer.userId,
            farmerName: `${demoFarmer.profile.firstName} ${demoFarmer.profile.lastName}`,
            phone: demoFarmer.profile.phone,
            cropType: 'wheat',
            variety: 'HD-2967',
            quantity: 50,
            expectedGrade: 'A',
            requestDate: new Date().toISOString(),
            status: 'pending'
        };
        
        pendingDeposits.push(demoDeposit);
        displayPendingDeposits(pendingDeposits);
        showNotification('Demo deposit request added!', 'success');
    } catch (error) {
        console.error('Error adding demo deposit:', error);
        // Fallback to static demo data
        const demoDeposit = {
            id: `DEP${Date.now()}`,
            farmerId: 'FRM001234',
            farmerName: 'Rajesh Kumar',
            phone: '+91-9876543210',
            cropType: 'wheat',
            variety: 'HD-2967',
            quantity: 50,
            expectedGrade: 'A',
            requestDate: new Date().toISOString(),
            status: 'pending'
        };
        
        pendingDeposits.push(demoDeposit);
        displayPendingDeposits(pendingDeposits);
        showNotification('Demo deposit request added!', 'success');
    }
}

async function approveDeposit(depositId) {
    const deposit = pendingDeposits.find(d => d.id === depositId);
    if (!deposit) return;
    
    showLoading(true);
    
    try {
        // Simulate approval process
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Remove from pending list
        pendingDeposits = pendingDeposits.filter(d => d.id !== depositId);
        
        // Add to approved list for WHR generation
        const approvedDeposit = {
            ...deposit,
            status: 'approved',
            approvedDate: new Date().toISOString(),
            approvedBy: currentUser.userId
        };
        
        // Store approved deposit
        approvedDeposits.push(approvedDeposit);
        
        // Update UI
        document.getElementById(`deposit-${depositId}`).remove();
        showNotification(`Deposit from ${deposit.farmerName} approved!`, 'success');
        
        // Update stats
        loadDashboardStats();
        
        // Add to farmers list for WHR generation
        updateFarmersForWHR();
        
    } catch (error) {
        console.error('Error approving deposit:', error);
        showNotification('Error approving deposit', 'error');
    } finally {
        showLoading(false);
    }
}

function inspectDeposit(depositId) {
    const deposit = pendingDeposits.find(d => d.id === depositId);
    if (!deposit) return;
    
    // Show inspection details
    showNotification(`Inspecting crops from ${deposit.farmerName}. Quality assessment in progress...`, 'info');
    
    // Simulate inspection process
    setTimeout(() => {
        showNotification(`Inspection complete. Crops meet quality standards for Grade ${deposit.expectedGrade}.`, 'success');
    }, 3000);
}

function rejectDeposit(depositId) {
    const deposit = pendingDeposits.find(d => d.id !== depositId);
    
    if (confirm('Are you sure you want to reject this deposit request?')) {
        pendingDeposits = pendingDeposits.filter(d => d.id !== depositId);
        document.getElementById(`deposit-${depositId}`).remove();
        showNotification('Deposit request rejected', 'info');
        loadDashboardStats();
    }
}

function loadFarmersForWHR() {
    // Load approved farmers for WHR generation
    const farmerSelect = document.getElementById('farmerSelect');
    
    farmerSelect.innerHTML = '<option value="">Choose farmer with approved deposit</option>';
    
    // Add approved farmers from deposits
    approvedDeposits.forEach(deposit => {
        farmerSelect.innerHTML += `
            <option value="${deposit.farmerId}" data-name="${deposit.farmerName}" data-phone="${deposit.phone}" data-crop="${deposit.cropType}" data-quantity="${deposit.quantity}">
                ${deposit.farmerName} (${deposit.farmerId}) - ${deposit.cropType} ${deposit.quantity}q
            </option>
        `;
    });
    
    // Add demo farmers if no approved deposits
    if (approvedDeposits.length === 0) {
        const demoFarmers = [
            { id: 'FRM001234', name: 'Rajesh Kumar', phone: '+91-9876543210' },
            { id: 'FRM001235', name: 'Suresh Patel', phone: '+91-9876543211' },
            { id: 'FRM001236', name: 'Mukesh Singh', phone: '+91-9876543212' }
        ];
        
        demoFarmers.forEach(farmer => {
            farmerSelect.innerHTML += `
                <option value="${farmer.id}" data-name="${farmer.name}" data-phone="${farmer.phone}">
                    ${farmer.name} (${farmer.id})
                </option>
            `;
        });
    }
}

function updateFarmersForWHR() {
    // This would be called after approving deposits
    loadFarmersForWHR();
}

function calculateWHRValues() {
    const quantity = parseFloat(document.getElementById('quantity').value) || 0;
    const pricePerQuintal = parseFloat(document.getElementById('pricePerQuintal').value) || 0;
    const storagePeriod = parseInt(document.getElementById('storagePeriod').value) || 6;
    const storageCharges = parseFloat(document.getElementById('storageCharges').value) || 25;
    
    const totalCropValue = quantity * pricePerQuintal;
    const totalStorageCharges = quantity * storageCharges * storagePeriod;
    const insuranceValue = Math.floor(totalCropValue * 0.02); // 2% insurance
    const netWHRValue = totalCropValue - totalStorageCharges;
    
    document.getElementById('totalCropValue').textContent = `₹${totalCropValue.toLocaleString()}`;
    document.getElementById('totalStorageCharges').textContent = `₹${totalStorageCharges.toLocaleString()}`;
    document.getElementById('insuranceValue').textContent = `₹${insuranceValue.toLocaleString()}`;
    document.getElementById('netWHRValue').textContent = `₹${Math.max(0, netWHRValue).toLocaleString()}`;
}

async function handleWHRGeneration(e) {
    e.preventDefault();
    
    const formData = {
        farmerId: document.getElementById('farmerSelect').value,
        cropDetails: {
            cropType: document.getElementById('cropType').value,
            variety: document.getElementById('variety').value,
            quantity: parseFloat(document.getElementById('quantity').value),
            qualityGrade: document.getElementById('qualityGrade').value,
            moistureContent: parseFloat(document.getElementById('moistureContent').value) || 0
        },
        financialDetails: {
            pricePerQuintal: parseFloat(document.getElementById('pricePerQuintal').value),
            estimatedValue: parseFloat(document.getElementById('quantity').value) * parseFloat(document.getElementById('pricePerQuintal').value),
            storageCharges: parseFloat(document.getElementById('storageCharges').value) || 25
        },
        storageDetails: {
            expectedStoragePeriod: parseInt(document.getElementById('storagePeriod').value),
            warehouseId: currentUser.profile.warehouseDetails?.warehouseId,
            warehouseName: currentUser.profile.warehouseDetails?.warehouseName
        }
    };
    
    showLoading(true);
    
    try {
        const response = await fetch('/api/warehouse/generate-whr', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(formData)
        });
        
        if (response.ok) {
            const data = await response.json();
            showWHRSuccessModal(data.whr);
            document.getElementById('whrForm').reset();
            
            // Update stats and inventory
            loadDashboardStats();
            loadInventory();
            loadWHRHistory();
            
            // Trigger celebration
            if (window.particleSystem) {
                window.particleSystem.addBurst(window.innerWidth / 2, window.innerHeight / 2);
            }
            
        } else {
            const error = await response.json();
            showNotification(error.message || 'Failed to generate WHR', 'error');
        }
    } catch (error) {
        console.error('WHR generation error:', error);
        showNotification('Error generating WHR', 'error');
    } finally {
        showLoading(false);
    }
}

function showWHRSuccessModal(whr) {
    const modal = document.getElementById('whrSuccessModal');
    const details = document.getElementById('whrDetails');
    
    details.innerHTML = `
        <div class="text-sm space-y-2">
            <div class="flex justify-between">
                <span class="text-gray-600">WHR ID:</span>
                <span class="font-medium">${whr.whrId}</span>
            </div>
            <div class="flex justify-between">
                <span class="text-gray-600">Farmer:</span>
                <span class="font-medium">${whr.farmerName}</span>
            </div>
            <div class="flex justify-between">
                <span class="text-gray-600">Crop:</span>
                <span class="font-medium">${whr.cropDetails.cropType} (${whr.cropDetails.variety})</span>
            </div>
            <div class="flex justify-between">
                <span class="text-gray-600">Quantity:</span>
                <span class="font-medium">${whr.cropDetails.quantity} quintals</span>
            </div>
            <div class="flex justify-between">
                <span class="text-gray-600">Grade:</span>
                <span class="font-medium">Grade ${whr.cropDetails.qualityGrade}</span>
            </div>
            <div class="flex justify-between">
                <span class="text-gray-600">Estimated Value:</span>
                <span class="font-medium text-green-600">₹${whr.financialDetails.estimatedValue.toLocaleString()}</span>
            </div>
        </div>
    `;
    
    modal.classList.remove('hidden');
}

function closeWHRModal() {
    document.getElementById('whrSuccessModal').classList.add('hidden');
}

function resetWHRForm() {
    document.getElementById('whrForm').reset();
    document.getElementById('valueCalculation').classList.add('hidden');
}

async function loadInventory() {
    try {
        const response = await fetch('/api/warehouse/inventory', {
            credentials: 'include'
        });
        
        if (response.ok) {
            const data = await response.json();
            displayInventory(data);
        } else {
            displayInventory({ whrs: [], summary: {} });
        }
    } catch (error) {
        console.error('Error loading inventory:', error);
        displayInventory({ whrs: [], summary: {} });
    }
}

function displayInventory(data) {
    const totalCapacity = currentUser.profile.warehouseDetails?.capacity || 10000;
    const occupiedSpace = data.summary?.totalOccupied || 0;
    const availableSpace = totalCapacity - occupiedSpace;
    const utilizationPercent = ((occupiedSpace / totalCapacity) * 100).toFixed(1);
    
    // Update capacity display
    document.getElementById('inventoryTotalCapacity').textContent = `${totalCapacity.toLocaleString()} quintals`;
    document.getElementById('inventoryUsedSpace').textContent = `${occupiedSpace.toLocaleString()} quintals`;
    document.getElementById('inventoryAvailableSpace').textContent = `${availableSpace.toLocaleString()} quintals`;
    document.getElementById('capacityBar').style.width = `${utilizationPercent}%`;
    
    // Update crop distribution
    const cropDistribution = document.getElementById('cropDistribution');
    const crops = data.summary?.cropBreakdown || {};
    
    if (Object.keys(crops).length === 0) {
        cropDistribution.innerHTML = '<p class="text-sm text-gray-500">No crops in storage</p>';
    } else {
        cropDistribution.innerHTML = Object.entries(crops).map(([crop, quantity]) => `
            <div class="flex justify-between items-center">
                <span class="text-sm capitalize">${crop}:</span>
                <span class="text-sm font-medium">${quantity} quintals</span>
            </div>
        `).join('');
    }
    
    // Update inventory table
    const inventoryTable = document.getElementById('inventoryTable');
    const whrs = data.whrs || [];
    
    if (whrs.length === 0) {
        inventoryTable.innerHTML = `
            <tr>
                <td colspan="7" class="px-4 py-8 text-center text-gray-500">
                    No inventory items found
                </td>
            </tr>
        `;
    } else {
        inventoryTable.innerHTML = whrs.map(whr => `
            <tr>
                <td class="px-4 py-2 text-sm">${whr.whrId}</td>
                <td class="px-4 py-2 text-sm">${whr.farmerName}</td>
                <td class="px-4 py-2 text-sm capitalize">${whr.cropDetails.cropType}</td>
                <td class="px-4 py-2 text-sm">${whr.cropDetails.quantity}q</td>
                <td class="px-4 py-2 text-sm">Grade ${whr.cropDetails.qualityGrade}</td>
                <td class="px-4 py-2 text-sm">${new Date(whr.cropDetails.dateOfDeposit).toLocaleDateString()}</td>
                <td class="px-4 py-2">
                    <span class="px-2 py-1 text-xs rounded-full ${getStatusBadgeClass(whr.status)}">
                        ${whr.status.replace('_', ' ').toUpperCase()}
                    </span>
                </td>
            </tr>
        `).join('');
    }
}

async function loadWHRHistory() {
    try {
        const response = await fetch('/api/warehouse/whrs', {
            credentials: 'include'
        });
        
        if (response.ok) {
            const data = await response.json();
            displayWHRHistory(data.whrs || []);
        } else {
            displayWHRHistory([]);
        }
    } catch (error) {
        console.error('Error loading WHR history:', error);
        displayWHRHistory([]);
    }
}

function displayWHRHistory(whrs) {
    const container = document.getElementById('whrHistoryList');
    
    if (whrs.length === 0) {
        container.innerHTML = `
            <div class="text-center py-12">
                <i class="fas fa-file-contract text-4xl text-gray-400 mb-4"></i>
                <p class="text-gray-500">No WHRs generated yet</p>
                <p class="text-sm text-gray-400">Generated warehouse receipts will appear here</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = whrs.map(whr => `
        <div class="dashboard-card rounded-xl p-6">
            <div class="flex justify-between items-start mb-4">
                <div>
                    <h3 class="text-lg font-semibold text-gray-800">WHR-${whr.whrId}</h3>
                    <p class="text-sm text-gray-600">${whr.farmerName} (${whr.farmerId})</p>
                </div>
                <span class="px-3 py-1 rounded-full text-xs font-medium ${getStatusBadgeClass(whr.status)}">
                    ${whr.status.replace('_', ' ').toUpperCase()}
                </span>
            </div>
            
            <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                <div>
                    <p class="text-xs text-gray-500">Crop</p>
                    <p class="font-medium">${whr.cropDetails.cropType}</p>
                </div>
                <div>
                    <p class="text-xs text-gray-500">Quantity</p>
                    <p class="font-medium">${whr.cropDetails.quantity}q</p>
                </div>
                <div>
                    <p class="text-xs text-gray-500">Grade</p>
                    <p class="font-medium">Grade ${whr.cropDetails.qualityGrade}</p>
                </div>
                <div>
                    <p class="text-xs text-gray-500">Value</p>
                    <p class="font-medium text-green-600">₹${whr.financialDetails.estimatedValue.toLocaleString()}</p>
                </div>
            </div>
            
            <div class="flex justify-between text-sm text-gray-600">
                <span>Generated: ${new Date(whr.validityPeriod.issueDate).toLocaleDateString()}</span>
                <span>Expires: ${new Date(whr.validityPeriod.expiryDate).toLocaleDateString()}</span>
            </div>
        </div>
    `).join('');
}

function filterWHRHistory() {
    // This would filter the WHR history based on form inputs
    // For now, just reload
    loadWHRHistory();
}

function loadWarehouseSettings() {
    if (!currentUser?.profile?.warehouseDetails) return;
    
    const details = currentUser.profile.warehouseDetails;
    
    document.getElementById('settingsWarehouseName').value = details.warehouseName || '';
    document.getElementById('settingsWarehouseId').value = details.warehouseId || '';
    document.getElementById('settingsCapacity').value = details.capacity || '';
    document.getElementById('settingsStorageRate').value = '25'; // Default rate
    document.getElementById('settingsProcessingFee').value = '500'; // Default fee
    document.getElementById('settingsManagerName').value = 
        `${currentUser.profile.firstName} ${currentUser.profile.lastName}`;
    document.getElementById('settingsContactPhone').value = currentUser.profile.phone || '';
    
    // Set facilities checkboxes
    const facilities = details.facilities || [];
    document.getElementById('facilityColdstorage').checked = facilities.includes('cold_storage');
    document.getElementById('facilityQualityTesting').checked = facilities.includes('quality_testing');
    document.getElementById('facilityFumigation').checked = facilities.includes('fumigation');
    document.getElementById('facilityPestControl').checked = facilities.includes('pest_control');
    document.getElementById('facilityDrying').checked = facilities.includes('drying');
    document.getElementById('facilityCleaning').checked = facilities.includes('cleaning');
}

async function handleSettingsUpdate(e) {
    e.preventDefault();
    
    showLoading(true);
    
    try {
        // Simulate settings update
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        showNotification('Warehouse settings updated successfully!', 'success');
        
    } catch (error) {
        console.error('Settings update error:', error);
        showNotification('Error updating settings', 'error');
    } finally {
        showLoading(false);
    }
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