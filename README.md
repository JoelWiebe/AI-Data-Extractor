# AI Data Extractor for Academic Papers

This Python project leverages Google's Vertex AI Gemini models to analyze academic research papers (in .docx format), classify their content, and extract specific, predefined data points into a structured Excel workbook. It's designed to assist in systematic reviews by automating parts of the full-text screening and data extraction process.

The tool employs a two-pass AI methodology:
1.  **Content Classification:** Identifies relevant sections and content pieces (paragraphs and tables) based on a custom codebook.
2.  **Targeted Data Extraction:** Extracts specific variables from the classified content, again guided by the codebook, and includes justifications and confidence scores from the AI.

## Key Features

* **DOCX Processing:** Efficiently parses Microsoft Word documents (.docx).
* **Table Handling:** Converts tables within DOCX files into GitHub Flavored Markdown for consistent processing by the LLM, treating them as distinct content pieces.
* **Two-Pass AI Analysis (Gemini on Vertex AI):**
    * **Pass 1 (Classification):** Classifies content pieces within document sections (demarcated by "Heading 1" or "Heading 2" styles) against tags derived from your codebook.
    * **Pass 2 (Extraction):** Uses the classified content to perform targeted extraction of variables defined in detail in your codebook (including descriptions, examples, and "Notes/Questions").
* **Intelligent Data Scoping:** Prompts are designed to instruct the LLM to extract data *only* from the primary research study being reported, ignoring cited works.
* **Efficient Processing:** Skips document sections from "REFERENCES" (or similar "Heading 2") onwards to focus on relevant content.
* **Robust API Interaction:** Implements retry mechanisms with exponential backoff for API calls to handle transient issues.
* **Graceful Interruption:** Allows users to stop processing (e.g., via Control+C) and attempts to save any progress made.
* **Structured Output:** Generates an Excel (.xlsx) file containing the extracted data, relevant source content snippets, AI-generated justifications, and confidence scores.
* **Configuration Driven:** Utilizes a `config.py` for project settings (GCP Project ID, model names, directories) and a `codebook.xlsx` for defining data extraction targets.

## Prerequisites

* Python 3.8 or higher.
* A Google Cloud Platform (GCP) project with:
    * Vertex AI API enabled.
    * Billing enabled for your project.
* Google Cloud SDK (`gcloud` CLI) installed and authenticated locally with Application Default Credentials:
    ```bash
    gcloud auth application-default login
    ```
* Input DOCX files of academic papers.
* A `codebook.xlsx` file structured with columns like "Domain", "Variable", "Description", "Example", "Notes/Questions".

## Setup & Installation (Local Environment)

1.  **Clone the Repository:**
    ```bash
    git clone [https://github.com/JoelWiebe/ai-data-extractor.git](https://github.com/JoelWiebe/ai-data-extractor.git) # Or your repository URL
    cd ai-data-extractor
    ```

2.  **Create and Activate a Virtual Environment (Recommended):**
    ```bash
    python3 -m venv venv
    source venv/bin/activate  # On Windows: venv\Scripts\activate
    ```

3.  **Install Dependencies:**
    Create a `requirements.txt` file with the following content:
    ```txt
    python-docx
    pandas
    openpyxl # For Excel writing with pandas
    google-cloud-aiplatform[generative_ai]
    python-dotenv
    ```
    Then run:
    ```bash
    pip install -r requirements.txt
    ```

4.  **Configuration:**
    * Place your `codebook.xlsx` in the root directory of the project (or update `CODEBOOK_FILEPATH` in `config.py`). Ensure the column previously named "Chain_of_Thought" is now "Notes/Questions".
    * Create a `.env` file in the project root (this file should be in your `.gitignore`) or directly edit `config.py`:
        ```env
        # Example .env file content
        PROJECT_ID="your-gcp-project-id"
        LOCATION="your-gcp-location" # e.g., us-central1
        GEMINI_MODEL="gemini-1.5-flash-001" # or your preferred model like gemini-1.5-pro-latest
        ```
    * Alternatively, if `config.py` is modified to not use `.env`, ensure `PROJECT_ID`, `LOCATION`, and `GEMINI_MODEL` are set correctly there.
    * Place your input DOCX files into the directory specified by `INPUT_DIR` in `config.py` (default is `input_docs/`).
    * The output directory (`OUTPUT_DIR`, default `output_xlsx/`) will be created if it doesn't exist.

## Usage (Local Command-Line)

Once setup and configured:
```bash
python3 ai_data_extractor.py
```
The script will process each `.docx` file in the input directory. Output Excel files (timestamped, with status suffix if interrupted or errored) will be saved in the output directory.

## VS Code Debugging (Local)

This workspace may include a `.vscode/launch.json` file with pre-configured launch profiles for debugging.
1.  Open the project folder in VS Code.
2.  Go to the "Run and Debug" view (Ctrl+Shift+D or Cmd+Shift+D).
3.  Ensure your `config.py` is set up correctly for local runs, or modify `launch.json` to pass necessary environment variables if `config.py` uses them (especially `PROJECT_ID`, `LOCATION`, `GEMINI_MODEL`).
4.  Select or create a launch configuration for `ai_data_extractor.py`.
5.  Set breakpoints and start debugging (F5).

