// Navigation handler for dynamic login/logout across all pages
class NavigationHandler {
    constructor() {
        this.init();
    }

    async init() {
        await this.updateNavigation();
        this.setupNavigationEvents();
    }

    async updateNavigation() {
        const user = await this.getCurrentUser();
        const navActions = document.querySelector('.nav-actions');
        const navLinks = document.querySelector('.nav-links');
        const navBrand = document.querySelector('.nav-brand .logo');
        const notificationContainer = document.querySelector('.notification-container');
        
        if (!navActions) return;

        if (user) {
            // User is logged in - show dashboard navigation
            // Update brand logo to not link to index for authenticated users
            if (navBrand) {
                navBrand.innerHTML = `
                    <span class="logo-icon">⚡</span>
                    <span class="logo-text">TwinSpark</span>
                `;
                navBrand.removeAttribute('href');
                navBrand.style.cursor = 'default';
            }
            
            // Update navigation links to hide Home and show dashboard links
            if (navLinks) {
                navLinks.innerHTML = `
                    <a href="profile.html" class="nav-link">Profile</a>
                    <a href="match.html" class="nav-link">Match</a>
                    <a href="chat.html" class="nav-link">Chat</a>
                    <a href="reveal.html" class="nav-link">Reveal</a>
                `;
                
                // Update active state based on current page
                this.updateActiveNavLink();
            }
            
            // Show logout button, notifications, and discoverability toggle in nav actions
            navActions.innerHTML = `
                <div class="nav-discoverability-toggle" style="margin-right: 15px;">
                    <label for="navDiscoverabilityToggle" class="nav-toggle-label" style="display: flex; align-items: center; cursor: pointer; font-size: 14px; color: #64748b;" title="Toggle discoverability">
                        <div class="nav-toggle-switch" style="position: relative; display: inline-block; width: 44px; height: 24px;">
                            <input type="checkbox" id="navDiscoverabilityToggle" checked style="opacity: 0; width: 0; height: 0;">
                            <span class="nav-toggle-slider" style="position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: #ccc; transition: .3s; border-radius: 24px;"></span>
                        </div>
                    </label>
                </div>
                <div class="notification-container" style="position: relative; margin-right: 15px;">
                    <button class="notification-btn" id="notificationBtn" title="Notifications">
                        <span class="notification-icon">🔔</span>
                        <span class="notification-badge" id="notificationBadge" style="display: none;">0</span>
                    </button>
                    <div class="notification-dropdown" id="notificationDropdown" style="display: none;">
                        <div class="notification-header">
                            <h4>Notifications</h4>
                            <button class="mark-all-read" id="markAllRead">Mark all read</button>
                        </div>
                        <div class="notification-list" id="notificationList">
                            <p class="no-notifications">No new notifications</p>
                        </div>
                    </div>
                </div>
                <button class="btn btn-secondary" id="logoutBtn">Logout</button>
            `;
            
            // Initialize notifications
            this.initializeNotifications();
            
            // Initialize discoverability toggle
            this.initializeDiscoverabilityToggle();
            
            // Redirect to dashboard if on landing page
            if (window.location.pathname === '/' || window.location.pathname === '/index.html' || window.location.pathname.endsWith('index.html')) {
                // Check if user has completed profile to determine redirect destination
                const hasCompletedProfile = await this.hasCompletedProfile();
                if (hasCompletedProfile) {
                    window.location.href = 'match.html'; // Dashboard = Match page for completed users
                } else {
                    window.location.href = 'profile.html'; // Force profile completion
                }
            }
        } else {
            // User is not logged in - show public navigation
            // Update brand logo to link to index for unauthenticated users
            if (navBrand) {
                navBrand.innerHTML = `
                    <span class="logo-icon">⚡</span>
                    <span class="logo-text">TwinSpark</span>
                `;
                navBrand.setAttribute('href', 'index.html');
                navBrand.style.cursor = 'pointer';
            }
            
            if (navLinks) {
                navLinks.innerHTML = `
                    <a href="index.html" class="nav-link active">Home</a>
                    <a href="#features" class="nav-link">Features</a>
                    <a href="auth.html" class="nav-link">Sign In</a>
                `;
            }
            
            navActions.innerHTML = `
                <a href="auth.html" class="btn btn-primary">Get Started</a>
            `;
            
            // Redirect to auth if trying to access protected pages
            const protectedPages = ['profile.html', 'match.html', 'chat.html', 'reveal.html'];
            const currentPage = window.location.pathname.split('/').pop();
            if (protectedPages.includes(currentPage)) {
                window.location.href = 'auth.html';
            }
        }
    }

    async getCurrentUser() {
        try {
            if (typeof supabase === 'undefined') {
                return null;
            }
            const { data: { user } } = await supabase.auth.getUser();
            return user;
        } catch (error) {
            console.error('Error getting current user:', error);
            return null;
        }
    }
    
