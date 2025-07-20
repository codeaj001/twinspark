// TwinSpark - Main JavaScript File
// This file contains shared functionality across all pages

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
});

// Check authentication before initializing
async function checkAuth() {
    const user = await authService.getCurrentUser();
    if (!user && !window.location.pathname.includes('auth.html') && !window.location.pathname.includes('index.html')) {
        window.location.href = 'auth.html';
        return false;
    }
    return true;
}

// Application initialization
function initializeApp() {
    // Check if user is authenticated and has a profile
    checkUserStatus();

    // Set up form validation if profile form exists
    const profileForm = document.getElementById('profileForm');
    if (profileForm) {
        setupProfileForm();
    }

    // Set up reveal functionality if on reveal page
    const revealActions = document.getElementById('revealActions');
    if (revealActions) {
        setupRevealPage();
    }

    // Load connection history if on reveal page
    const historyList = document.getElementById('historyList');
    if (historyList) {
        loadConnectionHistory();
    }
}

// Check user status and handle new vs existing users
async function checkUserStatus() {
    try {
        const currentUser = await window.authService?.getCurrentUser();
        
        if (currentUser) {
            // User is authenticated, check if they have a profile in Supabase
            const { data: profile, error } = await window.supabase
                .from('users')
                .select('*')
                .eq('id', currentUser.id)
                .single();

            if (profile && profile.username) {
                // Existing user with profile - update local storage
                const userData = {
                    name: profile.username,
                    bio: profile.bio || '',
                    lookingFor: profile.looking_for || '',
                    interests: profile.interests || [],
                    avatar: profile.avatar || '1',
                    connections: JSON.parse(localStorage.getItem('twinsparkUser'))?.connections || []
                };
                localStorage.setItem('twinsparkUser', JSON.stringify(userData));
            } else {
                // New user - initialize empty profile
                localStorage.setItem('twinsparkUser', JSON.stringify({
                    name: '',
                    bio: '',
                    lookingFor: '',
                    interests: [],
                    avatar: '1',
                    connections: []
                }));
            }
        } else {
            // Not authenticated - initialize empty profile for demo
            if (!localStorage.getItem('twinsparkUser')) {
                localStorage.setItem('twinsparkUser', JSON.stringify({
                    name: '',
                    bio: '',
                    lookingFor: '',
                    interests: [],
                    avatar: '1',
                    connections: []
                }));
            }
        }
    } catch (error) {
        console.error('Error checking user status:', error);
        // Fallback to local storage initialization
        if (!localStorage.getItem('twinsparkUser')) {
            localStorage.setItem('twinsparkUser', JSON.stringify({
                name: '',
                bio: '',
                lookingFor: '',
                interests: [],
                avatar: '1',
                connections: []
            }));
        }
    }
}

// Real user functions - no more dummy users needed

