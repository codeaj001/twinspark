// Chat JavaScript File
// Handles real-time chat functionality with local storage simulation

document.addEventListener('DOMContentLoaded', function() {
    initializeChat();
});

let currentMatch = null;
let messages = [];
let chatInterval = null;

// Initialize chat interface
function initializeChat() {
    // Get current match from session storage
    const matchData = sessionStorage.getItem('currentMatch');
    if (!matchData) {
        TwinSpark.showMessage('No active match found. Redirecting to match page...', 'error');
        setTimeout(() => {
            window.location.href = 'match.html';
        }, 2000);
        return;
    }

    currentMatch = JSON.parse(matchData);
    
    // Set up chat header
    setupChatHeader();
    
    // Initialize messages
    initializeMessages();
    
    // Set up event listeners
    setupEventListeners();
    
    // Start simulation of incoming messages
    startChatSimulation();
}

// Set up chat header with match info
function setupChatHeader() {
    const chatAvatar = document.getElementById('chatAvatar');
    const chatUserName = document.getElementById('chatUserName');
    
    chatAvatar.textContent = currentMatch.avatar;
    chatUserName.textContent = `Anonymous User`;
    
    // Add pulsing animation for online status
    const onlineStatus = document.querySelector('.online-status');
    onlineStatus.style.animation = 'pulse 2s infinite';
}

// Initialize messages with a welcome message
function initializeMessages() {
    const welcomeMessage = {
        id: Date.now(),
        text: `Hi! I saw we have some common interests. How's your day going?`,
        sender: 'match',
        timestamp: new Date()
    };
    
    messages = [welcomeMessage];
    renderMessages();
}

// Set up event listeners for chat functionality
function setupEventListeners() {
    const messageInput = document.getElementById('messageInput');
    const sendBtn = document.getElementById('sendBtn');
    const revealBtn = document.getElementById('revealBtn');
    const endChatBtn = document.getElementById('endChatBtn');
    const reportBtn = document.getElementById('reportBtn');
    
    // Send message on button click
    sendBtn.addEventListener('click', sendMessage);
    
    // Send message on Enter key press
    messageInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            sendMessage();
        }
    });
    
    // Reveal identity button
    revealBtn.addEventListener('click', function() {
        TwinSpark.showMessage('Redirect to reveal page...', 'info');
        setTimeout(() => {
            window.location.href = 'reveal.html';
        }, 1000);
    });
    
    // End chat button
    endChatBtn.addEventListener('click', function() {
        if (confirm('Are you sure you want to end this chat?')) {
            endChat();
        }
    });
    
    // Report button
    reportBtn.addEventListener('click', function() {
        if (confirm('Do you want to report this user?')) {
            TwinSpark.showMessage('Report submitted. Thank you for helping keep TwinSpark safe.', 'info');
            setTimeout(() => {
                window.location.href = 'match.html';
            }, 2000);
        }
    });
    
    // Auto-resize input
    messageInput.addEventListener('input', function() {
        this.style.height = 'auto';
        this.style.height = this.scrollHeight + 'px';
    });
}

// Send a message
function sendMessage() {
    const messageInput = document.getElementById('messageInput');
    const messageText = messageInput.value.trim();
    
    if (messageText === '') return;
    
    // Create message object
    const message = {
        id: Date.now(),
        text: messageText,
        sender: 'user',
        timestamp: new Date()
    };
    
    // Add to messages array
    messages.push(message);
    
    // Clear input
    messageInput.value = '';
    messageInput.style.height = 'auto';
    
    // Render messages
    renderMessages();
    
    // Simulate typing indicator
    showTypingIndicator();
    
    // Simulate response after delay
    setTimeout(() => {
        hideTypingIndicator();
        generateResponse(messageText);
    }, 1000 + Math.random() * 2000);
}

