# ============================================
# LedgerParse Node.js Dockerfile
# Includes poppler-utils, tesseract, ghostscript
# ============================================

FROM node:20-slim

# Install system dependencies required for PDF processing
RUN apt-get update && apt-get install -y --no-install-recommends \
    # poppler-utils provides pdftotext and pdfinfo
    poppler-utils \
    # tesseract for OCR fallback
    tesseract-ocr \
    tesseract-ocr-eng \
    # ghostscript for PDF manipulation
    ghostscript \
    # Required for some PDF operations
    libpoppler-dev \
    # Clean up apt cache
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy package files first for better caching
COPY package*.json ./

# Install Node.js dependencies
RUN npm ci --only=production

# Copy application code
COPY . .

# Build the Next.js application
RUN npm run build

# Expose port
EXPOSE 3000

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:3000/api/health || exit 1

# Start the application
CMD ["npm", "start"]
