# AutoResume AI (Manifest V3 Smart ATS AutoFill & Ingestion Copilot)

AutoResume AI is a secure, local-first browser extension designed to eliminate the friction of filling out repetitive job applications across Applicant Tracking Systems (ATS) like Workday, Greenhouse, Lever, and custom platforms (including Google Forms).

---

## Key Features

1. **Eliminating Redundancy**: AutoResume AI maps your resume fields (education, work details, contact info) directly to job portal inputs, filling them in with a single click.
2. **Context-Aware Word Tailoring**: ATS portals often have strict character/word limits (e.g., 100, 250, or 500 words for project or role descriptions). You can shrink or expand project and experience summaries into formatted bulleted lists using Gemini AI directly in the focused textarea.
3. **Smart Semantic Split Carousel**: Focusing on a project description field displays a dedicated **Projects Carousel** to browse and tailor individual projects. Focusing on a job experience field displays a dedicated **Work Experience Carousel** (no manual toggles required).
4. **Universal Field Selector**: If automatic matching fails, clicking *"🔍 Select field manually..."* opens a comprehensive drawer to search, copy, or inject *any* parsed master profile field—including specific company details, project tech stacks, or university GPA/coursework.
5. **Absolute Local Privacy**: AutoResume AI runs entirely client-side. Your resume, credentials, and API keys are stored locally, encrypted with **AES-GCM (256-bit)** using a master password you control. No central middleman server is involved.

---

## Technical Highlights
* **WXT Framework**: Chrome Manifest V3 standard extension builder.
* **React + Tailwind CSS**: Responsive, modern, and dark-themed candidate dashboard.
* **Closed Shadow DOM**: Popovers are injected inside a closed shadow root, guaranteeing no styling leaks or interference with host pages.
* **Controlled State Bypass**: Intercepts native inputs and dispatches synthetic React/Vue events (`setNativeValue`) to prevent job forms from clearing autofilled inputs upon submission.
* **ARIA Accessibility Extraction**: Resolves modern forms (like Google Forms or Workday) by tracing `aria-labelledby` and `aria-label` tags to identify question labels.

---

## How to Clone and Run This Project

### 1. Prerequisites
Ensure you have the following installed on your machine:
* **Node.js** (v18.0.0 or higher recommended)
* **npm** (v9.0.0 or higher)

### 2. Clone the Repository
Clone this repository to your local machine using git:
```bash
git clone https://github.com/ShashankUmarVaishy/Auto-Resume-AI.git
cd Auto-Resume-AI
```

### 3. Install Dependencies
Install all package dependencies via npm:
```bash
npm install
```

### 4. Build and Compile
We use WXT for compiling and bundling our Manifest V3 extension.

* **Development (Hot Reloading)**: Launches a dev browser instance that updates automatically on code changes:
  ```bash
  npm run dev
  ```
* **Production Compilation**: Performs type-checking and compiles the TS/TSX assets into standard production-ready browser extension code inside `.output/chrome-mv3/`:
  ```bash
  npm run compile
  npm run zip
  ```

---

## How to Load the Extension in Google Chrome

Once the build is compiled (`npm run zip` or `npm run compile`), follow these steps to load it into Chrome:

1. Open Google Chrome and navigate to **`chrome://extensions/`** (or click the Extensions puzzle icon in the toolbar and select *Manage Extensions*).
2. Enable **Developer mode** by toggling the switch in the top-right corner.
3. Click the **"Load unpacked"** button in the top-left corner.
4. Select the `.output/chrome-mv3` folder inside your cloned repository directory.
5. The **AutoResume AI** extension card will appear. Keep this tab open if you need to hit **Reload 🔄** after recompiling!

---

## How to Use the Extension

### Step 1: Configure Your Profile
1. Click on the extension card details (or click the puzzle icon in the browser toolbar, pin **AutoResume AI**, and click the icon).
2. If this is your first run, click the **"Configure Profile"** shortcut.
3. Navigate to **Settings** and enter your **Google Gemini API Key** and a **Master Password** to lock your credentials, then save.
4. Navigate to the **Profile** tab:
   * **Import PDF/DOCX**: Click **Import Resume**, select your CV file, and click **Parse Resume**. Gemini 1.5 Flash will structures your resume into the visual form automatically.
   * **Manual visual forms**: You can review and edit every parsed detail, including contact info, projects, education history, and work accomplishments.
   * **Save**: Hit **Save Profile** to encrypt and sync changes.

### Step 2: Test on Sandbox / Job Boards
1. Open the testing sandbox included in this repository: [mock_ats.html](mock_ats.html) in your browser.
2. Click on the **First Name** input field. A **`✨ Fill`** spark button will float next to it.
3. Click `✨ Fill`. Since you have unlocked your profile, the popover will automatically inject the matching values.
4. Focus a project textarea. The popover will automatically display the **Projects Carousel**—you can click to autofill the raw description, or click `100/250/500 words` to generate formatted pointwise bullet points of that length!
5. To inject other non-matched data, click **"Select field manually..."** and click on any specific profile entry.

---

## Document References
* **Detailed Architecture Guide**: [implementation.md](implementation.md)
* **Local Test Sandbox**: [mock_ats.html](mock_ats.html)
