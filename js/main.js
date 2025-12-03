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
        if (item.getAttribute('href') && currentPath.includes(item.getAttribute('href').replace('../', '').replace('./', ''))) {
            item.classList.add('active');
            
            // Expand parent group if subitem is active
            const parentGroup = item.closest('.nav-group');
            if (parentGroup) {
                parentGroup.classList.remove('collapsed');
            }
        }
    });

    // ===== Ẩn menu "Đăng ký lịch làm" cho fulltime KHÔNG thuộc team CS =====
    if (window.Auth && typeof Auth.getCurrentUser === 'function') {
        const user = Auth.getCurrentUser();
        if (user) {
            const employmentType = (user.employmentType || '').toLowerCase();
            const isCS = user.permissions && user.permissions.cs;

            // Fulltime + không có quyền cs => team MO fulltime => ẩn menu
            if (employmentType === 'fulltime' && !isCS) {
                // Tất cả link trỏ tới schedule.html (ở index có thể là pages/schedule.html)
                const scheduleLinks = document.querySelectorAll(
                    'a.nav-item[href$="schedule.html"], a.nav-item[href*="schedule.html"]'
                );
                scheduleLinks.forEach(function(link) {
                    link.style.display = 'none';
                });
            }
        }
    }
    
    // Mobile menu toggle
    const menuToggle = document.querySelector('.menu-toggle');
    const sidebar = document.querySelector('.sidebar');
    
    if (menuToggle) {
        menuToggle.addEventListener('click', function() {
            sidebar.classList.toggle('open');
        });
    }
});

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
