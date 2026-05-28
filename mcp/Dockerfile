FROM python:3.11-slim

WORKDIR /app

COPY pyproject.toml .
RUN pip install --no-cache-dir mcp>=1.0.0 httpx>=0.27.0 python-dotenv>=1.0.0

COPY . .

ENV PYTHONPATH=/app
ENV PCCM_API_URL=http://pccm-api:8000/api

CMD ["python", "server.py"]