    async hasCompletedProfile() {
        try {
            const user = await this.getCurrentUser();
            if (!user || typeof supabase === 'undefined') {
                return false;
            }

            const { data, error } = await supabase
                .from('users')
                .select('interests, looking_for, bio, username')
                .eq('id', user.id)
                .single();

            if (error) {
                console.error('Error checking profile completion:', error);
                return false;
            }

            // Consider profile complete if user has username, at least one interest, and bio
            return data && 
                   data.username &&
                   data.interests && 
                   data.interests.length > 0 && 
                   data.bio && 
                   data.bio.trim().length > 0;
        } catch (error) {
            console.error('Error checking profile completion:', error);
            return false;
        }
    }
    
    updateActiveNavLink() {
        const navLinks = document.querySelectorAll('.nav-link');
        const currentPage = window.location.pathname.split('/').pop() || 'index.html';
        
        navLinks.forEach(link => {
            link.classList.remove('active');
            const linkPage = link.getAttribute('href');
            if (linkPage === currentPage || 
                (currentPage === '' && linkPage === 'index.html') ||
                (currentPage === 'index.html' && linkPage === 'index.html')) {
                link.classList.add('active');
            }
        });
    }

    setupNavigationEvents() {
        // Handle logout
        document.addEventListener('click', async (e) => {
            if (e.target.id === 'logoutBtn') {
                e.preventDefault();
                await this.handleLogout();
            }
            
            // Handle notification button
            if (e.target.closest('#notificationBtn')) {
                e.preventDefault();
                this.toggleNotifications();
            }
            
            // Handle mark all read
            if (e.target.id === 'markAllRead') {
                e.preventDefault();
                this.markAllNotificationsRead();
            }
        });

        // Close notification dropdown when clicking outside
        document.addEventListener('click', (e) => {
            const notificationBtn = document.getElementById('notificationBtn');
            const notificationDropdown = document.getElementById('notificationDropdown');
            
            if (notificationBtn && notificationDropdown && 
                !notificationBtn.contains(e.target) && 
                !notificationDropdown.contains(e.target)) {
                notificationDropdown.style.display = 'none';
            }
        });
    }

    async handleLogout() {
        try {
            if (typeof supabase === 'undefined') {
                window.location.href = 'index.html';
                return;
            }
            
            const { error } = await supabase.auth.signOut();
            if (error) throw error;
            
            // Redirect to landing page after logout
            window.location.href = 'index.html';
        } catch (error) {
            console.error('Error logging out:', error);
            alert('Error logging out. Please try again.');
        }
    }

    initializeNotifications() {
        // Load notification count and setup real-time updates
        this.loadNotificationCount();
        this.setupNotificationUpdates();
    }

    async loadNotificationCount() {
        try {
            const user = await this.getCurrentUser();
            if (!user || typeof supabase === 'undefined') return;

            // Query actual notifications from the database
            // You would typically have a notifications table with user_id, type, read status, etc.
            const { data: notifications, error } = await supabase
                .from('notifications')
                .select('id, read')
                .eq('user_id', user.id)
                .eq('read', false);

            if (error) {
                console.error('Error fetching notifications:', error);
                // Fall back to simulated count
                const unreadCount = Math.floor(Math.random() * 5); // Simulated for demo
                this.updateNotificationBadge(unreadCount);
                return;
            }

            const unreadCount = notifications ? notifications.length : 0;
            this.updateNotificationBadge(unreadCount);
        } catch (error) {
            console.error('Error loading notification count:', error);
            // Fall back to simulated count for demo
            const unreadCount = Math.floor(Math.random() * 3);
            this.updateNotificationBadge(unreadCount);
        }
    }

    updateNotificationBadge(count) {
        const badge = document.getElementById('notificationBadge');
        if (badge) {
            if (count > 0) {
                badge.textContent = count > 99 ? '99+' : count.toString();
                badge.style.display = 'flex';
            } else {
                badge.style.display = 'none';
            }
        }
    }

    toggleNotifications() {
        const dropdown = document.getElementById('notificationDropdown');
        if (dropdown) {
            const isVisible = dropdown.style.display === 'block';
            dropdown.style.display = isVisible ? 'none' : 'block';
            
            if (!isVisible) {
                this.loadNotifications();
            }
        }
    }

    async loadNotifications() {
        const notificationList = document.getElementById('notificationList');
        if (!notificationList) return;

        try {
            const user = await this.getCurrentUser();
            if (!user || typeof supabase === 'undefined') {
                notificationList.innerHTML = '<p class="no-notifications">No notifications available</p>';
                return;
            }

            // Query actual notifications from the database
            const { data: notifications, error } = await supabase
                .from('notifications')
                .select('id, title, message, type, read, created_at')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false })
                .limit(10);

            if (error) {
                console.error('Error fetching notifications:', error);
                // Show demo notifications
                this.showDemoNotifications(notificationList);
                return;
            }
            