// Generate automated response
function generateResponse(userMessage) {
    const responses = [
        "That's really interesting! Tell me more.",
        "I totally agree with you on that.",
        "Wow, I never thought about it that way.",
        "That sounds amazing! I'd love to hear more.",
        "I have a similar experience too!",
        "That's one of my favorite things as well!",
        "You seem like a really thoughtful person.",
        "I'm enjoying our conversation so much.",
        "We definitely have a lot in common!",
        "That's exactly how I feel about it too."
    ];
    
    // Select random response
    const response = responses[Math.floor(Math.random() * responses.length)];
    
    const message = {
        id: Date.now(),
        text: response,
        sender: 'match',
        timestamp: new Date()
    };
    
    messages.push(message);
    renderMessages();
}

// Show typing indicator
function showTypingIndicator() {
    const chatMessages = document.getElementById('chatMessages');
    
    const typingDiv = document.createElement('div');
    typingDiv.className = 'message typing-indicator';
    typingDiv.innerHTML = `
        <div class="message-bubble">
            <div class="typing-dots">
                <span></span><span></span><span></span>
            </div>
        </div>
    `;
    
    chatMessages.appendChild(typingDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Hide typing indicator
function hideTypingIndicator() {
    const typingIndicator = document.querySelector('.typing-indicator');
    if (typingIndicator) {
        typingIndicator.remove();
    }
}

// Render all messages
function renderMessages() {
    const chatMessages = document.getElementById('chatMessages');
    chatMessages.innerHTML = '';
    
    messages.forEach(message => {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${message.sender === 'user' ? 'own' : ''}`;
        
        messageDiv.innerHTML = `
            <div class="message-bubble">
                ${message.text}
                <div class="message-time">${TwinSpark.formatTime(message.timestamp)}</div>
            </div>
        `;
        
        chatMessages.appendChild(messageDiv);
    });
    
    // Auto-scroll to bottom
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Start chat simulation with random messages
function startChatSimulation() {
    // Clear any existing interval
    if (chatInterval) {
        clearInterval(chatInterval);
    }
    
    // Send random messages every 15-30 seconds
    chatInterval = setInterval(() => {
        if (Math.random() > 0.7) { // 30% chance
            const randomMessages = [
                "What do you like to do in your free time?",
                "Are you from around here?",
                "What's your favorite thing about this place?",
                "I love that we share similar interests!",
                "Do you come here often?",
                "What's the best thing that happened to you today?"
            ];
            
            const randomMessage = randomMessages[Math.floor(Math.random() * randomMessages.length)];
            
            const message = {
                id: Date.now(),
                text: randomMessage,
                sender: 'match',
                timestamp: new Date()
            };
            
            messages.push(message);
            renderMessages();
        }
    }, 20000); // Check every 20 seconds
}

// End chat
function endChat() {
    if (chatInterval) {
        clearInterval(chatInterval);
    }
    
    TwinSpark.showMessage('Chat ended. Redirecting to match page...', 'info');
    
    // Clear session storage
    sessionStorage.removeItem('currentMatch');
    
    setTimeout(() => {
        window.location.href = 'match.html';
    }, 2000);
}

// Clean up when page is about to unload
window.addEventListener('beforeunload', function() {
    if (chatInterval) {
        clearInterval(chatInterval);
    }
});

// Add CSS for typing indicator
const style = document.createElement('style');
style.textContent = `
    .typing-indicator {
        opacity: 0.7;
    }
    
    .typing-dots {
        display: flex;
        gap: 4px;
        padding: 8px 0;
    }
    
    .typing-dots span {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: #999;
        animation: typing 1.4s infinite;
    }
    
    .typing-dots span:nth-child(1) { animation-delay: 0s; }
    .typing-dots span:nth-child(2) { animation-delay: 0.2s; }
    .typing-dots span:nth-child(3) { animation-delay: 0.4s; }
    
    @keyframes typing {
        0%, 60%, 100% { transform: translateY(0); }
        30% { transform: translateY(-10px); }
    }
    
    @keyframes pulse {
        0% { opacity: 1; }
        50% { opacity: 0.5; }
        100% { opacity: 1; }
    }
`;
document.head.appendChild(style);
