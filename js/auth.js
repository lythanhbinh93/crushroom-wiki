/**
 * Crush Room Wiki - Authentication System
 * Sử dụng Google Sheets làm database
 */

const Auth = {
    // Bật/tắt chế độ mock
    // true  = dùng danh sách user trong _mockLogin (không gọi API)
    // false = gọi API_URL (Apps Script)
    USE_MOCK: false,

    // Google Apps Script Web App URL
    API_URL: 'https://script.google.com/macros/s/AKfycbzOQp8ld92Z3xeI0rDN1ybR7xEougub9qBndITVnoxWJ_C-UqxkI8iW4byfhQ8Sb6Py/exec',
    
    // Storage keys
    STORAGE_KEY: 'crushroom_wiki_auth',
    LOGS_KEY: 'crushroom_page_logs',
    
    /**
     * Đăng nhập
     * @param {string} email 
     * @param {string} password 
     * @returns {Promise<{success: boolean, message?: string, user?: object}>}
     */
    async login(email, password) {
        try {
            // Nếu đang bật mock hoặc chưa cấu hình API_URL -> dùng mock
            if (this.USE_MOCK || !this.API_URL) {
                return this._mockLogin(email, password);
            }

            const response = await fetch(this.API_URL, {
                method: 'POST',
                redirect: 'follow', // giúp follow redirect của Apps Script
                headers: {
                    // dùng text/plain để tránh preflight CORS
                    'Content-Type': 'text/plain;charset=utf-8',
                },
                body: JSON.stringify({
                    action: 'login',
                    email: email,
                    password: password
                })
            });

            const data = await response.json();

            if (data.success) {
                this._saveSession(data.user);
            }

            return data;
        } catch (error) {
            console.error('Login error:', error);
            return {
                success: false,
                message: 'Lỗi kết nối. Vui lòng thử lại.'
            };
        }
    },
    
    /**
     * Mock login cho development/testing
     * Admin có thể thay đổi danh sách này hoặc setup Google Sheets
     */
    _mockLogin(email, password) {
        // Danh sách user mẫu - THAY ĐỔI THEO NHU CẦU
        const mockUsers = [
            {
                email: 'admin@crushroom.vn',
                password: 'admin123',
                name: 'Admin',
                role: 'admin',
                permissions: {
                    cs: true,
                    marketing: true,
                    laser: true
                }
            },
            {
                email: 'cs@crushroom.vn',
                password: 'cs123',
                name: 'CS Team',
                role: 'staff',
                permissions: {
                    cs: true,
                    marketing: false,
                    laser: false
                }
            },
            {
                email: 'marketing@crushroom.vn',
                password: 'mkt123',
                name: 'Marketing Team',
                role: 'staff',
                permissions: {
                    cs: false,
                    marketing: true,
                    laser: false
                }
            },
            {
                email: 'laser@crushroom.vn',
                password: 'laser123',
                name: 'Laser Team',
                role: 'staff',
                permissions: {
                    cs: false,
                    marketing: false,
                    laser: true
                }
            },
            {
                email: 'test@test.com',
                password: 'test123',
                name: 'Test User',
                role: 'staff',
                permissions: {
                    cs: true,
                    marketing: true,
                    laser: true
                }
            }
        ];
        
        const user = mockUsers.find(u => 
            u.email.toLowerCase() === email.toLowerCase() && 
            u.password === password
        );
        
        if (user) {
            // Remove password before saving
            const { password: _, ...userWithoutPassword } = user;
            this._saveSession(userWithoutPassword);
            return {
                success: true,
                user: userWithoutPassword
            };
        }
        
        return {
            success: false,
            message: 'Email hoặc mật khẩu không đúng'
        };
    },
    
    /**
     * Đăng xuất
     */
    logout() {
        localStorage.removeItem(this.STORAGE_KEY);
        window.location.href = this._getBasePath() + 'login.html';
    },
    
    /**
     * Kiểm tra đã đăng nhập chưa
     * @returns {boolean}
     */
    isLoggedIn() {
        const session = this._getSession();
        return session !== null;
    },
    
    /**
     * Lấy thông tin user hiện tại
     * @returns {object|null}
     */
    getCurrentUser() {
        return this._getSession();
    },
    
    /**
     * Kiểm tra quyền truy cập module
     * @param {string} module - 'cs', 'marketing', 'laser'
     * @returns {boolean}
     */
    hasPermission(module) {
        const user = this.getCurrentUser();
        if (!user) return false;
        
        // Admin có tất cả quyền
        if (user.role === 'admin') return true;
        
        return user.permissions && user.permissions[module] === true;
    },
    
    /**
     * Yêu cầu đăng nhập - gọi ở đầu mỗi trang
     * Redirect về login nếu chưa đăng nhập
     */
    requireAuth() {
        if (!this.isLoggedIn()) {
            window.location.href = this._getBasePath() + 'login.html';
            return false;
        }
        return true;
    },
    
    /**
     * Yêu cầu quyền truy cập module
     * @param {string} module 
     * @returns {boolean}
     */
    requirePermission(module) {
        if (!this.requireAuth()) return false;
        
        if (!this.hasPermission(module)) {
            this._showAccessDenied();
            return false;
        }
        return true;
    },
    
    /**
     * Ghi log xem trang
     * @param {string} pageName - Tên trang (optional, tự detect từ URL)
     */
    async logPageView(pageName = null) {
        const user = this.getCurrentUser();
        if (!user) return;
        
        // Tự detect tên trang từ URL nếu không truyền vào
        if (!pageName) {
            pageName = this._getPageNameFromURL();
        }
        
        const logEntry = {
            timestamp: new Date().toISOString(),
            userEmail: user.email,
            userName: user.name,
            page: pageName,
            url: window.location.pathname
        };
        
        // Nếu dùng mock hoặc chưa có API_URL, lưu local
        if (this.USE_MOCK || !this.API_URL) {
            this._saveLogLocal(logEntry);
            return;
        }
        
        // Gọi API ghi log
        try {
            fetch(this.API_URL, {
                method: 'POST',
                redirect: 'follow',
                headers: {
                    'Content-Type': 'text/plain;charset=utf-8',
                },
                body: JSON.stringify({
                    action: 'logPageView',
                    log: logEntry
                })
            });
        } catch (error) {
            console.error('Error logging page view:', error);
            // Fallback to local storage
            this._saveLogLocal(logEntry);
        }
    },
    
    /**
     * Lưu log vào localStorage (fallback)
     */
    _saveLogLocal(logEntry) {
        try {
            const logs = JSON.parse(localStorage.getItem(this.LOGS_KEY) || '[]');
            logs.push(logEntry);
            // Giữ tối đa 1000 logs gần nhất
            if (logs.length > 1000) {
                logs.splice(0, logs.length - 1000);
            }
            localStorage.setItem(this.LOGS_KEY, JSON.stringify(logs));
        } catch (error) {
            console.error('Error saving log to localStorage:', error);
        }
    },
    
    /**
     * Lấy tên trang từ URL
     */
    _getPageNameFromURL() {
        const path = window.location.pathname;
        
        // Map path to readable name
        const pageNames = {
            '/index.html': 'Trang chủ',
            '/admin.html': 'Admin Panel',
            '/login.html': 'Đăng nhập',
            '/pages/schedule.html': 'Đăng ký lịch làm',
            '/pages/cs/library.html': 'CS - Thư viện học tập',
            '/pages/cs/quiz.html': 'CS - Bài kiểm tra',
            '/pages/cs/quick-replies.html': 'CS - Quick Replies',
            '/pages/cs/training/module-1-foundation.html': 'CS - Module 1: Nền tảng',
            '/pages/cs/training/module-2-products.html': 'CS - Module 2: Sản phẩm',
            '/pages/cs/training/module-3-consulting.html': 'CS - Module 3: Kỹ năng tư vấn',
            '/pages/cs/training/module-4-advanced.html': 'CS - Module 4: Nghiệp vụ nâng cao',
            '/pages/cs/training/module-5-cases.html': 'CS - Module 5: Case Study',
            '/pages/cs/products/pix-collection.html': 'CS - PIX Collection',
            '/pages/cs/products/engraved-collection.html': 'CS - Engraved Collection',
            '/pages/cs/products/warm-love.html': 'CS - WarmLove',
            '/pages/cs/products/memory-book.html': 'CS - Memory Book',
            '/pages/cs/skills/mo-dau-tro-chuyen.html': 'CS - Mở đầu trò chuyện',
            '/pages/cs/skills/xu-ly-tu-choi.html': 'CS - Xử lý từ chối',
            '/pages/marketing/library.html': 'Marketing - Thư viện',
            '/pages/marketing/quiz.html': 'Marketing - Bài kiểm tra',
            '/pages/laser/guide.html': 'Laser - Hướng dẫn',
            '/pages/laser/lightburn.html': 'Laser - Thông số Lightburn'
        };
        
        // Tìm matching path
        for (const [key, value] of Object.entries(pageNames)) {
            if (path.endsWith(key) || path === key) {
                return value;
            }
        }
        
        // Fallback: lấy tên file
        const fileName = path.split('/').pop() || 'Unknown';
        return fileName.replace('.html', '');
    },
    
    /**
     * Hiển thị popup không có quyền
     */
    _showAccessDenied() {
        // Tạo overlay
        const overlay = document.createElement('div');
        overlay.id = 'access-denied-overlay';
        overlay.innerHTML = `
            <div class="access-denied-modal">
                <div class="access-denied-icon">🔒</div>
                <h2>Không có quyền truy cập</h2>
                <p>Bạn chưa được cấp quyền truy cập module này.</p>
                <p>Vui lòng liên hệ Admin để được hỗ trợ.</p>
                <div class="access-denied-actions">
                    <a href="${this._getBasePath()}index.html" class="btn-back">← Về trang chủ</a>
                    <a href="https://m.me/crushroom.vn" target="_blank" class="btn-contact">Liên hệ Admin</a>
                </div>
            </div>
        `;
        
        // Thêm style
        const style = document.createElement('style');
        style.textContent = `
            #access-denied-overlay {
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0,0,0,0.8);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 10000;
            }
            .access-denied-modal {
                background: white;
                padding: 48px;
                border-radius: 24px;
                text-align: center;
                max-width: 400px;
                margin: 20px;
            }
            .access-denied-icon {
                font-size: 64px;
                margin-bottom: 16px;
            }
            .access-denied-modal h2 {
                color: #c62828;
                margin-bottom: 12px;
            }
            .access-denied-modal p {
                color: #666;
                margin-bottom: 8px;
            }
            .access-denied-actions {
                margin-top: 24px;
                display: flex;
                gap: 12px;
                justify-content: center;
                flex-wrap: wrap;
            }
            .access-denied-actions a {
                padding: 12px 24px;
                border-radius: 8px;
                text-decoration: none;
                font-weight: 500;
            }
            .btn-back {
                background: #f5f5f5;
                color: #333;
            }
            .btn-contact {
                background: #e91e63;
                color: white;
            }
        `;
        
        document.head.appendChild(style);
        document.body.appendChild(overlay);
    },
    
    /**
     * Render UI elements cho authenticated user
     * Gọi sau khi page load
     */
    renderAuthUI() {
        const user = this.getCurrentUser();
        if (!user) return;
        
        // Log page view
        this.logPageView();
        
        // Update user info trong sidebar nếu có
        const userInfo = document.querySelector('.user-info');
        if (userInfo) {
            userInfo.innerHTML = `
                <div class="user-avatar">${user.name.charAt(0).toUpperCase()}</div>
                <div class="user-details">
                    <div class="user-name">${user.name}</div>
                    <div class="user-role">${user.role === 'admin' ? 'Admin' : 'Nhân viên'}</div>
                </div>
                <button class="btn-logout" onclick="Auth.logout()" title="Đăng xuất">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                        <polyline points="16 17 21 12 16 7"></polyline>
                        <line x1="21" y1="12" x2="9" y2="12"></line>
                    </svg>
                </button>
            `;
        }
        
        // Lock modules không có quyền
        this._lockRestrictedModules();
    },
    
    /**
     * Khóa các module không có quyền
     */
    _lockRestrictedModules() {
        const modules = ['cs', 'marketing', 'laser'];
        
        modules.forEach(module => {
            if (!this.hasPermission(module)) {
                // Tìm tất cả link đến module này
                const links = document.querySelectorAll(`[data-module="${module}"], [href*="/${module}/"]`);
                
                links.forEach(link => {
                    link.classList.add('locked');
                    link.addEventListener('click', (e) => {
                        e.preventDefault();
                        this._showAccessDenied();
                    });
                });
                
                // Khóa nav group
                const navGroup = document.querySelector(`[data-module-group="${module}"]`);
                if (navGroup) {
                    navGroup.classList.add('locked');
                }
            }
        });
        
        // Ẩn link Admin nếu không phải admin
        const user = this.getCurrentUser();
        if (user && user.role !== 'admin') {
            const adminLinks = document.querySelectorAll('[data-admin-only]');
            adminLinks.forEach(link => {
                link.style.display = 'none';
            });
        }
    },
    
    /**
     * Lưu session vào localStorage
     */
    _saveSession(user) {
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify({
            user: user,
            loginAt: new Date().toISOString()
        }));
    },
    
    /**
     * Lấy session từ localStorage
     */
    _getSession() {
        try {
            const data = localStorage.getItem(this.STORAGE_KEY);
            if (!data) return null;
            
            const session = JSON.parse(data);
            return session.user;
        } catch {
            return null;
        }
    },
    
    /**
     * Tính base path dựa vào vị trí file hiện tại
     */
    _getBasePath() {
        const path = window.location.pathname;
        
        if (path.includes('/pages/cs/training/')) return '../../../';
        if (path.includes('/pages/cs/products/')) return '../../../';
        if (path.includes('/pages/cs/skills/')) return '../../../';
        if (path.includes('/pages/cs/')) return '../../';
        if (path.includes('/pages/marketing/')) return '../../';
        if (path.includes('/pages/laser/')) return '../../';
        if (path.includes('/pages/')) return '../';
        
        return '';
    }
};

