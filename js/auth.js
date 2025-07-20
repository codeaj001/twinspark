// Authentication JavaScript

document.addEventListener('DOMContentLoaded', function() {
    // Wait for authService to be available
    if (window.authService) {
        initializeAuth();
    } else {
        // If authService is not ready, wait for it
        const checkAuthService = setInterval(() => {
            if (window.authService) {
                clearInterval(checkAuthService);
                initializeAuth();
            }
        }, 100);
    }
});

function initializeAuth() {
    // Check if user is already logged in
    checkAuthState();
    
    // Set up tab switching
    setupTabs();
    
    // Set up form submissions
    setupForms();
}

async function checkAuthState() {
    const user = await authService.getCurrentUser();
    if (user) {
        // User is already logged in, check if they have completed their profile
        const hasCompletedProfile = await authService.hasCompletedProfile();
        
        if (hasCompletedProfile) {
            // Existing user with completed profile - redirect to match page
            window.location.href = 'match.html';
        } else {
            // New user or incomplete profile - redirect to profile page
            window.location.href = 'profile.html';
        }
    }
}

function setupTabs() {
    const tabButtons = document.querySelectorAll('.tab-button');
    const authForms = document.querySelectorAll('.auth-form');
    
    tabButtons.forEach(button => {
        button.addEventListener('click', function() {
            const targetTab = this.dataset.tab;
            
            // Remove active class from all buttons and forms
            tabButtons.forEach(btn => btn.classList.remove('active'));
            authForms.forEach(form => form.classList.remove('active'));
            
            // Add active class to clicked button and corresponding form
            this.classList.add('active');
            document.getElementById(targetTab).classList.add('active');
        });
    });
}

function setupForms() {
    const loginForm = document.getElementById('loginForm');
    const signupForm = document.getElementById('signupForm');
    
    loginForm.addEventListener('submit', handleLogin);
    signupForm.addEventListener('submit', handleSignup);
}

async function handleLogin(e) {
    e.preventDefault();
    
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    
    // Show loading state
    const submitButton = e.target.querySelector('button[type=\"submit\"]');
    const originalText = submitButton.textContent;
    submitButton.textContent = 'Signing in...';
    submitButton.disabled = true;
    
    try {
        const { data, error } = await authService.signIn(email, password);
        
        if (error) {
            throw error;
        }
        
        // Success - check if user has completed profile
        const hasCompletedProfile = await authService.hasCompletedProfile();
        
        if (hasCompletedProfile) {
            // Existing user - redirect to match page
            showMessage('Login successful! Redirecting to matches...', 'success');
            setTimeout(() => {
                window.location.href = 'match.html';
            }, 1000);
        } else {
            // New user or incomplete profile - redirect to profile page
            showMessage('Login successful! Please complete your profile...', 'success');
            setTimeout(() => {
                window.location.href = 'profile.html';
            }, 1000);
        }
        
    } catch (error) {
        console.error('Login error:', error);
        showMessage(error.message || 'Login failed. Please try again.', 'error');
        
        // Reset button
        submitButton.textContent = originalText;
        submitButton.disabled = false;
    }
}

async function handleSignup(e) {
    e.preventDefault();
    
    const username = document.getElementById('signupUsername').value;
    const email = document.getElementById('signupEmail').value;
    const password = document.getElementById('signupPassword').value;
    const confirmPassword = document.getElementById('confirmPassword').value;
    
    // Validate passwords match
    if (password !== confirmPassword) {
        showMessage('Passwords do not match', 'error');
        return;
    }
    
    // Validate password strength
    if (password.length < 6) {
        showMessage('Password must be at least 6 characters long', 'error');
        return;
    }
    
    // Validate username
    if (username.length < 3) {
        showMessage('Username must be at least 3 characters long', 'error');
        return;
    }
    
    // Show loading state
    const submitButton = e.target.querySelector('button[type=\"submit\"]');
    const originalText = submitButton.textContent;
    submitButton.textContent = 'Creating account...';
    submitButton.disabled = true;
    
    try {
        console.log('Attempting to sign up user:', email, username);
        const { data, error } = await authService.signUp(email, password, username);
        
        if (error) {
            console.error('Auth signup error:', error);
            throw error;
        }
        
        console.log('Signup successful:', data);
        
        // Success message
        showMessage('Account created successfully! Please check your email to verify your account.', 'success');
        
        // Switch to login tab
        document.querySelector('.tab-button[data-tab=\"login\"]').click();
        
        // Pre-fill login form
        document.getElementById('loginEmail').value = email;
        
    } catch (error) {
        console.error('Signup error:', error);
        console.error('Full error details:', {
            message: error.message,
            code: error.code,
            details: error.details,
            hint: error.hint
        });
        
        let errorMessage = 'Signup failed. Please try again.';
        if (error.message) {
            errorMessage = error.message;
        }
        
        showMessage(errorMessage, 'error');
        
        // Reset button
        submitButton.textContent = originalText;
        submitButton.disabled = false;
    }
}

// Utility function to show messages
function showMessage(message, type = 'info') {
    // Remove existing messages
    const existingMessage = document.querySelector('.message-popup');
    if (existingMessage) {
        existingMessage.remove();
    }
    
    const messageDiv = document.createElement('div');
    messageDiv.className = `message-popup ${type}`;
    messageDiv.textContent = message;
    
    // Style the message
    messageDiv.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 1rem 2rem;
        border-radius: 10px;
        color: white;
        font-weight: bold;
        z-index: 10000;
        box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
        transform: translateX(100%);
        transition: transform 0.3s ease;
        max-width: 300px;
    `;
    
    // Set background color based on type
    switch (type) {
        case 'success':
            messageDiv.style.background = 'linear-gradient(45deg, #4CAF50, #45a049)';
            break;
        case 'error':
            messageDiv.style.background = 'linear-gradient(45deg, #ff6b6b, #ff5252)';
            break;
        case 'info':
        default:
            messageDiv.style.background = 'linear-gradient(45deg, #667eea, #764ba2)';
    }
    
    document.body.appendChild(messageDiv);
    
    // Animate in
    setTimeout(() => {
        messageDiv.style.transform = 'translateX(0)';
    }, 100);
    
    // Auto remove after 5 seconds
    setTimeout(() => {
        messageDiv.style.transform = 'translateX(100%)';
        setTimeout(() => {
            messageDiv.remove();
        }, 300);
    }, 5000);
}
