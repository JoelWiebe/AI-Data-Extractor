import os
from dotenv import load_dotenv
from utils import validate_excel_spreadsheet, create_target_variables, domain_variable_mapping
from vertexai.generative_models import SafetySetting

load_dotenv() # Load environment variables from .env file

# Project Configuration
PROJECT_ID = os.getenv("PROJECT_ID")
LOCATION = os.getenv("LOCATION")
GEMINI_MODEL = os.getenv("GEMINI_MODEL")

# Directory Setup
INPUT_DIR = "input_docs"
OUTPUT_DIR = "output_xlsx"

# Codebook Filepath
CODEBOOK_FILEPATH = "./codebook.xlsx"

# Model configurations
GENERATION_CONFIGURATION = {
    "max_output_tokens": 8192,
    "temperature": 0.2,
    "top_p": 0.5,
}
SAFETY_SETTINGS = [
    SafetySetting(
        category=SafetySetting.HarmCategory.HARM_CATEGORY_HATE_SPEECH,
        threshold=SafetySetting.HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE
    ),
    SafetySetting(
        category=SafetySetting.HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
        threshold=SafetySetting.HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE
    ),
    SafetySetting(
        category=SafetySetting.HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
        threshold=SafetySetting.HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE
    ),
    SafetySetting(
        category=SafetySetting.HarmCategory.HARM_CATEGORY_HARASSMENT,
        threshold=SafetySetting.HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE
    ),
]

# Validate the codebook spreadsheet
if not validate_excel_spreadsheet(CODEBOOK_FILEPATH):
    raise ValueError("Codebook spreadsheet is invalid. Please check the errors.")

# Data Extraction Targets (using your function)
TARGET_VARIABLES = create_target_variables(CODEBOOK_FILEPATH)

# Confidence Threshold for Tagging (0 to 1)
CONFIDENCE_THRESHOLD = 0.7  # Adjust as needed

# List of extraction variables
TARGET_VARIABLE_NAMES = [TARGET_VARIABLES.keys()]

# Dictionary of extraction variables and descriptions
TARGET_VARIABLES_DESCRIPTIONS = {key: value["description"] for key, value in TARGET_VARIABLES.items()}

# Cluster Target Variables (using your function)
CLUSTER_TARGET_VARIABLES = domain_variable_mapping(CODEBOOK_FILEPATH)

# Build NESTED_TARGET_VARIABLES (keys are cluster names; values are the full target variable dictionaries)
NESTED_TARGET_VARIABLES = {}
for cluster_name, var_names in CLUSTER_TARGET_VARIABLES.items():
    NESTED_TARGET_VARIABLES[cluster_name] = {
        var_name: TARGET_VARIABLES[var_name] for var_name in var_names
    }

# Build PARAGRAPH_TAG_DESCRIPTIONS (key are cluster names [if not "other"] or target variable name [if "other"]; values are lists of target variable descriptions)
PARAGRAPH_TAG_DESCRIPTIONS = {}
for cluster_name, var_names in CLUSTER_TARGET_VARIABLES.items():
    # For clustered target variables, add a list of their descriptions under their cluster name to PARAGRAPH_TAG_DESCRIPTIONS
    if cluster_name != "other":  # Exclude the "other" cluster
        descriptions = [TARGET_VARIABLES[var_name]["description"] for var_name in var_names]
        PARAGRAPH_TAG_DESCRIPTIONS[cluster_name] = descriptions

for var_name in CLUSTER_TARGET_VARIABLES.get("other", []):
    # For "other" target variables, add their descriptions to PARAGRAPH_TAG_DESCRIPTIONS
    PARAGRAPH_TAG_DESCRIPTIONS[var_name] = [TARGET_VARIABLES[var_name]["description"]]

# Example computed value of PARAGRAPH_TAG_DESCRIPTIONS
# {
#     'demographic_info': ['The population of users who directly interact with the AI in the study.',
#                         'The total number of participants included in the study (all ages).',
#                         "Adult research participants' mean age and/or age range in years.",
#                         'Participant gender distribution by frequency or percentage.',
#                         'Participant ethnicity distribution by frequency or percentage.'],
#     'ai_system': ['The specific physical device or platform used to interact with or deliver the AI.',
#                   'The type or category of software used to implement or deliver the AI.',
#                   'The specific name or brand of the AI software or product used in the study.',
#                   'Specific AI techniques, algorithms, or models employed by the AI product or system.'],
#     'tasks': ['The specific, technical task(s) the AI system is programmed to execute or assist with.',
#               'The broader goal or purpose the human user aims to achieve using the AI product, encompassing the overall human-AI interaction.'],
#     'research_study_classification': ['The overall design and methodology of the research study.'],
#     'children_developmental_outcomes': ['Specific developmental outcomes measured or observed in children as a result of the AI interaction.'],
#     'intervention_outcomes': ['Overall outcomes or effects of the AI intervention on the target users (both children and adults).']
# }