## Running on Google Colab (Alternative for Long Processes)

Google Colab provides a free, cloud-based environment that can be suitable for running longer processes like `ai_data_extractor.py`, mitigating issues with local internet stability or your computer going to sleep.

**Prerequisites for Colab:**
* A Google Account.
* Your DOCX files prepared and accessible (e.g., uploaded to Google Drive).
* Your `codebook.xlsx` file ready (e.g., in Google Drive or uploaded with the project).
* Your project scripts (`ai_data_extractor.py`, `config.py`, `utils.py`).

**Steps to Run on Colab:**

1.  **Open Google Colab:** Go to [colab.research.google.com](https://colab.research.google.com) and create a "New notebook".

2.  **Mount Google Drive:** This allows Colab to access files you store in your Drive. Run this code cell:
    ```python
    from google.colab import auth
    auth.authenticate_user()
    from google.colab import drive
    drive.mount('/content/drive')
    ```
    Authorize access when prompted. Your Google Drive will be available at `/content/drive/MyDrive/`. It's recommended to create a project folder in your Drive (e.g., `MyDrive/ai_data_project/`).

3.  **Set up Project Files:**
    * **Step 1: Clone your GitHub Repository (Recommended):**
        ```python
        import os
        project_path = '/content/drive/My Drive/ai_data_projects/'
        os.makedirs(project_path, exist_ok=True)
        print(f"Project folder created at: {project_path}")
        %cd '/content/drive/My Drive/ai_data_projects/'
        !git clone https://github.com/JoelWiebe/ai-data-extractor.git
        %cd ai-data-extractor
        ```
        This brings all your scripts but not the `codebook.xlsx` or docx files.
    * **Step 2: Upload Files Manually:**
        * Use the Colab file browser (folder icon on the left sidebar) to upload `codebook.xlsx`.
        * Create an `input_docs` directory in Colab (e.g., `/content/drive/MyDrive/my_ai_project/input_docs`) and upload your DOCX files there.
        * Create an `output_xlsx` directory.

4.  **Install Dependencies:** Run this cell to install necessary packages (assuming you have `requirements.txt` in your cloned repo).
    ```python
    !pip install -r requirements.txt
    ```

5.  **Authenticate to Google Cloud:** Run this cell to authenticate your Colab session.
    ```python
    from google.colab import auth
    import os

    auth.authenticate_user()
    print('Colab Authenticated with GCP.')

    # Enable: "See, edit, create and delete all of your Google Drive files" and
    # Enable: "See, edit, configure and delete your Google Cloud data and see the email address for your Google Account..."

    os.environ['PROJECT_ID'] = 'your-gcp-project-id' # replace with your Vertex AI project ID
    os.environ['LOCATION'] = 'global' # or your preferred location
    os.environ['GEMINI_MODEL'] = 'gemini-2.5-flash-preview-05-20' # or your preferred model

6.  **Run the Data Extraction Script:**
    Make sure you are in the correct directory where `ai_data_extractor.py` is located (e.g., `/content/My Dirve/ai-data-projects/ai-data-extractor/` if cloned).
    ```python
    !python3 ai-data-extractor.py
    ```

7.  **Access Output:** The generated Excel file will be saved to the `OUTPUT_DIR` you configured. If this is on Google Drive, you'll find it there. If it's in Colab's temporary session storage, you'll need to download it from the Colab file browser before the session ends.

**Colab Specific Considerations:**
* **Runtime Limits (Free Tier):** Free Colab runtimes are not guaranteed for indefinite periods (typically up to 12 hours, variable) and may disconnect due to prolonged inactivity with the browser tab. For very long, multi-hour, *unattended* runs, this can be a risk.
* **Saving Outputs to Drive:** It's highly recommended to configure your `OUTPUT_DIR` to be on your mounted Google Drive to ensure outputs are not lost if the Colab runtime disconnects or is recycled.
* **Colab Pro/Pro+:** For more stability, longer runtimes, and background execution capabilities, consider Google Colab's paid tiers.

## Important Considerations & Warnings (General)

### Vertex AI Costs
* **Using the Vertex AI Gemini models will incur costs on your Google Cloud Platform account.** Costs are typically based on the amount of data processed (input and output tokens) and the specific model used.
* Please review the official [Vertex AI Pricing page](https://cloud.google.com/vertex-ai/pricing) before processing a large number of documents.
* Monitor your GCP billing dashboard regularly.

### Computation Time
* AI processing, especially for multiple documents and multiple LLM calls per document (classification + extraction passes), can be time-consuming.
* Plan for runs potentially taking several hours for a large corpus, depending on document complexity, number of content pieces, and number of variables. The `max_output_tokens` setting (e.g., 32768 as discussed) allows for comprehensive outputs but factor this into time and cost.

### API Rate Limits & Errors
* Google Cloud enforces API rate limits. The script includes retry mechanisms with exponential backoff for API calls, which should handle most transient issues.
* If persistent `MAX_TOKENS` errors occur for the classification or extraction output, you may need to adjust `max_output_tokens` in `config.py` or consider strategies for breaking down extremely large sections/extraction tasks further.

### Accuracy & Output Quality
* AI-based document understanding is powerful but not infallible. The accuracy of classifications and extractions may vary.
* **Always review the generated Excel outputs,** paying attention to the extracted values, AI-generated confidence scores, and justifications.
* The quality of the input DOCX and the clarity of your `codebook.xlsx` (especially descriptions and "Notes/Questions") significantly impact results.
* Unexpected model outputs (e.g., incorrect JSON formatting, unexpected labels) are handled with warnings and retries, but output still requires human validation. The script attempts to gracefully handle malformed JSON from the model or unexpected labels by warning and skipping, or stopping if errors persist after retries or if too many semantic warnings occur for a document (if `MAX_INVALID_LABEL_WARNINGS_PER_DOC` is set accordingly).

## Error Handling and Resuming Processing

The script is designed to save any successfully processed data before exiting due to an unrecoverable error (like repeated API failures or critical issues with a specific document). The output Excel file will be named with a suffix like `_ERROR_INCOMPLETE` or `_USER_INTERRUPTED_PARTIAL` in such cases.

If an error occurs and the script halts:

1.  **Identify Processed Files:**
    * Open the partially saved Excel workbook (e.g., `extracted_data_..._ERROR_INCOMPLETE.xlsx`).
    * Note the unique filenames listed in the "filename" column. These documents were successfully processed (at least up to the point of extraction for the variables listed).
    * Move these corresponding `.docx` files from your `input_docs` directory to a new, separate subfolder (e.g., `input_docs/Completed/`).

2.  **Identify the Problematic File:**
    * The console output when the script halted will typically indicate the last file it was attempting to process when the error occurred (e.g., `Processing was halted due to an error: File: problematic_document.docx, Critical Error: ...`).
    * Move this specific problematic `.docx` file from `input_docs` to a different new subfolder (e.g., `input_docs/Pending_Review/`).

3.  **Resume Processing Remaining Files:**
    * Run the `ai_data_extractor.py` script again. Since the successfully processed files and the identified problematic file have been moved out of the `input_docs` directory, the script will continue with the remaining unprocessed DOCX files.

4.  **Address Problematic Files:**
    * Once all other files are successfully processed (and their DOCX files also moved to your `input_docs/Completed/` folder), you can focus on the file(s) in `input_docs/Pending_Review/`.
    * Move one problematic file at a time back into the main `input_docs` directory.
    * Try running the script again, focusing on this single file.
    * **Troubleshooting:**
        * Check the console output for specific error messages related to this file.
        * Consider if the `MAX_TOKENS` limit was hit (see "API Rate Limits & Errors" section above). You might need to adjust `max_output_tokens` in `config.py` temporarily or consider if the document section is exceptionally large for the classification/extraction task.
        * Examine the DOCX file itself for any unusual formatting or potential corruption.
        * If the issue seems to be with how the LLM is responding (e.g., consistently malformed JSON, incorrect labels despite clear prompts), you might need to debug the prompt engineering for that specific type of content or report the issue if it seems like a bug in the script's logic.
        * You can also reduce `MAX_INVALID_LABEL_WARNINGS_PER_DOC` in `config.py` to a low number (like 0 or 1) to make the script stop more quickly if the issue is related to the "Classified label '...' is not a predefined paragraph tag" warnings, helping you pinpoint which section is causing the model to respond unexpectedly.

By following these steps, you can manage errors, ensure already processed data is saved, and systematically work through a large batch of documents.

### File Structure (Illustrative)

* `ai_data_extractor.py`: Main script for classification and extraction from DOCX.
* `utils.py`: Utility functions (e.g., codebook validation, processing).
* `config.py`: Project configurations (GCP settings, model names, directories, API parameters, retry settings, warning thresholds).
* `test_ai_data_extractor.py`: Unit tests.
* `codebook.xlsx`: Defines domains, variables, descriptions, examples, and "Notes/Questions".
* `input_docs/`: Default directory for input DOCX files.
* `output_xlsx/`: Default directory for output Excel workbooks.
* `.env` (optional, if used by `config.py`): For storing environment variables like `PROJECT_ID`. (Add to `.gitignore`)
* `requirements.txt`: Python dependencies.
* `README.md`: This file.

## Contributing

Contributions are welcome! Please fork the repository, make your changes, and submit a pull request. For major changes, please open an issue first to discuss your ideas.

## License

This project is licensed under the [MIT License](LICENSE.txt). *(Ensure you have a `LICENSE.txt` file in your repository with the MIT License text if you choose this license).*
