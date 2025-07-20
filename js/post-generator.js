// AI Post Generator JavaScript

document.addEventListener('DOMContentLoaded', function() {
    initializePostGenerator();
});

let currentMatchId = null;

function initializePostGenerator() {
    // Get match ID from URL params or session storage
    const urlParams = new URLSearchParams(window.location.search);
    currentMatchId = urlParams.get('match_id') || sessionStorage.getItem('currentMatchId');
    
    if (!currentMatchId) {
        showMessage('No match selected. Please return to chat.', 'error');
        setTimeout(() => {
            window.location.href = 'match.html';
        }, 2000);
        return;
    }

    setupEventListeners();
    loadPreviousPosts();
}

function setupEventListeners() {
    const conversationSummary = document.getElementById('conversationSummary');
    const charCount = document.getElementById('charCount');
    const generateBtn = document.getElementById('generateBtn');
    const copyBtn = document.getElementById('copyBtn');
    const regenerateBtn = document.getElementById('regenerateBtn');
    const shareBtn = document.getElementById('shareBtn');

    // Character counter
    conversationSummary.addEventListener('input', function() {
        const count = this.value.length;
        charCount.textContent = count;
        
        if (count > 500) {
            charCount.style.color = '#ff6b6b';
        } else {
            charCount.style.color = '#666';
        }
    });

    // Generate post
    generateBtn.addEventListener('click', generatePost);

    // Copy post
    copyBtn.addEventListener('click', copyPost);

    // Regenerate post
    regenerateBtn.addEventListener('click', regeneratePost);

    // Share post
    shareBtn.addEventListener('click', sharePost);
}

async function generatePost() {
    const conversationSummary = document.getElementById('conversationSummary').value.trim();
    const selectedStyle = document.querySelector('input[name="style"]:checked').value;
    
    if (!conversationSummary) {
        showMessage('Please enter a conversation summary', 'error');
        return;
    }

    if (conversationSummary.length > 500) {
        showMessage('Summary must be 500 characters or less', 'error');
        return;
    }

    const generateBtn = document.getElementById('generateBtn');
    const originalText = generateBtn.textContent;
    generateBtn.textContent = 'Generating...';
    generateBtn.disabled = true;

    try {
        const { data, error } = await aiPostService.generatePost(currentMatchId, conversationSummary);
        
        if (error) {
            throw error;
        }

        displayGeneratedPost(data.ai_generated_post);
        showMessage('Post generated successfully!', 'success');
        
        // Refresh previous posts
        loadPreviousPosts();

    } catch (error) {
        console.error('Error generating post:', error);
        showMessage(error.message || 'Failed to generate post. Please try again.', 'error');
    } finally {
        generateBtn.textContent = originalText;
        generateBtn.disabled = false;
    }
}

function displayGeneratedPost(postContent) {
    const generatedPost = document.getElementById('generatedPost');
    const postContentDiv = document.getElementById('postContent');
    
    postContentDiv.innerHTML = `
        <div class="post-text">${postContent}</div>
        <div class="post-meta">
            <span class="post-timestamp">Generated ${new Date().toLocaleString()}</span>
            <span class="post-length">${postContent.length} characters</span>
        </div>
    `;
    
    generatedPost.style.display = 'block';
    
    // Scroll to generated post
    generatedPost.scrollIntoView({ behavior: 'smooth' });
}

function copyPost() {
    const postText = document.querySelector('.post-text').textContent;
    
    navigator.clipboard.writeText(postText).then(() => {
        showMessage('Post copied to clipboard!', 'success');
        
        // Visual feedback
        const copyBtn = document.getElementById('copyBtn');
        const originalText = copyBtn.textContent;
        copyBtn.textContent = '✓ Copied';
        copyBtn.style.background = '#4CAF50';
        
        setTimeout(() => {
            copyBtn.textContent = originalText;
            copyBtn.style.background = '';
        }, 2000);
    }).catch(err => {
        console.error('Failed to copy text:', err);
        showMessage('Failed to copy to clipboard', 'error');
    });
}

function regeneratePost() {
    generatePost();
}

function sharePost() {
    const postText = document.querySelector('.post-text').textContent;
    
    if (navigator.share) {
        navigator.share({
            title: 'TwinSpark Connection',
            text: postText,
            url: window.location.origin
        }).catch(err => console.log('Error sharing:', err));
    } else {
        // Fallback - copy to clipboard
        copyPost();
        showMessage('Post copied to clipboard for sharing!', 'info');
    }
}

async function loadPreviousPosts() {
    try {
        const posts = await aiPostService.getPostsForMatch(currentMatchId);
        
        const postsList = document.getElementById('postsList');
        const previousPosts = document.getElementById('previousPosts');
        
        if (posts.length === 0) {
            previousPosts.style.display = 'none';
            return;
        }
        
        previousPosts.style.display = 'block';
        postsList.innerHTML = '';
        
        posts.forEach(post => {
            const postItem = document.createElement('div');
            postItem.className = 'previous-post-item';
            postItem.innerHTML = `
                <div class="post-preview">
                    <div class="post-text">${post.ai_generated_post}</div>
                    <div class="post-meta">
                        <span class="post-date">${new Date(post.created_at).toLocaleDateString()}</span>
                        <button class="copy-previous-btn" onclick="copyPreviousPost('${post.ai_generated_post}')">📋</button>
                    </div>
                </div>
            `;
            postsList.appendChild(postItem);
        });
        
    } catch (error) {
        console.error('Error loading previous posts:', error);
    }
}

function copyPreviousPost(postText) {
    navigator.clipboard.writeText(postText).then(() => {
        showMessage('Previous post copied to clipboard!', 'success');
    }).catch(err => {
        console.error('Failed to copy text:', err);
        showMessage('Failed to copy to clipboard', 'error');
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
