// ===== Navigation Toggle =====
document.addEventListener('DOMContentLoaded', function() {
    // Toggle nav groups
    const navGroups = document.querySelectorAll('.nav-group-header');
    
    navGroups.forEach(header => {
        header.addEventListener('click', function() {
            const parent = this.parentElement;
            parent.classList.toggle('collapsed');
        });
    });
    
    // Mark current page as active
    const currentPath = window.location.pathname;
    const navItems = document.querySelectorAll('.nav-item, .nav-subitem');
    
    navItems.forEach(item => {
        if (
            item.getAttribute('href') &&
            currentPath.includes(item.getAttribute('href').replace('../', '').replace('./', ''))
        ) {
            item.classList.add('active');
            
            // Expand parent group if subitem is active
            const parentGroup = item.closest('.nav-group');
            if (parentGroup) {
                parentGroup.classList.remove('collapsed');
            }
        }
    });

    // ===== Ẩn "Đăng ký lịch làm" cho fulltime KHÔNG thuộc team CS =====
    if (window.Auth && typeof Auth.getCurrentUser === 'function') {
        const user = Auth.getCurrentUser();
        if (user) {
            const employmentType = (user.employmentType || 'parttime').toLowerCase();
            const permissions   = user.permissions || {};
            const isCS          = !!permissions.cs;
            const isPartTime    = employmentType !== 'fulltime';

            // Rule:
            // - Part-time (mọi team): vẫn dùng schedule
            // - Fulltime team CS: vẫn dùng schedule
            // - Fulltime không thuộc CS (MO): ẩn luôn schedule
            const canUseSchedule =
                isPartTime ||
                (employmentType === 'fulltime' && isCS);

            if (!canUseSchedule) {
                // Ẩn tất cả link menu trỏ tới schedule
                const scheduleNavs = document.querySelectorAll(
                    'a.nav-item[href$="schedule.html"], ' +
                    'a.nav-item[href*="schedule.html"], ' +
                    'a.nav-item[data-schedule-link]'
                );
                scheduleNavs.forEach(function(link) {
                    link.style.display = 'none';
                });

                // Ẩn card truy cập nhanh "Đăng ký lịch làm" (ở index)
                const scheduleCards = document.querySelectorAll(
                    '[data-schedule-card], .card-schedule'
                );
                scheduleCards.forEach(function(card) {
                    card.style.display = 'none';
                });
            }
        }
    }
    
    // ===== Mobile Menu Toggle (Hamburger) =====
    initMobileMenu();
});

/**
 * Initialize mobile menu with hamburger button
 */
function initMobileMenu() {
    const menuBtn = document.getElementById('mobile-menu-btn');
    const menuBackdrop = document.getElementById('mobile-menu-backdrop');
    const sidebar = document.querySelector('.sidebar');

    if (!menuBtn || !menuBackdrop || !sidebar) return;

    // Show/hide hamburger button based on screen size
    function updateMenuBtnVisibility() {
        const isMobile = window.innerWidth <= 768;
        menuBtn.style.display = isMobile ? 'flex' : 'none';

        // Reset sidebar state on desktop
        if (!isMobile) {
            closeMobileMenu();
        }
    }

    // Open mobile menu
    function openMobileMenu() {
        sidebar.classList.add('mobile-menu-open');
        menuBackdrop.classList.add('active');
        menuBtn.classList.add('active');
        document.body.style.overflow = 'hidden';
    }

    // Close mobile menu
    function closeMobileMenu() {
        sidebar.classList.remove('mobile-menu-open');
        menuBackdrop.classList.remove('active');
        menuBtn.classList.remove('active');
        document.body.style.overflow = '';
    }

    // Toggle menu
    function toggleMobileMenu() {
        if (sidebar.classList.contains('mobile-menu-open')) {
            closeMobileMenu();
        } else {
            openMobileMenu();
        }
    }

    // Event listeners
    menuBtn.addEventListener('click', toggleMobileMenu);
    menuBackdrop.addEventListener('click', closeMobileMenu);

    // Close menu when clicking nav items
    const navItems = sidebar.querySelectorAll('.nav-item, .nav-subitem');
    navItems.forEach(item => {
        item.addEventListener('click', () => {
            // Delay to allow navigation to happen
            setTimeout(closeMobileMenu, 200);
        });
    });

    // Initial check and resize listener
    updateMenuBtnVisibility();
    window.addEventListener('resize', updateMenuBtnVisibility);
}

// ===== Quiz Functions =====
function selectOption(questionId, optionIndex) {
    // Remove selected class from all options in this question
    const options = document.querySelectorAll(`#question-${questionId} .quiz-option`);
    options.forEach(opt => opt.classList.remove('selected'));
    
    // Add selected class to clicked option
    const selectedOption = document.querySelector(
        `#question-${questionId} .quiz-option:nth-child(${optionIndex + 1})`
    );
    if (selectedOption) {
        selectedOption.classList.add('selected');
    }
    
    // Store answer
    if (!window.quizAnswers) {
        window.quizAnswers = {};
    }
    window.quizAnswers[questionId] = optionIndex;
}

function submitQuiz(correctAnswers) {
    if (!window.quizAnswers) {
        alert('Vui lòng trả lời tất cả các câu hỏi!');
        return;
    }
    
    let score = 0;
    const totalQuestions = Object.keys(correctAnswers).length;
    
    Object.keys(correctAnswers).forEach(questionId => {
        if (window.quizAnswers[questionId] === correctAnswers[questionId]) {
            score++;
        }
    });
    
    const percentage = Math.round((score / totalQuestions) * 100);
    
    // Show result
    const resultDiv = document.getElementById('quiz-result');
    if (resultDiv) {
        resultDiv.innerHTML = `
            <div class="quiz-result-content">
                <h3>Kết quả bài kiểm tra</h3>
                <div class="quiz-score">${score}/${totalQuestions}</div>
                <div class="quiz-percentage">${percentage}%</div>
                <p>${
                    percentage >= 80
                        ? '🎉 Xuất sắc! Bạn đã pass bài test!'
                        : percentage >= 60
                        ? '👍 Khá tốt! Cần ôn lại một số nội dung.'
                        : '📚 Cần học lại và làm bài test lần nữa.'
                }</p>
            </div>
        `;
        resultDiv.style.display = 'block';
    }
}

// ===== Table of Contents =====
function generateTOC() {
    const content = document.querySelector('.content-section');
    const tocContainer = document.getElementById('toc');
    
    if (!content || !tocContainer) return;
    
    const headings = content.querySelectorAll('h2, h3');
    let tocHTML = '<ul>';
    
    headings.forEach((heading, index) => {
        const id = `heading-${index}`;
        heading.id = id;
        const level = heading.tagName === 'H2' ? '' : 'toc-sub';
        tocHTML += `<li class="${level}"><a href="#${id}">${heading.textContent}</a></li>`;
    });
    
    tocHTML += '</ul>';
    tocContainer.innerHTML = tocHTML;
}

// ===== Smooth Scroll =====
document.addEventListener('click', function(e) {
    if (e.target.tagName === 'A' && e.target.getAttribute('href')?.startsWith('#')) {
        e.preventDefault();
        const targetId = e.target.getAttribute('href').substring(1);
        const targetElement = document.getElementById(targetId);
        
        if (targetElement) {
            targetElement.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
        }
    }
});
