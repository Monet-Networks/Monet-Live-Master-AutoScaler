const template = `
    location /-:-/rtc/ {
      proxy_pass http://-+++-:8188/;
      proxy_redirect off;
      proxy_set_header Access-Control-Allow-Origin *;
      proxy_http_version 1.1;
      proxy_set_header Upgrade $http_upgrade;
      allow all;
      proxy_set_header Connection "upgrade";
      proxy_read_timeout 86400;
      proxy_set_header Host $host;
    }

    location /-:-/many/ {
      proxy_pass http://-+++-:8092/;
      proxy_redirect off;
      proxy_set_header Access-Control-Allow-Origin *;
      proxy_http_version 1.1;
      proxy_set_header Upgrade $http_upgrade;
      allow all;
      proxy_set_header Connection "upgrade";
      proxy_read_timeout 86400;
      proxy_set_header Host $host;
    }

    location /-:-/sock/ {
      proxy_pass http://-+++-:8666;
      proxy_redirect off;
      proxy_set_header Access-Control-Allow-Origin *;
      proxy_http_version 1.1;
      proxy_set_header Upgrade $http_upgrade;
      allow all;
      proxy_set_header Connection "upgrade";
      proxy_read_timeout 86400;
      proxy_set_header Host $host;
    }

    location /-:-/admin/ {
      proxy_pass http://-+++-:7088/admin;
      proxy_redirect off;
      proxy_set_header Access-Control-Allow-Origin *;
      proxy_http_version 1.1;
      proxy_set_header Upgrade $http_upgrade;
      allow all;
      proxy_set_header Connection "upgrade";
      proxy_read_timeout 86400;
      proxy_set_header Host $host;
    }
`;

module.exports = template;
