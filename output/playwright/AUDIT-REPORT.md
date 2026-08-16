# Quick Filler — Combined UX + Design Audit Report

## 1. Audit Scope

**Product:** Quick Filler — PDF transcription web app (Brazilian labor documents)  
**Type:** Combined UX + Accessibility audit  
**Flow:** Full end-to-end user journey  
**Screens captured:** 8 screenshots across all app states  
**Date:** 2026-08-16

### Screenshots

| #   | File                              | State                                 |
| --- | --------------------------------- | ------------------------------------- |
| 01  | `01-upload-empty.png`             | Upload screen — empty form            |
| 02  | `02-upload-holerite-selected.png` | Upload — holerite type selected       |
| 03  | `03-upload-file-selected.png`     | Upload — PDF file selected            |
| 04  | `04-processing.png`               | Processing state (polling)            |
| 05  | `05-review-timecard.png`          | Review — time card table + PDF viewer |
| 06  | `06-review-mobile.png`            | Review — mobile viewport (375px)      |
| 07  | `07-review-edited.png`            | Review — after editing a cell         |
| 08  | `08-upload-fresh.png`             | Upload — fresh state                  |

---

## 2. User Goal and Accessibility Target

**User goal:** Upload a labor document PDF (time card or pay stub), review/correct the extracted data in an editable table, and download a corrected spreadsheet.

**Accessibility target:** The app handles sensitive labor data for Brazilian workers — accessibility is critical because the user base includes workers with varying digital literacy and potential assistive technology needs.

---

## 3. Strengths

- **Sound conceptual flow:** Upload → processing → review → export is logical and matches user expectations for a document transcription tool.
- **Inline editable table:** Cells are directly editable `<input>` fields — intuitive for correcting extracted data without modal dialogs.
- **Multiple export formats:** Offering Excel, CSV, and JSON covers different user workflows (HR systems, data analysis, archival).
- **Specific validation errors:** When a cell value is invalid, the error message states the expected format and what was received — highly actionable feedback.
- **Double-click guard:** The upload button prevents duplicate submissions — good defensive UX.
- **Auto-save with debounce:** Edits are persisted 500ms after the last keystroke — reduces data loss risk without requiring explicit save actions.
- **Warning badges per row:** Color-coded warnings (yellow for warnings, red for errors) draw attention to data quality issues at the row level.
- **PDF viewer alongside table:** Side-by-side layout for cross-referencing source document with extracted data is the right design choice.

---

## 4. UX Risks

### Critical

| #   | Finding                                                                                                                                                                   | Screenshot | Impact                                                                                              |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | --------------------------------------------------------------------------------------------------- |
| U1  | **Download links have zero spacing** — "Baixar Excel (.xlsx)Baixar CSVBaixar JSON" appears as one unreadable string. Users cannot distinguish the three separate actions. | 05, 06, 07 | Users may not realize they can download, or may click the wrong format.                             |
| U2  | **PDF viewer fails silently** — "Failed to load PDF file." with no retry, no fallback, no collapsed state. Wastes ~40% of viewport on a dead element.                     | 04, 05, 06 | Users cannot verify transcription against the source document — the core review workflow is broken. |
| U3  | **Error messages are visually invisible** — Validation errors appear as plain black text with no color, icon, background, or `role="alert"`. Users may not notice them.   | 07         | Users won't know their edits failed to save.                                                        |

### High

