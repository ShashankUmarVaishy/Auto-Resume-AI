# AutoResume AI (Manifest V3 Smart ATS AutoFill & Ingestion Copilot)

AutoResume AI is a secure, local-first browser extension designed to eliminate the friction of filling out repetitive job applications across Applicant Tracking Systems (ATS) like Workday, Greenhouse, and Lever.

## Why This Project Helps

Applying for jobs is often a tedious process of copy-pasting the same information from your resume into different text fields. AutoResume AI solves this by:

1. **Eliminating Redundancy**: AutoResume AI maps your resume fields (education, work details, contact info) directly to job portal inputs, filling them in with a single click.
2. **Context-Aware Word Tailoring**: ATS portals often have strict character/word limits (e.g., 150 words for a project or summary). Instead of manually editing text in a separate editor, you can shrink or expand project descriptions to exactly 100, 250, or 500 words using AI directly in the textarea.
3. **Multi-Project Selector**: Textareas on job boards often ask for a description of a technical project. Our **Multi-Project Carousel** lets you swipe through and pick your BLE Smart Glove, Task Manager, or Driver Drowsiness Detection project details on the fly.
4. **Absolute Local Privacy**: Unlike other extensions that upload your resume and API keys to third-party databases, AutoResume AI runs entirely client-side. Your resume, credentials, and API keys are stored locally, encrypted with **AES-GCM (256-bit)** using a master password you control.

---

## Technical Highlights
* **WXT Framework**: Chrome Manifest V3 standard extension builder.
* **React + Tailwind CSS**: Responsive, elegant developer/candidate dashboard.
* **Closed Shadow DOM**: Popovers are injected inside a closed shadow root, guaranteeing no styling leak or interference with host pages.
* **Controlled State Bypass**: Intercepts native inputs and dispatches synthetic React/Vue events (`setNativeValue`) to prevent job forms from clearing your autofilled inputs upon submission.

---

## Quick Start & Testing

For complete instructions on running the extension locally, loading the unpacked build in Chrome, and utilizing the testing form, refer to:
* **Detailed System Architecture**: [implementation.md](file:///c:/Users/ksush/OneDrive/Programming/Project/auto_resume/implementation.md)
* **Local Test Sandbox Form**: [mock_ats.html](file:///c:/Users/ksush/OneDrive/Programming/Project/auto_resume/mock_ats.html)
