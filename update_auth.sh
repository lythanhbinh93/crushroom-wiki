#!/bin/bash

# Script cập nhật authentication cho tất cả các trang

# Danh sách các file cần cập nhật
files=(
    "pages/schedule.html"
    "pages/cs/library.html"
    "pages/cs/quiz.html"
    "pages/cs/quick-replies.html"
    "pages/cs/training/module-1-foundation.html"
    "pages/cs/training/module-2-products.html"
    "pages/cs/training/module-3-consulting.html"
    "pages/cs/training/module-4-advanced.html"
    "pages/cs/training/module-5-cases.html"
    "pages/cs/products/pix-collection.html"
    "pages/cs/products/engraved-collection.html"
    "pages/cs/products/warm-love.html"
    "pages/cs/products/memory-book.html"
    "pages/cs/skills/mo-dau-tro-chuyen.html"
    "pages/cs/skills/xu-ly-tu-choi.html"
    "pages/marketing/library.html"
    "pages/marketing/quiz.html"
    "pages/laser/guide.html"
    "pages/laser/lightburn.html"
)

for file in "${files[@]}"; do
    if [ -f "$file" ]; then
        echo "Processing: $file"
    fi
done

echo "Done listing files"