| #   | Finding                                                                                                                                 | Screenshot | Impact                                                          |
| --- | --------------------------------------------------------------------------------------------------------------------------------------- | ---------- | --------------------------------------------------------------- |
| U4  | **No drag-and-drop file upload** — Only a native browser "Choose File" button. Modern users expect drag-and-drop zones.                 | 01, 08     | Friction at the entry point; perceived as outdated/low-quality. |
| U5  | **No file type guidance** — The UI doesn't communicate that only PDFs are accepted, or the 20MB size limit.                             | 01, 08     | Users may try uploading images, Word docs, or oversized files.  |
| U6  | **Submit button state unclear** — The disabled gray button doesn't explain why it's disabled or what the user needs to do.              | 01, 08     | Confusion at the first interaction point.                       |
| U7  | **No "upload another" or "start over" button** on the review screen — users feel stuck after reviewing.                                 | 05, 06, 07 | Dead-end navigation; user must reload or manually navigate.     |
| U8  | **Localization bug** — Error message mixes English "month" into Portuguese UI: "month deve ser '01' a '12'" should be "mês deve ser..." | 07         | Breaks trust; signals low polish.                               |

### Medium

| #   | Finding                                                                                                                                          | Screenshot | Impact                                                                        |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------ | ---------- | ----------------------------------------------------------------------------- |
| U9  | **Ambiguous placeholder values** — "0?" for Mês and "????" for Ano with no explanation of what they mean or how to fix them.                     | 05, 07     | Users don't know if extraction failed or if they should correct these values. |
| U10 | **No loading/progress indicator** after clicking "Enviar e processar" — the processing state appears but with no estimated time or progress bar. | 04         | Users don't know if processing will take 5 seconds or 5 minutes.              |
| U11 | **No success/completion message** — the review screen appears without any "Transcription complete!" confirmation.                                | 05         | Abrupt transition; users may not realize processing finished.                 |
| U12 | **No undo/reset mechanism** — accidental edits cannot be reverted to original extracted values.                                                  | 07         | Data loss risk during review.                                                 |

---

## 5. Accessibility Risks

### Critical

| #   | Finding                                                                                                                                                                               | Screenshot | WCAG         |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ------------ |
| A1  | **All form inputs lack `<label>` elements** — radio buttons, file input, and table cells have no programmatic label association. Screen readers announce "edit text" with no context. | 01-08      | 1.3.1, 4.1.2 |
| A2  | **Color-only warning indicators** — "Página vazia" uses only an orange/amber background to convey status. No icon or text alternative.                                                | 05, 06     | 1.4.1        |
| A3  | **Error messages not in `role="alert"` regions** — validation errors won't be announced by assistive technology.                                                                      | 07         | 4.1.3        |

### High

| #   | Finding                                                                                                                             | Screenshot | WCAG  |
| --- | ----------------------------------------------------------------------------------------------------------------------------------- | ---------- | ----- |
| A4  | **No ARIA landmarks** — no `<main>`, `<header>`, `<nav>`, or `<footer>` elements. Screen readers cannot navigate by landmark.       | 01-08      | 1.3.1 |
| A5  | **Radio group not in `<fieldset>`/`<legend>`** — "Tipo de documento" label is not programmatically associated with the radio group. | 01, 02, 08 | 1.3.1 |
| A6  | **Table lacks `<caption>` or `aria-label`** — the data table has no accessible name.                                                | 05, 06, 07 | 1.3.1 |
| A7  | **PDF viewer navigation buttons are unlabeled** — screen readers announce "button" with no context for page navigation.             | 05, 06     | 4.1.2 |
| A8  | **Download links concatenated** — no separators or distinct text; fails info and relationships.                                     | 05, 06     | 1.3.1 |

### Medium

| #   | Finding                                                                                                             | Screenshot | WCAG  |
| --- | ------------------------------------------------------------------------------------------------------------------- | ---------- | ----- |
| A9  | **No focus indicators visible** — default browser focus rings may be insufficient for keyboard navigation.          | 01-08      | 2.4.7 |
| A10 | **Touch targets too close on mobile** — download links are adjacent with no spacing; fat-finger risk.               | 06         | 2.5.8 |
| A11 | **No `aria-invalid` state on edited fields** — the Mês input with invalid "09:00" doesn't indicate its error state. | 07         | 4.1.2 |
| A12 | **File selection not in `aria-live` region** — screen readers won't announce when a file is selected.               | 03         | 4.1.3 |