// Profile form setup and validation
function setupProfileForm() {
    const form = document.getElementById('profileForm');
    const nameInput = document.getElementById('name');
    const nameError = document.getElementById('nameError');

    // Load existing profile data
    const user = JSON.parse(localStorage.getItem('twinsparkUser'));
    const profileTitle = document.getElementById('profileTitle');
    const isExistingUser = user.name && user.name.length > 0;
    
    if (isExistingUser) {
        // Update title for existing user
        profileTitle.textContent = 'Edit Your Profile';
        
        // Fill in existing data
        nameInput.value = user.name;
        document.getElementById('bio').value = user.bio;
        
        // Set looking_for
        if (user.lookingFor) {
            document.getElementById('lookingFor').value = user.lookingFor;
        }
        
        // Set interests
        const predefinedInterests = ['technology', 'music', 'sports', 'art', 'travel', 'books', 'food', 'fitness'];
        const customInterests = [];
        
        user.interests.forEach(interest => {
            const checkbox = document.querySelector(`input[value="${interest}"]`);
            if (checkbox) {
                checkbox.checked = true;
            } else {
                // It's a custom interest
                customInterests.push(interest);
            }
        });
        
        // Set custom interests in the input field
        if (customInterests.length > 0) {
            document.getElementById('customInterests').value = customInterests.join(', ');
        }
        
        // Set avatar
        const avatarRadio = document.querySelector(`input[value="${user.avatar}"]`);
        if (avatarRadio) avatarRadio.checked = true;
    } else {
        // New user - keep default title
        profileTitle.textContent = 'Create Your Profile';
    }

    // Real-time validation
    nameInput.addEventListener('input', function() {
        validateName();
    });

    // Form submission
    form.addEventListener('submit', function(e) {
        e.preventDefault();
        
        if (validateName()) {
            saveProfile();
        }
    });

    function validateName() {
        const name = nameInput.value.trim();
        
        if (name.length < 2) {
            nameError.textContent = 'Name must be at least 2 characters long';
            return false;
        }
        
        if (name.length > 50) {
            nameError.textContent = 'Name must be less than 50 characters';
            return false;
        }
        
        if (!/^[a-zA-Z\s]+$/.test(name)) {
            nameError.textContent = 'Name can only contain letters and spaces';
            return false;
        }
        
        nameError.textContent = '';
        return true;
    }

    function saveProfile() {
        const formData = new FormData(form);
        let interests = [];
        
        // Collect selected interests
        document.querySelectorAll('input[name="interests"]:checked').forEach(checkbox => {
            interests.push(checkbox.value);
        });
        
        // Collect custom interests
        const customInterests = formData.get('customInterests');
        if (customInterests) {
            interests = interests.concat(customInterests.split(',').map(item => item.trim()).filter(item => item.length > 0));
        }
        
        const user = {
            name: formData.get('name'),
            bio: formData.get('bio'),
            lookingFor: formData.get('lookingFor'),
            interests: interests,
            avatar: formData.get('avatar'),
            connections: JSON.parse(localStorage.getItem('twinsparkUser')).connections || []
        };
        
        localStorage.setItem('twinsparkUser', JSON.stringify(user));
        
        // Also update Supabase if user is authenticated
        if (window.authService && window.authService.user) {
            window.authService.updateUserProfile({
                username: user.name,
                bio: user.bio,
                looking_for: user.lookingFor,
                interests: user.interests,
                avatar: user.avatar
            }).then(result => {
                if (result.error) {
                    console.error('Error updating profile in Supabase:', result.error);
                }
            });
        }
        
        // Show success message
        showMessage('Profile saved successfully!', 'success');
        
        // Redirect to match page after a delay
        setTimeout(() => {
            window.location.href = 'match.html';
        }, 1500);
    }
}

// Reveal page functionality
function setupRevealPage() {
    const agreeBtn = document.getElementById('agreeBtn');
    const declineBtn = document.getElementById('declineBtn');
    const revealResult = document.getElementById('revealResult');
    const revealActions = document.getElementById('revealActions');
    const yourStatus = document.getElementById('yourStatus');
    const yourIndicator = document.getElementById('yourIndicator');
    const matchStatus = document.getElementById('matchStatus');
    const matchIndicator = document.getElementById('matchIndicator');

    let userAgreed = false;
    let matchAgreed = false;

    agreeBtn.addEventListener('click', function() {
        userAgreed = true;
        yourStatus.textContent = 'Ready to reveal';
        yourIndicator.textContent = '✅';
        agreeBtn.disabled = true;
        declineBtn.disabled = true;
        
        // Simulate match decision after delay
        setTimeout(() => {
            simulateMatchDecision();
        }, 2000);
    });

    declineBtn.addEventListener('click', function() {
        yourStatus.textContent = 'Keeping anonymous';
        yourIndicator.textContent = '❌';
        agreeBtn.disabled = true;
        declineBtn.disabled = true;
        
        // Simulate match decision after delay
        setTimeout(() => {
            matchStatus.textContent = 'Also keeping anonymous';
            matchIndicator.textContent = '❌';
            
            setTimeout(() => {
                showMessage('Both users chose to remain anonymous. Chat ended.', 'info');
                setTimeout(() => {
                    window.location.href = 'match.html';
                }, 2000);
            }, 1000);
        }, 1500);
    });

    function simulateMatchDecision() {
        // Simulate match agreeing (80% chance)
        matchAgreed = Math.random() > 0.2;
        
        if (matchAgreed && userAgreed) {
            matchStatus.textContent = 'Ready to reveal';
            matchIndicator.textContent = '✅';
            
            setTimeout(() => {
                showRevealResult();
            }, 1000);
        } else {
            matchStatus.textContent = 'Keeping anonymous';
            matchIndicator.textContent = '❌';
            
            setTimeout(() => {
                showMessage('Your match chose to remain anonymous. Chat ended.', 'info');
                setTimeout(() => {
                    window.location.href = 'match.html';
                }, 2000);
            }, 1000);
        }
    }

    function showRevealResult() {
        revealActions.style.display = 'none';
        revealResult.style.display = 'block';
        
        // Load user data
        const user = JSON.parse(localStorage.getItem('twinsparkUser'));
        const dummyUsers = JSON.parse(localStorage.getItem('dummyUsers'));
        const matchUser = dummyUsers[Math.floor(Math.random() * dummyUsers.length)];
        
        // Update revealed profiles
        document.getElementById('yourName').textContent = user.name || 'Your Name';
        document.getElementById('yourBio').textContent = user.bio || 'Your bio here...';
        document.getElementById('matchName').textContent = matchUser.name;
        document.getElementById('matchBio').textContent = matchUser.bio;
        
        // Add to connection history
        addToConnectionHistory(matchUser);
        
        // Setup add connection button
        const addConnectionBtn = document.querySelector('.add-connection-btn');
        addConnectionBtn.addEventListener('click', function() {
            showMessage('Connection added to your network!', 'success');
            addConnectionBtn.disabled = true;
            addConnectionBtn.textContent = 'Added ✓';
        });
    }
}

