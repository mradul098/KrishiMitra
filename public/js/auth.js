// Authentication JavaScript for KrishiMitra

document.addEventListener('DOMContentLoaded', () => {
    initializePage();
    setupEventListeners();
});

function initializePage() {
    // Check if user is already logged in
    checkAuthStatus();
    
    // Initialize role selection
    setupRoleSelection();
}

function setupEventListeners() {
    // Tab switching
    document.getElementById('loginTab').addEventListener('click', () => switchTab('login'));
    document.getElementById('registerTab').addEventListener('click', () => switchTab('register'));
    
    // Form submissions
    document.getElementById('loginFormElement').addEventListener('submit', handleLogin);
    document.getElementById('registerFormElement').addEventListener('submit', handleRegister);
    
    // Role selection
    document.querySelectorAll('.role-card').forEach(card => {
        card.addEventListener('click', () => selectRole(card.dataset.role));
    });
}

function switchTab(tab) {
    const loginTab = document.getElementById('loginTab');
    const registerTab = document.getElementById('registerTab');
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    
    if (tab === 'login') {
        loginTab.classList.add('bg-green-600', 'text-white');
        loginTab.classList.remove('bg-gray-200', 'text-gray-700');
        registerTab.classList.add('bg-gray-200', 'text-gray-700');
        registerTab.classList.remove('bg-green-600', 'text-white');
        
        loginForm.classList.remove('hidden');
        registerForm.classList.add('hidden');
    } else {
        registerTab.classList.add('bg-green-600', 'text-white');
        registerTab.classList.remove('bg-gray-200', 'text-gray-700');
        loginTab.classList.add('bg-gray-200', 'text-gray-700');
        loginTab.classList.remove('bg-green-600', 'text-white');
        
        registerForm.classList.remove('hidden');
        loginForm.classList.add('hidden');
    }
}

function setupRoleSelection() {
    const roleCards = document.querySelectorAll('.role-card');
    const farmerFields = document.getElementById('farmerFields');
    const warehouseFields = document.getElementById('warehouseFields');
    
    roleCards.forEach(card => {
        card.addEventListener('click', () => {
            // Remove selection from all cards
            roleCards.forEach(c => c.classList.remove('selected'));
            
            // Add selection to clicked card
            card.classList.add('selected');
            
            // Update hidden role field
            document.getElementById('selectedRole').value = card.dataset.role;
            
            // Show/hide role-specific fields
            if (card.dataset.role === 'farmer') {
                farmerFields.classList.remove('hidden');
                warehouseFields.classList.add('hidden');
            } else {
                warehouseFields.classList.remove('hidden');
                farmerFields.classList.add('hidden');
            }
        });
    });
}

function selectRole(role) {
    document.getElementById('selectedRole').value = role;
}

async function handleLogin(e) {
    e.preventDefault();
    
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    
    showLoading(true);
    
    try {
        const response = await fetch('/api/auth/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email, password })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showNotification('Login successful! Redirecting...', 'success');
            
            // Store user data
            localStorage.setItem('user', JSON.stringify(data.user));
            
            // Redirect based on role
            setTimeout(() => {
                if (data.user.role === 'farmer') {
                    window.location.href = '/farmer-dashboard.html';
                } else {
                    window.location.href = '/warehouse-dashboard.html';
                }
            }, 1500);
        } else {
            showNotification(data.message || 'Login failed', 'error');
        }
    } catch (error) {
        console.error('Login error:', error);
        showNotification('Connection error. Please try again.', 'error');
    } finally {
        showLoading(false);
    }
}

async function handleRegister(e) {
    e.preventDefault();
    
    const selectedRole = document.getElementById('selectedRole').value;
    
    if (!selectedRole) {
        showNotification('Please select your role', 'error');
        return;
    }
    
    // Collect form data
    const formData = {
        email: document.getElementById('registerEmail').value,
        password: document.getElementById('registerPassword').value,
        role: selectedRole,
        profile: {
            firstName: document.getElementById('firstName').value,
            lastName: document.getElementById('lastName').value,
            phone: document.getElementById('phone').value,
            address: {
                city: document.getElementById('city').value,
                state: document.getElementById('state').value
            }
        }
    };
    
    // Add role-specific data
    if (selectedRole === 'farmer') {
        const primaryCrops = Array.from(document.getElementById('primaryCrops').selectedOptions)
                                 .map(option => option.value);
        
        formData.profile.farmDetails = {
            farmSize: parseFloat(document.getElementById('farmSize').value) || 0,
            primaryCrops: primaryCrops,
            farmingExperience: parseInt(document.getElementById('farmingExperience').value) || 0
        };
    } else {
        formData.profile.warehouseDetails = {
            warehouseName: document.getElementById('warehouseName').value,
            capacity: parseFloat(document.getElementById('capacity').value) || 0,
            warehouseId: generateWarehouseId()
        };
    }
    
    showLoading(true);
    
    try {
        const response = await fetch('/api/auth/register', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(formData)
        });
        
        const data = await response.json();
        
        if (data.success) {
            showNotification('Registration successful! Redirecting...', 'success');
            
            // Store user data
            localStorage.setItem('user', JSON.stringify(data.user));
            
            // Redirect based on role
            setTimeout(() => {
                if (data.user.role === 'farmer') {
                    window.location.href = '/farmer-dashboard.html';
                } else {
                    window.location.href = '/warehouse-dashboard.html';
                }
            }, 1500);
        } else {
            showNotification(data.message || 'Registration failed', 'error');
        }
    } catch (error) {
        console.error('Registration error:', error);
        showNotification('Connection error. Please try again.', 'error');
    } finally {
        showLoading(false);
    }
}

function generateWarehouseId() {
    return 'WH' + Date.now().toString().slice(-6) + Math.random().toString(36).substr(2, 4).toUpperCase();
}

async function checkAuthStatus() {
    try {
        const response = await fetch('/api/auth/me');
        const data = await response.json();
        
        if (data.success) {
            // User is already logged in, redirect to appropriate dashboard
            if (data.user.role === 'farmer') {
                window.location.href = '/farmer-dashboard.html';
            } else {
                window.location.href = '/warehouse-dashboard.html';
            }
        }
    } catch (error) {
        // User not logged in, stay on auth page
        console.log('User not logged in');
    }
}

function showLoading(show) {
    const overlay = document.getElementById('loadingOverlay');
    if (show) {
        overlay.classList.remove('hidden');
    } else {
        overlay.classList.add('hidden');
    }
}

function showNotification(message, type = 'info') {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `fixed top-4 right-4 p-4 rounded-lg text-white z-50 transform transition-all duration-300 translate-x-full`;
    
    // Set background color based on type
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
    
    // Trigger animation
    setTimeout(() => {
        notification.classList.remove('translate-x-full');
    }, 100);
    
    // Remove after 5 seconds
    setTimeout(() => {
        notification.classList.add('translate-x-full');
        setTimeout(() => {
            notification.remove();
        }, 300);
    }, 5000);
}

// Demo login functionality
function loginAsDemo(role) {
    const email = role === 'farmer' ? 'farmer@demo.com' : 'warehouse@demo.com';
    const password = 'password123';
    
    document.getElementById('loginEmail').value = email;
    document.getElementById('loginPassword').value = password;
    
    // Auto-submit form
    document.getElementById('loginFormElement').dispatchEvent(new Event('submit'));
} 