# One image serves the website and the API on the same domain.
FROM node:22-alpine AS web
WORKDIR /web
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

FROM python:3.12-slim
ENV PYTHONUNBUFFERED=1 CIVISENSE_ENV=production CIVISENSE_DATA_DIR=/data FRONTEND_DIST=/app/frontend/dist
WORKDIR /app/backend
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY backend/app ./app
COPY --from=web /web/dist /app/frontend/dist
RUN useradd -m appuser && mkdir /data && chown appuser /data
USER appuser
EXPOSE 8000
# Required at run time: CIVISENSE_SECRET, CIVISENSE_ADMIN_PASSWORD. Mount a volume at /data to keep data.
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
