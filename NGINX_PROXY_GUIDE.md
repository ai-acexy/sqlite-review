# Nginx Reverse Proxy Guide

This guide shows how I would publish this project with Nginx as a static site.

## 1. Static Site Hosting

If you deploy this repository as static files:

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

## 2. HTTPS (Let's Encrypt style)

Use this after you have certificate files.

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

## 3. Validation and Reload

```bash
sudo nginx -t
sudo systemctl reload nginx
```

## 4. Notes

- This project does not require an API server.
- If you want to avoid CDN dependency, I would also vendor `sql.js` locally before deployment.
