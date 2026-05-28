# ── Stage 1: Build ─────────────────────────────────────────────
FROM rust:1.78-slim AS builder

# Install system deps for protoc + openssl + rusqlite
RUN apt-get update && apt-get install -y \
    protobuf-compiler \
    libssl-dev \
    pkg-config \
    libsqlite3-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy manifests first for layer caching
COPY Cargo.toml Cargo.toml
COPY build.rs build.rs
COPY proto/ proto/

# Create placeholder source for dependency caching
RUN mkdir -p src && echo "fn main() {}" > src/main.rs && echo "" > src/lib.rs

# Pre-build deps only
RUN cargo build --release 2>/dev/null || true

# Copy real source
COPY src/ src/

# Build final binary
RUN touch src/main.rs src/lib.rs && cargo build --release

# ── Stage 2: Install grpc_health_probe ─────────────────────────
FROM debian:bookworm-slim AS health

RUN apt-get update && apt-get install -y curl && \
    curl -fsSL -o /grpc_health_probe \
    https://github.com/grpc-ecosystem/grpc-health-probe/releases/download/v0.4.25/grpc_health_probe-linux-amd64 && \
    chmod +x /grpc_health_probe

# ── Stage 3: Runtime ───────────────────────────────────────────
FROM debian:bookworm-slim

RUN apt-get update && apt-get install -y \
    libssl3 \
    libsqlite3-0 \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /app/target/release/pccm-core /usr/local/bin/pccm-core
COPY --from=health  /grpc_health_probe /usr/local/bin/grpc_health_probe

RUN mkdir -p /data

ENV PCCM_GRPC_PORT=50051
ENV SQLITE_PATH=/data/pccm.db
ENV RUST_LOG=pccm_core=info

EXPOSE 50051 8080
ENTRYPOINT ["/usr/local/bin/pccm-core"]
