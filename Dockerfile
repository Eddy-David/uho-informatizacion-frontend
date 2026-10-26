# =====================================================================
# UHO SIGACU — Frontend (React + Vite), servido con Nginx
# ---------------------------------------------------------------------
# Etapa 1: compila la aplicación con Node.
# Etapa 2: sirve los estáticos con Nginx y hace proxy de /api y /ws al
#          backend (evita CORS en producción).
# =====================================================================
FROM node:20-alpine AS builder

WORKDIR /app

ARG VITE_API_BASE_URL=/api/v1
ARG VITE_APP_NAME=SIGACU
ARG VITE_INSTITUTION_NAME=Universidad de Holguín
ARG VITE_APP_VERSION=1.0.0

ENV VITE_API_BASE_URL=${VITE_API_BASE_URL} \
    VITE_APP_NAME=${VITE_APP_NAME} \
    VITE_INSTITUTION_NAME=${VITE_INSTITUTION_NAME} \
    VITE_APP_VERSION=${VITE_APP_VERSION}

COPY package*.json ./
RUN npm ci --no-audit --no-fund || npm install --no-audit --no-fund

COPY . .
RUN npm run build


FROM nginx:1.27-alpine AS runtime

RUN rm -rf /usr/share/nginx/html/*
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx/default.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
    CMD wget -q --spider http://localhost/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
