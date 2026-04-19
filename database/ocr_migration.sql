-- OCR flag migration
-- Tracks whether a document required Tesseract OCR on one or more pages.
-- When true, the DocumentView UI shows an accuracy warning banner.

ALTER TABLE documents
    ADD COLUMN IF NOT EXISTS is_ocr_processed BOOLEAN DEFAULT false;
