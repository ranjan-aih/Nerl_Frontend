## 🏦 SK Finance

**SK Finance** is a centralized, high-speed interface for **document verification**. It allows administrators to upload **Photo** and **Signature** documents, compare them with **reference images**, and instantly view whether they **match or not** with a **confidence score**, **pixel difference**, and **stroke analysis**. The platform also maintains upload history, generates verification reports, and provides cost tracking.

[![Built with React](https://img.shields.io/badge/React-18%2B-61DAFB?logo=react&logoColor=white)](https://reactjs.org/)
[![Styled with Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-UtilityFirst-06B6D4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![UI: MUI](https://img.shields.io/badge/MUI-UI%20Components-007FFF?logo=mui&logoColor=white)](https://mui.com/)
[![Icons: React Icons](https://img.shields.io/badge/Icons-React%20Icons-E91E63?logo=react&logoColor=white)](https://react-icons.github.io/react-icons/)

---

## 📝 Table of Contents

1. [Overview](#-overview)
2. [Key Features](#-key-features)
3. [Tech Stack](#-tech-stack)
4. [Prerequisites](#-prerequisites)
5. [Getting Started](#-getting-started)
6. [Project Structure](#-project-structure)
7. [Contributing](#-contributing)
8. [License](#-license)

---

## 🌟 Overview

This is the frontend repository for the **SK Finance Document Verification Portal**.

The application provides a clean dashboard to:

- **Upload & Manage Documents** (Photo / Signature)
- **Compare Provided vs Reference** documents
- **Review Results** with confidence score, pixel difference, and stroke analysis
- **Generate Reports** for completed comparisons
- **Track Cost Analysis** for verification operations
- **Maintain History** with latest-first sorting and filtering

Built with **React**, styled with **Tailwind CSS**, and enhanced using **MUI** + **React Icons**.

---

## ✨ Key Features

| Feature Category | Description |
| :--- | :--- |
| **Document Upload** | Upload reference and provided documents for photo and signature verification. |
| **Smart Comparison** | Compare against reference and show match status with confidence score. |
| **Pixel Difference** | Highlights visual differences and regions where mismatch is detected. |
| **Stroke Analysis** | Signature stroke-level analysis to detect missing/changed strokes. |
| **Upload History** | Maintain log of uploaded documents with filtering and latest-first view. |
| **Report Generation** | Generate a downloadable verification report (PDF). |
| **Cost Analysis** | Displays cost usage metrics for verification operations. |
| **Clean UI** | Minimal, professional interface using Tailwind + MUI components. |

---

## 💻 Tech Stack

| Tool/Library | Purpose |
| :--- | :--- |
| **Framework** | **React (v18+)** | Building the UI and component structure. |
| **Styling** | **Tailwind CSS** | Responsive utility-first styling. |
| **UI Components** | **MUI (Material UI)** | Tables, dialogs, chips, pagination, loaders, etc. |
| **Icons** | **React Icons** | Lightweight and consistent icon set. |
| **API Client** | **Axios / Fetch** | Backend integration for upload, compare, report & history. |

---

## 🛠️ Prerequisites

Ensure you have:

- **Node.js** (LTS recommended)
- **npm / yarn / pnpm**
- A running **backend + verification service** (for upload & comparison APIs)

---

## 🚀 Getting Started

### 1) Clone the repository
```bash
git clone https://github.com/your-username/sk-finance-frontend.git
cd sk-finance-frontend
```

###2) Install dependencies
```bash
npm install
```

###3) Start development server
```bash
npm run dev
```

###4) Production build
```bash
npm run build
```

###📂 Project Structure

```text
dcb-bank-chatbot-admin-frontend/
├── public/                # Static assets (index.html, favicon)
├── src/
│   ├── assets/            # Images, custom fonts, brand assets
│   ├── components/        # Reusable UI elements (Button, Card, Table)
│   ├── features/          # Feature-specific logic
│   │   ├── analytics/     # Dashboard graphs and cost metrics
│   │   ├── chats/         # Session history and transcript auditing
│   │   └── documents/     # FAQ upload and document history management
│   ├── pages/             # Route components (Dashboard.jsx, Login.jsx)
│   ├── store/             # Redux setup, slices, and store configuration
│   ├── services/          # API integration for cost tracking and document processing
│   ├── styles/            # Global CSS and Tailwind directives
│   ├── utils/             # Helper functions, currency formatters, constants
│   └── App.jsx            # Main router component
└── vite.config.js         # Vite configuration
```


###🤝 Contributing

##1.Fork the repo

##2.Create a new branch
```bash
git checkout -b feature/new-module
```

##3. Commit changes

```bash
git commit -m "feat: add new module"

```

##4.Push & open a PR


Project maintained with ❤️ by **[ai-horizon.io](https://ai-horizon.io/)**