// CSS cho locked elements và user info
const authStyles = document.createElement('style');
authStyles.textContent = `
    /* User info in sidebar */
    .user-info {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 16px;
        background: #f8f9fa;
        border-radius: 12px;
        margin: 16px;
    }
    
    .user-avatar {
        width: 40px;
        height: 40px;
        background: linear-gradient(135deg, #e91e63, #9c27b0);
        color: white;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: 700;
        font-size: 16px;
    }
    
    .user-details {
        flex: 1;
    }
    
    .user-name {
        font-weight: 600;
        font-size: 14px;
        color: #333;
    }
    
    .user-role {
        font-size: 12px;
        color: #757575;
    }
    
    .btn-logout {
        background: none;
        border: none;
        padding: 8px;
        cursor: pointer;
        color: #757575;
        border-radius: 8px;
        transition: all 0.2s;
    }
    
    .btn-logout:hover {
        background: #ffebee;
        color: #c62828;
    }
    
    /* Locked modules */
    .nav-item.locked,
    .nav-subitem.locked,
    .nav-group.locked .nav-group-header,
    .module-card.locked {
        opacity: 0.5;
        position: relative;
    }
    
    .nav-item.locked::after,
    .nav-subitem.locked::after,
    .nav-group.locked .nav-group-header::after,
    .module-card.locked::after {
        content: "🔒";
        position: absolute;
        right: 12px;
        font-size: 14px;
    }
    
    .nav-item.locked:hover,
    .nav-subitem.locked:hover,
    .module-card.locked:hover {
        cursor: not-allowed;
    }
    
    .module-card.locked {
        pointer-events: auto !important;
    }
    
    .module-card.locked .module-header {
        filter: grayscale(50%);
    }
`;
document.head.appendChild(authStyles);
