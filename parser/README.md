# Kendara Horoscope Parser

Subprocess invoked by the backend to OCR + parse horoscope PDFs.

## System dependencies

```bash
# Fedora
sudo dnf install tesseract poppler-utils
# Debian/Ubuntu
sudo apt install tesseract-ocr poppler-utils
# macOS
brew install tesseract poppler
```

## Python env

```bash
cd parser
python -m venv .venv
.venv/bin/pip install -r requirements.txt
```

## Smoke test

```bash
.venv/bin/python horoscope_parser.py path/to/sample.pdf | jq .
```
