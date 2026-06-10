# Nginx 反向代理指南

本指南说明我会如何使用 Nginx 将本项目作为静态站点发布。

## 1. 静态站点部署

如果将本仓库按静态文件部署，可使用如下配置。

```nginx
server {
    listen 80;
    server_name example.com;

    root /var/www/sqlite-review;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location ~* \.(js|css|png|jpg|jpeg|gif|svg|ico|woff2?)$ {
        expires 7d;
        add_header Cache-Control "public, max-age=604800, immutable";
    }
}
```

## 2. HTTPS（Let's Encrypt 场景）

在证书文件准备好后使用如下配置。

```nginx
server {
    listen 80;
    server_name example.com www.example.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name example.com www.example.com;

    ssl_certificate /etc/letsencrypt/live/example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/example.com/privkey.pem;

    ssl_session_timeout 1d;
    ssl_session_cache shared:SSL:10m;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers off;

    root /var/www/sqlite-review;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

## 3. 校验与重载

```bash
sudo nginx -t
sudo systemctl reload nginx
```

## 4. 说明

- 这个项目不需要后端 API 服务。
- 如果你希望完全离线可用，我会建议把 `sql.js` 也一起本地化。