// Add connection to history
function addToConnectionHistory(matchUser) {
    const user = JSON.parse(localStorage.getItem('twinsparkUser'));
    const connection = {
        id: matchUser.id,
        name: matchUser.name,
        avatar: matchUser.avatar,
        interests: matchUser.interests,
        connectedAt: new Date().toISOString(),
        status: 'connected'
    };
    
    user.connections.push(connection);
    localStorage.setItem('twinsparkUser', JSON.stringify(user));
}

// Load and display connection history
function loadConnectionHistory() {
    const historyList = document.getElementById('historyList');
    const user = JSON.parse(localStorage.getItem('twinsparkUser'));
    
    if (!user.connections || user.connections.length === 0) {
        historyList.innerHTML = '<p style="text-align: center; color: #666;">No connections yet. Start matching to build your network!</p>';
        return;
    }
    
    historyList.innerHTML = '';
    
    user.connections.forEach(connection => {
        const historyItem = document.createElement('div');
        historyItem.className = 'history-item';
        
        const connectedDate = new Date(connection.connectedAt).toLocaleDateString();
        
        historyItem.innerHTML = `
            <div class="history-avatar">${connection.avatar}</div>
            <div class="history-details">
                <h4>${connection.name}</h4>
                <p>Connected on ${connectedDate}</p>
            </div>
            <div class="history-status connected">${connection.status}</div>
        `;
        
        historyList.appendChild(historyItem);
    });
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
    
    // Auto remove after 3 seconds
    setTimeout(() => {
        messageDiv.style.transform = 'translateX(100%)';
        setTimeout(() => {
            messageDiv.remove();
        }, 300);
    }, 3000);
}

// Utility function to get avatar emoji
function getAvatarEmoji(avatarId) {
    const avatars = {
        '1': '🌟',
        '2': '🎨',
        '3': '🚀',
        '4': '💎'
    };
    return avatars[avatarId] || '🌟';
}

// Utility function to calculate match score
function calculateMatchScore(userInterests, matchInterests) {
    const commonInterests = userInterests.filter(interest => 
        matchInterests.includes(interest)
    );
    
    const totalInterests = new Set([...userInterests, ...matchInterests]).size;
    
    if (totalInterests === 0) return 0;
    
    return Math.round((commonInterests.length / totalInterests) * 100);
}

// Utility function to format time
function formatTime(date) {
    return new Intl.DateTimeFormat('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
    }).format(date);
}

// Export functions for use in other files
window.TwinSpark = {
    showMessage,
    getAvatarEmoji,
    calculateMatchScore,
    formatTime
};
