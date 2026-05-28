FROM python:3.11-slim

WORKDIR /app

# System deps
RUN apt-get update && apt-get install -y curl && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY pyproject.toml .
RUN pip install --no-cache-dir -e ".[dev]" 2>/dev/null || pip install --no-cache-dir \
    fastapi>=0.111.0 \
    uvicorn[standard]>=0.29.0 \
    pydantic>=2.7.0 \
    grpcio>=1.64.0 \
    grpcio-tools>=1.64.0 \
    redis>=5.0.0 \
    openai>=1.30.0 \
    httpx>=0.27.0 \
    sentence-transformers>=3.0.0 \
    python-dotenv>=1.0.0

COPY . .

# Generate gRPC stubs from proto file (copied from core)
# Note: proto stubs should be pre-generated in a real CI pipeline
RUN python -c "import grpc_tools.protoc; print('grpc_tools ready')" 2>/dev/null || true

EXPOSE 8000

ENV PYTHONPATH=/app
ENV PYTHONUNBUFFERED=1

CMD ["python", "-m", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
