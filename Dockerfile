# syntax=docker/dockerfile:1

# Stage 1: reusable base image with production deps + app sources.
FROM node:20-alpine AS base
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY bin ./bin
COPY src ./src
COPY README.md ./README.md

ENV NODE_ENV=production

# Stage 2: runtime image built from the base stage above.
FROM base AS runtime
WORKDIR /app

# Forward docker run arguments directly to the OCR CLI.
ENTRYPOINT ["node", "./bin/ocr.js"]