---

## 6. Opportunity Areas

1. **Styled upload experience** — Replace the bare form with a centered card, drag-and-drop zone, file type badges (PDF), and size limit indicator. This is the first screen users see — it should establish trust.

2. **Responsive download bar** — Style download links as distinct buttons with icons (Excel/CSV/JSON) and clear visual separation. On mobile, stack vertically.

3. **Collapsible PDF viewer** — On mobile, collapse the PDF section by default with an expand toggle. On desktop, show it side-by-side with the table as intended.

4. **Inline field validation** — Add red borders, error icons, and `aria-describedby` associations for invalid fields. Use `role="alert"` for error messages.

5. **Progress indication** — Add an estimated processing time or progress bar during document transcription.

6. **Empty state guidance** — On the upload screen, add an illustration or icon showing a PDF being transformed into a spreadsheet, with brief instructions.

7. **Navigation controls** — Add a "Upload another document" button on the review screen and a visible "Back" action.

8. **Localization audit** — Fix the "month"/"mês" bug and review all user-facing strings for consistent Portuguese.

---

## 7. Evidence Limits

- **No login/auth flow** — the app has no authentication, so no auth-related UX was audited.
- **Single document tested** — only one time card PDF was uploaded; pay stub (holerite) flow was not visually captured due to processing time constraints.
- **PDF rendering failure** — the PDF viewer failed to render in the headless browser, so the side-by-side review experience could not be fully evaluated.
- **No error state captured** — the "Não foi possível transcrever" error state was not triggered during this audit.
- **No concurrent users** — the audit did not test rate limiting, concurrent uploads, or race conditions.
- **Keyboard navigation not tested** — only visual/mouse interaction was captured; full keyboard-only navigation was not verified.

---

## 8. Recommendations (Prioritized)

### P0 — Fix immediately (broken UX)

1. **Separate download links** with proper spacing, visual delimiters, or styled buttons.  
   _File:_ `packages/frontend/src/components/DownloadButton.tsx`

2. **Handle PDF viewer failure** — add a retry button, fallback message, and collapse the section when the PDF cannot load.  
   _File:_ `packages/frontend/src/components/PdfViewer/PdfViewerInner.tsx`

3. **Style error messages** — add red color, warning icon, background, and `role="alert"`.  
   _File:_ `packages/frontend/src/App.tsx` (save error display)

### P1 — Fix soon (accessibility compliance)

4. **Add `<label>` elements** to all form inputs (radio buttons, file input, table cells).  
   _Files:_ `Upload.tsx`, `ReviewTable.tsx`

5. **Wrap radio group in `<fieldset>`/`<legend>`**.  
   _File:_ `packages/frontend/src/components/Upload/Upload.tsx`

6. **Add ARIA landmarks** (`<main>`, `<header>`) and table `<caption>`.  
   _File:_ `packages/frontend/src/App.tsx`

7. **Add non-color indicators** for warning badges (icon + text, not just background color).  
   _File:_ `packages/frontend/src/components/WarningBadge.tsx`

### P2 — Improve (UX polish)

8. **Style the upload form** — center in a card, add drag-and-drop zone, show file type/size limits.  
   _File:_ `packages/frontend/src/components/Upload/Upload.tsx`

9. **Fix localization** — "month" → "mês" in error messages.  
   _File:_ Backend validation messages (likely in `packages/domain/` or `packages/infrastructure/`)

10. **Add "Upload another" button** on the review screen.  
    _File:_ `packages/frontend/src/App.tsx`

11. **Add processing progress indicator** with estimated time.  
    _File:_ `packages/frontend/src/App.tsx`

12. **Improve mobile experience** — stack download buttons vertically, collapse PDF viewer, add `inputmode="numeric"` for numeric fields.  
    _Files:_ `DownloadButton.tsx`, `PdfViewer.tsx`, `ReviewTable.tsx`
