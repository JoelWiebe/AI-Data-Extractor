# AI-Data-Extractor
This Python script leverages the power of Google's Gemini language model via Vertex AI to analyze and extract structured data from research papers in Word document format. It classifies paragraphs into relevant categories and extracts specific information like participant ages, AI types used, and intervention outcomes.

## Features

- **Word Document Parsing:** Efficiently processes Word documents (.docx), extracting text from paragraphs while considering document structure.
- **Gemini-Powered Classification:** Uses the Gemini model to classify paragraphs into predefined categories (customizable).
- **Targeted Data Extraction:**  Extracts specific information using Gemini based on prompts tailored to the desired data types (e.g., participant ages).
- **Structured Output:** Produces an Excel (.xlsx) file with one row per extracted variable, including the filename, paragraph, sentence, and extracted value.
- **Timestamped Results:** Appends a timestamp to the output file name for easy tracking.
- **Unit Tests:** Includes a test suite (test_ai_data_extractor.py) to verify the script's functionality.

## Prerequisites

- **Google Cloud Project:**  A Google Cloud project with Vertex AI enabled and the Gemini model available.
- **Python Environment:** Python 3.7 or higher with the following libraries installed:
    - `vertexai`
    - `python-docx`
    - `pandas`
    - `google-cloud-aiplatform`
- **API Key:**  A valid API key for the Gemini model, obtained through your Google Cloud project.

## Installation

1. **Clone the Repository:**
   ```bash
   git clone https://github.com/JoelWiebe/AI-Data-Extractor.git
   cd ai-data-extractor
   ```

2. **Install Dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

3. **Log in to Google Cloud:** 
  ```bash
  gcloud auth application-default login
  ```

4. **Set Environment Variables:**
Create a file named .env in the project directory and add the following:
```
PROJECT_ID=your-project-id
LOCATION=your-project-location
GEMINI_MODEL=gemini-1.5-flash-001 # or your preferred model
```

## Usage
1. **Prepare Input Documents:**
- Place your Word documents (.docx) in the input_docs directory.

2. **Customize (Optional):**
- Edit the TARGET_VARIABLES and CLASSIFICATION_TAGS in the script to match your research interests.

3. **Run the Script:**
   ```bash
   python ai-data-extractor.py
   ```

4. **View Results:**
- The extracted data will be saved in an Excel file (e.g., extracted_data_2024-07-08_15-32-10.xlsx) in the output_xlsx directory.

## Running Tests
To run the unit tests, use the following command:
```bash
python -m unittest test_ai_data_extractor.py
```