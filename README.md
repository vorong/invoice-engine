# AI-Powered Invoice ETL Pipeline

This repository contains an AI-driven ETL (Extract, Transform, Load) pipeline for automating the extraction of structured data from invoice documents.

## Project Evolution

### V1 (Legacy - Apps Script)
The `v1/` directory contains the initial implementation of the pipeline built using Google Apps Script. It leverages the Gemini API to process invoices stored in Google Drive and outputs structured data to Google Sheets. 

- **Key Features**: PDF conversion, LLM-based extraction, Google Sheets integration.
- **Status**: Maintenance mode, used as a reference for V2.
- **Documentation**: See [v1/README.md](v1/README.md) for more details.

### V2 (Current - Python)
We are currently transitioning to a more robust and scalable version (V2) using Python. This version aims to improve on the original architecture, utilizing modern Python tools and frameworks.

- **Status**: Under development.
- **Core Stack**: Python, `uv` for package management, Gemini API.

## Getting Started

### Prerequisites
- Python 3.x
- [uv](https://docs.astral.uv) installed

### Installation
```bash
uv sync
```

### Usage
(Add instructions for running V2 components as they are developed)