            if (!notifications || notifications.length === 0) {
                notificationList.innerHTML = '<p class="no-notifications">No new notifications</p>';
            } else {
                notificationList.innerHTML = notifications.map(notification => `
                    <div class="notification-item ${notification.read ? 'read' : 'unread'}">
                        <div class="notification-content">
                            <h5>${notification.title}</h5>
                            <p>${notification.message}</p>
                            <small>${new Date(notification.created_at).toLocaleDateString()}</small>
                        </div>
                    </div>
                `).join('');
            }
        } catch (error) {
            console.error('Error loading notifications:', error);
            this.showDemoNotifications(notificationList);
        }
    }
    
    showDemoNotifications(notificationList) {
        // Demo notifications for testing
        const demoNotifications = [
            {
                title: "New Match Found!",
                message: "You have a new match with similar interests",
                created_at: new Date().toISOString(),
                read: false
            },
            {
                title: "New Message",
                message: "You received a new message in your chat",
                created_at: new Date(Date.now() - 3600000).toISOString(),
                read: false
            },
            {
                title: "Profile View",
                message: "Someone viewed your profile",
                created_at: new Date(Date.now() - 7200000).toISOString(),
                read: true
            }
        ];
        
        notificationList.innerHTML = demoNotifications.map(notification => `
            <div class="notification-item ${notification.read ? 'read' : 'unread'}">
                <div class="notification-content">
                    <h5>${notification.title}</h5>
                    <p>${notification.message}</p>
                    <small>${new Date(notification.created_at).toLocaleDateString()}</small>
                </div>
            </div>
        `).join('');
    }

    setupNotificationUpdates() {
        // Setup real-time notification updates here
        // This would typically involve Supabase real-time subscriptions
        console.log('Notification updates initialized');
    }

    async markAllNotificationsRead() {
        try {
            const user = await this.getCurrentUser();
            if (!user || typeof supabase === 'undefined') return;

            // Mark all notifications as read in database
            const { error } = await supabase
                .from('notifications')
                .update({ read: true })
                .eq('user_id', user.id)
                .eq('read', false);

            if (error) {
                console.error('Error marking notifications as read:', error);
            }
            
            this.updateNotificationBadge(0);
            this.loadNotifications();
        } catch (error) {
            console.error('Error marking notifications as read:', error);
            // Still update UI even if database update fails
            this.updateNotificationBadge(0);
            this.loadNotifications();
        }
    }

    async initializeDiscoverabilityToggle() {
        const toggle = document.getElementById('navDiscoverabilityToggle');
        if (!toggle) return;
        
        // Load current discoverability setting
        try {
            const user = await this.getCurrentUser();
            if (user && typeof supabase !== 'undefined') {
                const { data, error } = await supabase
                    .from('users')
                    .select('is_discoverable')
                    .eq('id', user.id)
                    .single();
                    
                if (!error && data) {
                    toggle.checked = data.is_discoverable !== false; // Default to true if null
                }
            }
        } catch (error) {
            console.error('Error loading discoverability setting:', error);
            toggle.checked = true; // Default to discoverable
        }
        
        // Add event listener for toggle changes  
        toggle.addEventListener('change', async function() {
            const isDiscoverable = this.checked;
            
            try {
                const user = await window.navigationHandler.getCurrentUser();
                if (user && typeof supabase !== 'undefined') {
                    // Update in database
                    const { error } = await supabase
                        .from('users')
                        .update({ is_discoverable: isDiscoverable })
                        .eq('id', user.id);
                    
                    if (error) {
                        console.error('Error updating discoverability:', error);
                        // Revert toggle on error
                        this.checked = !isDiscoverable;
                        alert('Failed to update discovery setting. Please try again.');
                    } else {
                        const statusText = isDiscoverable ? 'visible to others' : 'hidden from others';
                        console.log(`You are now ${statusText} in match results`);
                    }
                } else {
                    alert('Please log in to save this setting');
                }
            } catch (error) {
                console.error('Error toggling discoverability:', error);
                // Revert toggle on error
                this.checked = !isDiscoverable;
                alert('Network error. Please try again.');
            }
        });
    }
}

// Initialize navigation when DOM is loaded
if (typeof window !== 'undefined') {
    document.addEventListener('DOMContentLoaded', () => {
        window.navigationHandler = new NavigationHandler();
    });

    // Also update navigation on auth state changes
    // Wait for supabase to be available
    const initAuthListener = () => {
        if (typeof supabase !== 'undefined') {
            supabase.auth.onAuthStateChange((event, session) => {
                if (window.navigationHandler) {
                    window.navigationHandler.updateNavigation();
                }
            });
        } else {
            // Retry after a short delay if supabase isn't loaded yet
            setTimeout(initAuthListener, 100);
        }
    };
    
    initAuthListener();
}
