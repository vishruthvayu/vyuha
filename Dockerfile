FROM node:22-slim AS client
WORKDIR /build
COPY client/package*.json ./
RUN npm ci --no-audit --no-fund
COPY client/ ./
# client/src/sensors-v2.ts imports ../../server/config/sensors-v2.json
COPY server/config/ /server/config/
RUN npm run build

FROM python:3.12-slim
WORKDIR /app
COPY server/requirements.lock.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt
COPY server/ ./server/
COPY --from=client /build/dist ./client/dist/
RUN useradd --create-home trainer && mkdir /app/data && chown trainer:trainer /app/data
USER trainer
ENV VYUHA_DB=/app/data/vyuha.db
EXPOSE 8000
CMD ["python", "-m", "uvicorn", "server.main:app", "--host", "0.0.0.0", "--port", "8000"]
