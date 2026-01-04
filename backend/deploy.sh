#!/bin/bash

# RuoYi-FastAPI Docker部署脚本
# 适用于Ubuntu虚拟机环境

set -e

echo "=========================================="
echo "RuoYi-FastAPI Docker 部署脚本"
echo "=========================================="

# 检查Docker是否安装
if ! command -v docker &> /dev/null; then
    echo "错误: Docker未安装，请先安装Docker"
    exit 1
fi

# 检查Docker Compose是否安装
if ! command -v docker-compose &> /dev/null; then
    echo "错误: Docker Compose未安装，请先安装Docker Compose"
    exit 1
fi

echo "✓ Docker环境检查通过"

# 创建必要的目录
echo "创建必要的目录..."
mkdir -p vf_admin/upload_path
mkdir -p vf_admin/download_path
mkdir -p vf_admin/gen_path
mkdir -p logs
mkdir -p caches
mkdir -p ssl

echo "✓ 目录创建完成"

# 设置权限
echo "设置目录权限..."
chmod -R 755 vf_admin
chmod -R 755 logs
chmod -R 755 caches

echo "✓ 权限设置完成"

# 创建环境配置文件
echo "创建环境配置文件..."
cat > .env.prod << EOF
# 生产环境配置
APP_ENV=prod
APP_NAME=RuoYi-FastAPI
APP_HOST=0.0.0.0
APP_PORT=9099
APP_ROOT_PATH=/dev-api
APP_VERSION=1.0.0
APP_RELOAD=false
APP_IP_LOCATION_QUERY=true
APP_SAME_TIME_LOGIN=true

# JWT配置
JWT_SECRET_KEY=b01c66dc2c58dc6a0aabfe2144256be36226de378bf87f72c0c795dda67f4d55
JWT_ALGORITHM=HS256
JWT_EXPIRE_MINUTES=1440
JWT_REDIS_EXPIRE_MINUTES=30

# 数据库配置
DB_TYPE=mysql
DB_HOST=mysql
DB_PORT=3306
DB_USERNAME=ruoyi
DB_PASSWORD=ruoyi123
DB_DATABASE=ruoyi-fastapi
DB_ECHO=false
DB_MAX_OVERFLOW=10
DB_POOL_SIZE=50
DB_POOL_RECYCLE=3600
DB_POOL_TIMEOUT=30

# Redis配置
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_USERNAME=
REDIS_PASSWORD=
REDIS_DATABASE=2
EOF

echo "✓ 环境配置文件创建完成"

# 构建并启动服务
echo "构建并启动Docker服务..."
docker-compose down --remove-orphans
docker-compose build --no-cache
docker-compose up -d

echo "✓ Docker服务启动完成"

# 等待服务启动
echo "等待服务启动..."
sleep 30

# 检查服务状态
echo "检查服务状态..."
docker-compose ps

# 检查服务健康状态
echo "检查服务健康状态..."
for i in {1..10}; do
    if curl -f http://localhost/health > /dev/null 2>&1; then
        echo "✓ 服务健康检查通过"
        break
    else
        echo "等待服务启动... ($i/10)"
        sleep 10
    fi
done

echo "=========================================="
echo "部署完成！"
echo "=========================================="
echo "访问地址:"
echo "  - API文档: http://localhost/dev-api/docs"
echo "  - 健康检查: http://localhost/health"
echo "  - 后端服务: http://localhost:9099"
echo ""
echo "数据库信息:"
echo "  - MySQL: localhost:3306"
echo "  - 用户名: ruoyi"
echo "  - 密码: ruoyi123"
echo "  - 数据库: ruoyi-fastapi"
echo ""
echo "Redis信息:"
echo "  - Redis: localhost:6379"
echo "  - 数据库: 2"
echo ""
echo "常用命令:"
echo "  - 查看日志: docker-compose logs -f"
echo "  - 停止服务: docker-compose down"
echo "  - 重启服务: docker-compose restart"
echo "  - 进入容器: docker exec -it ruoyi-backend bash"
echo "=========================================="

