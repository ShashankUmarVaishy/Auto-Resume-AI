# AutoResume AI - Implementation & Security Specification

This document details the system design, core components, data flows, and local security model of **AutoResume AI**.

---

## 1. System Components Architecture

The extension is divided into two execution planes: the **Ingestion/Storage Control Plane** (where the user manages their files and keys) and the **Runtime DOM Interaction Plane** (where the extension injects buttons and inputs data into job boards).

```mermaid
graph TD
    subgraph INGESTION & STORAGE PLANE
        U[PDF/DOCX Resume] -->|File Upload| PE[Parser Engine: pdf.js & mammoth]
        PE -->|Raw Text Stream| GC[Gemini AI Client]
        GC -->|OpenAPI JSON Schema| ZS[Zustand Store]
        ZS -->|AES-256 Encrypted Sync| CS[(chrome.storage.local)]
    end

    subgraph RUNTIME DOM PLANE
        JB[Job Portal: Workday / Greenhouse] -->|Focus In Event| CSG[Content Script Shadow DOM]
        CSG -->|Element ID/Name/Labels| FD[Heuristic Field Detector]
        ZS -.->|Sync Active Profile| FD
        FD -->|Classify Field Match| CSG
        CSG -->| autfill | INJ[React/Vue State Bypass Injector]
        INJ -->|Update DOM Element| JB
    end
```

---

## 2. Processing Layers

AutoResume AI operates across five separate processing layers:

### Layer 1: Client-Side Document Extraction
*   **PDF Ingestion**: `pdfjs-dist` loads the PDF as an array buffer. The worker streams text tokens from individual page elements.
*   **DOCX Ingestion**: `mammoth.js` extracts raw paragraph texts from the open-xml structure in memory.
*   *Note*: Files are parsed completely inside the browser; raw files are never transmitted to any server.

### Layer 2: Schema Extraction & JSON Normalization
*   The raw text is bundled into an instruction prompt.
*   We call Gemini 1.5 Flash, enforcing an exact JSON structure mirroring our TypeScript interface `MasterResumeProfile` via `generationConfig.responseSchema`. This guarantees structured extraction without hallucinations.

### Layer 3: Heuristic Classification (Tiers 1-4)
When an input field receives focus, the `FieldDetector` executes:
1.  **Tier 1 (Explicit attributes)**: Checks `name`, `id`, `autocomplete`, `data-automation-id`, and `placeholder`.
2.  **Tier 2 (Labels)**: Searches the DOM for associated `<label>` tags or surrounding container headers.
3.  **Tier 3 (Proximity)**: Classifies visual sibling text nodes within a vertical bounding box.
4.  **Tier 4 (Fallback)**: Matches custom snippets or triggers textarea selectors (activating the projects carousel).

### Layer 4: Floating closed Shadow DOM Injection
*   The content script injects a closed Shadow Root `attachShadow({ mode: 'closed' })` onto the webpage.
*   Tailwind CSS stylesheet contents are imported as inline strings (`tailwind.css?inline`) and appended inside the shadow root. This ensures styling is isolated from host page stylesheet definitions.
*   The popover widget renders floating next to the input, responding to focus, scroll, and window resize events.

### Layer 5: Framework State-Bypass Injection
*   ATS job forms built on React, Vue, or Angular intercept standard `.value` changes. Setting `input.value = 'john@example.com'` directly fails because the framework's internal virtual DOM does not trigger its state listeners.
*   `setNativeValue` overrides the prototype descriptor setter, updates the value, and dispatches synthetic `input`, `change`, and `blur` events so form validation systems recognize the new data.

---

## 3. Cryptographic API Key Safety Flow

We prioritize the security of the user's personal Gemini API Key. The diagram below illustrates how we keep the key safe at rest and in memory:

```mermaid
sequenceDiagram
    actor User as Candidate (User)
    participant OptionsUI as Options Page (React UI)
    participant SEC as Web Crypto API (PBKDF2/AES-GCM)
    participant DB as chrome.storage.local (Disk)
    participant MEM as Zustand Store (Memory)
    participant GEM as Google Gemini Endpoint (Direct)

    Note over User,DB: A. SETTING THE KEY & ENCRYPTION
    User->>OptionsUI: 1. Enter Gemini API Key + Password
    OptionsUI->>SEC: 2. Request encryption
    Note over SEC: Derives 256-bit AES Key<br/>from Password via PBKDF2<br/>(100,000 Iterations)
    SEC->>SEC: 3. Encrypt API Key (AES-GCM)
    SEC-->>OptionsUI: Return Ciphertext + Salt + IV
    OptionsUI->>DB: 4. Save Encrypted Key + Salt + IV to Storage
    Note over DB: API Key is stored on disk<br/>in encrypted form only

    Note over User,MEM: B. UNLOCKING THE EXTENSION
    User->>OptionsUI: 1. Enter Password to Unlock
    OptionsUI->>DB: 2. Fetch Encrypted Key & Verification Token
    DB-->>OptionsUI: Return Encrypted Data
    OptionsUI->>SEC: 3. Decrypt Verification Token & API Key
    SEC-->>OptionsUI: Return Plaintext API Key
    OptionsUI->>MEM: 4. Store Plaintext Key in-memory
    Note over MEM: Key lives in volatile RAM only.<br/>Destroyed if browser/tab closes.

    Note over User,GEM: C. AI TASKS RUNNING (PARSING/TAILORING)
    User->>OptionsUI: 1. Click "Parse Resume" or "Tailor Text"
    MEM-->>OptionsUI: Retrieve plaintext key from RAM
    OptionsUI->>GEM: 2. HTTPS POST request with key to Google
    GEM-->>OptionsUI: Return API Response
    Note over GEM: No third-party servers involved.<br/>Direct secure connection to Google.
```

### Why Your Key is Safe:
1.  **No Middleman Server**: The extension does not use a central proxy or back-end server. There is no host database where keys can be leaked. All requests go directly to Google's official endpoints.
2.  **Volatile Memory Lifecycle**: When the extension locks or closes, the plaintext key is completely cleared from memory.
3.  **Military-Grade Encryption**: The key is stored on disk encrypted using **AES-GCM (256-bit)**, which is computationally infeasible to decrypt without your master password.
4.  **Local Wipe Control**: If you suspect key exposure, clicking "Permanently Wipe Extension Storage" instantly deletes all verification tokens, resumes, profiles, and keys from Chrome's database.
