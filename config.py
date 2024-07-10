import os
from dotenv import load_dotenv

load_dotenv() # Load environment variables from .env file

# Project Configuration
PROJECT_ID = os.getenv("PROJECT_ID")
LOCATION = os.getenv("LOCATION")
GEMINI_MODEL = os.getenv("GEMINI_MODEL")

# Data Extraction Targets
TARGET_VARIABLES = {
    "participant_ages": "Extract participant ages from the given text.",
    "ai_types": "Identify the types of AI mentioned in the text.",
    "intervention_outcomes": "Summarize the outcomes of the intervention described in the text.",
}

# Paragraph Classification Tags
CLASSIFICATION_TAGS = [TARGET_VARIABLES.keys()]

# Confidence Threshold for Tagging (0 to 1)
CONFIDENCE_THRESHOLD = 0.7  # Adjust as needed

# Directory Setup
INPUT_DIR = "input_docs"
OUTPUT_DIR = "output_xlsx"
