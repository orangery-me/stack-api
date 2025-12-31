#!/bin/bash

# Sử dụng: ./deploy.sh

set -e

echo "🚀 Bắt đầu deploy Stack App..."

# Kiểm tra Docker
if ! command -v docker &> /dev/null; then
    echo "Docker chưa được cài đặt. Vui lòng cài đặt Docker trước."
    exit 1
fi

if ! command -v docker-compose &> /dev/null; then
    echo "Docker Compose chưa được cài đặt. Vui lòng cài đặt Docker Compose trước."
    exit 1
fi

# Kiểm tra file .env
if [ ! -f .env ]; then
    echo "File .env không tồn tại. Vui lòng tạo file .env trước khi deploy."
    exit 1
fi

# Tạo thư mục volumes nếu chưa có
echo "Tạo thư mục volumes..."
mkdir -p /home/ubuntu/api/{data,uploads,logs}
chmod -R 755 /home/ubuntu/api

# Build và start containers
echo "🔨 Building và starting containers..."
docker-compose -f docker-compose.prod.yml up -d --build

# Kiểm tra trạng thái
echo "Đợi containers khởi động..."
sleep 10

# Kiểm tra health
echo "Kiểm tra health status..."
docker-compose -f docker-compose.prod.yml ps

echo "✅ Deploy hoàn tất!"
echo ""
echo "📊 Xem logs:"
echo "   docker-compose -f docker-compose.prod.yml logs -f"
echo ""
echo "🛑 Stop containers:"
echo "   docker-compose -f docker-compose.prod.yml down"
echo ""
echo "🔄 Restart containers:"
echo "   docker-compose -f docker-compose.prod.yml restart"

