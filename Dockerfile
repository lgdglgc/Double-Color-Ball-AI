# ==========================================
# 双色球 AI 预测系统 - Docker 镜像构建
# 基于极轻量 Alpine Nginx 镜像
# ==========================================
FROM nginx:alpine

LABEL maintainer="Double Color Ball AI Team"
LABEL description="Double Color Ball AI Prediction & Historical Analysis Web App"

# 替换默认 Nginx 配置
COPY nginx.conf /etc/nginx/conf.d/default.conf

# 复制静态前端与数据资源到 web 根目录
WORKDIR /usr/share/nginx/html
COPY index.html ./
COPY css/ ./css/
COPY js/ ./js/
COPY images/ ./images/
COPY data/ ./data/

# 暴露 HTTP 服务端口
EXPOSE 80

# 容器健康检查
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
