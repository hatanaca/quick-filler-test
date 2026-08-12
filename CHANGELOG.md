# Changelog

All notable changes to this project will be documented in this file.

## [1.0.0] - 2026-08-11

### Added

- Initial project structure (DDD monorepo with npm workspaces)
- Domain layer: `Transcription` entity, value objects (Money, Punch, DayRecord, PageHolerite, RowHighlight), warning calculator, highlight detector, spreadsheet builder, ports
- Application layer: create/get/update/process/export use cases, event bus, result parser
- Infrastructure layer: Fastify server, security middleware (helmet, CORS, rate limit), PDF extraction (pdfjs-dist), OCR (Tesseract.js), spreadsheet exporters (xlsx/csv/json), in-memory repository, disk storage
- Frontend: upload with progress, editable review table with warnings, PDF viewer, downloads
- Docker: multi-stage Dockerfile, docker-compose, nginx reverse proxy
- GitHub: CI workflow, issue/PR templates, SECURITY.md, dependabot, CODEOWNERS
- Tests: 177 unit/integration/E2E tests (TDD)
- Documentation: bilingual PT-BR/EN (README, CONTRIBUTING, docs/)
- Scripts: synthetic PDF generation, deliverable spreadsheet generation
