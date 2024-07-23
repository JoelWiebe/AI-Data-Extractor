import os
from dotenv import load_dotenv

load_dotenv() # Load environment variables from .env file

# Project Configuration
PROJECT_ID = os.getenv("PROJECT_ID")
LOCATION = os.getenv("LOCATION")
GEMINI_MODEL = os.getenv("GEMINI_MODEL")

# Confidence Threshold for Tagging (0 to 1)
CONFIDENCE_THRESHOLD = 0.7  # Adjust as needed

# Directory Setup
INPUT_DIR = "input_docs"
OUTPUT_DIR = "output_xlsx"

# Data Extraction Targets
TARGET_VARIABLES = {
    "target_users": {
        "description": "The population of users who directly interact with the AI in the study.",
        "examples": ["children", "parents", "nurses", "educators", "patients", "therapists"],
        "chain_of_thought": """
            - Look for sections titled 'Participants', 'Sample', or similar.
            - Look for general terms like 'users', 'subjects', or 'individuals'.
            - Identify specific demographics like 'children', 'adults', 'patients', or specific professions.
            - Consider the context of the study to narrow down the target users.
        """
    },
    "n_participants": {
        "description": "The total number of participants included in the study (all ages).",
        "examples": ["50", "12", "N = 125"],
        "chain_of_thought": """
            - Look for the exact phrase 'number of participants' or 'sample size'.
            - Look for numbers followed by 'participants' or 'subjects'.
            - If the number is not explicitly stated, look for phrases like 'a total of', 'a sample of', or 'N ='.
            - Make sure the number refers to the total sample, not a subset.
        """
    },
    "participant_age": {
        "description": "Adult research participants' mean age and/or age range in years.",
        "examples": ["mean age = 24.5 (SD = 3.2)", "ages 18-35", "21.3 ± 4.1 years"],
        "chain_of_thought": """
            - Look for sections titled 'Participants', 'Sample', or similar.
            - Look for terms like 'mean age', 'average age', 'age range', or 'years old'.
            - If both mean and range are present, extract both.
            - If only one is present, extract that information.
            - Focus on the age of adult participants (typically 18 and older).
        """
    },
    "participant_gender": {
        "description": "Participant gender distribution by frequency or percentage.",
        "examples": ["Female (50%), Male (50%)", "Male (14), Female (12), Other (2)"],
        "chain_of_thought": """
            - Look for sections titled 'Participants', 'Sample', or similar.
            - Look for terms like 'gender', 'sex', 'male', 'female', 'non-binary', etc.
            - Extract both frequencies and percentages if available.
            - Consider other gender categories if mentioned in the study.
        """
    },
    "participant_ethnicity": {
        "description": "Participant ethnicity distribution by frequency or percentage.",
        "examples": ["Black (40%), Asian (30%), White (20%), Other (10%)", "Hispanic (25), Non-Hispanic (75)"],
        "chain_of_thought": """
            - Look for sections titled 'Participants', 'Sample', or similar.
            - Look for terms like 'ethnicity', 'race', 'ethnic group', or specific ethnicities (e.g., 'White', 'Black', 'Asian').
            - Extract both frequencies and percentages if available.
            - Consider 'Other' or 'Unknown' categories if mentioned.
        """
    },
    "setting": {
        "description": "The physical or virtual location where the study or intervention took place.",
        "examples": ["school", "hospital", "online platform", "laboratory"],
        "chain_of_thought": """
            - Look for sections titled 'Setting', 'Participants', or 'Procedure'.
            - Look for terms like 'location', 'environment', 'context', or specific places (e.g., 'school', 'clinic').
            - If multiple settings are mentioned, extract all relevant ones.
            - Differentiate between the setting of the study itself and settings mentioned in related work or background sections.
        """
    },
    "ai_hardware": {
        "description": "The specific physical device or platform used to interact with or deliver the AI.",
        "examples": ["iPad", "laptop", "smartphone", "robot", "wearable device"],
        "chain_of_thought": """
            - Look for sections titled 'Methods', 'Materials', or 'Procedure'.
            - Look for terms like 'device', 'hardware', 'platform', or specific device names.
            - If multiple devices are used, extract all relevant ones.
        """
    },
    "ai_software": {
        "description": "The type or category of software used to implement or deliver the AI.",
        "examples": ["mobile app", "web application", "chatbot", "virtual assistant"],
        "chain_of_thought": """
            - Look for sections titled 'Methods', 'Materials', or 'Procedure'.
            - Look for terms like 'software', 'application', 'program', or specific software types (e.g., 'chatbot', 'virtual reality').
        """
    },
    "ai_product": {
        "description": "The specific name or brand of the AI software or product used in the study.",
        "examples": ["ChatGPT", "IBM Watson", "Alexa", "Siri"],
        "chain_of_thought": """
            - Look for mentions of the AI product throughout the text.
            - Look for specific product names, brand names, or references to companies or organizations associated with the AI product.
            - If the product name is not explicitly mentioned, try to infer it from the context. 
        """
    },
    "ai_techniques": {
        "description": "Specific AI techniques, algorithms, or models employed by the AI product or system.",
        "examples": ["natural language processing (NLP)", "large language models (LLMs)", "neural networks", "computer vision", "reinforcement learning", "decision trees", "genetic algorithms"],
        "chain_of_thought": """
            - Look for sections titled 'Methods', 'Implementation', 'Technical Details', or 'AI System'.
            - Identify terms directly related to AI methods like 'algorithm', 'model', 'technique', or specific algorithm names (e.g., 'GPT-4', 'BERT', 'CNN').
            - Consider broader categories if specific details are lacking (e.g., 'machine learning', 'deep learning').
            - Pay attention to acronyms and abbreviations (e.g., NLP, LLM, CNN).
            - If multiple techniques are used, extract them all.
            - Differentiate between techniques used in the current study and those mentioned in related work or background sections.
        """
    },
    "ai_task": {
        "description": "The specific task(s) the AI is designed to perform or assist with.",
        "examples": ["translation", "image classification", "text generation", "question answering", "diagnosis", "recommendation", "tutoring"],
        "chain_of_thought": """
            - Look for sections titled 'Introduction', 'Purpose', 'Objectives', 'Methods', or 'Application'.
            - Identify verbs that describe actions the AI performs (e.g., 'translates', 'classifies', 'generates', 'answers', 'diagnoses', 'recommends', 'assists').
            - Look for terms like 'task', 'objective', 'goal', or 'purpose' to find explicit descriptions of what the AI does.
            - Consider the context of the research to understand the overall aim of the AI system.
            - If multiple tasks are mentioned, extract the most relevant ones.
        """
    },
    "human_ai_task": {
        "description": "The broader goal or purpose the human user aims to achieve using the AI product, encompassing the overall human-AI interaction.",
        "examples": ["learning a new language", "creating artwork", "diagnosing a medical condition", "getting customer support", "automating a workflow"],
        "chain_of_thought": """
            - Look for sections titled 'Introduction', 'Purpose', 'Objectives', or 'Applications'.
            - Identify verbs that describe high-level goals or actions (e.g., 'learn', 'create', 'diagnose', 'improve', 'automate').
            - Look for phrases indicating the user's interaction with the AI (e.g., 'using the AI to...', 'with the help of the AI', 'the AI-assisted process').
            - Consider the context of the research to infer the broader goal.
            - If multiple tasks are mentioned, prioritize those that represent the primary objective of using the AI.
        """
    },
    "research_study_classification": {
        "description": "The overall design and methodology of the research study.",
        "examples": ["randomized controlled trial (RCT)", "quasi-experimental study", "case study", "survey", "ethnography", "systematic review", "meta-analysis"],
        "chain_of_thought": """
            - Look for sections titled 'Methods', 'Design', or similar.
            - Identify key terms that describe study types (e.g., 'randomized', 'controlled', 'trial', 'observational', 'qualitative', 'quantitative').
            - Focus on the main study design, not secondary analyses or additional methods.
            - If multiple classifications are possible, choose the most accurate and comprehensive one.
        """
    },
    "children_developmental_outcomes": {
        "description": "Specific developmental outcomes measured or observed in children as a result of the AI interaction.",
        "examples": ["improved vocabulary", "increased problem-solving skills", "enhanced social interaction", "reduced anxiety"],
        "chain_of_thought": """
            - Look for sections titled 'Results', 'Discussion', or 'Conclusion'.
            - Focus on outcomes related to children's development, such as cognitive, emotional, social, or physical changes.
            - Look for terms like 'improvement', 'increase', 'decrease', 'change', or 'effect' followed by descriptions of developmental outcomes.
            - Consider both positive and negative outcomes.
            - If multiple outcomes are mentioned, prioritize those directly linked to the AI interaction.
        """
    },
    "intervention_outcomes": {
        "description": "Overall outcomes or effects of the AI intervention on the target users (both children and adults).",
        "examples": ["improved learning outcomes", "increased engagement", "reduced stress", "enhanced well-being"],
        "chain_of_thought": """
            - Look for sections titled 'Results', 'Discussion', or 'Conclusion'.
            - Identify key terms that indicate outcomes or effects (e.g., 'improved', 'increased', 'reduced', 'changed').
            - Focus on outcomes directly related to the AI intervention.
            - Consider both positive and negative outcomes, as well as any unintended consequences.
            - If multiple outcomes are reported, prioritize the most significant or relevant ones based on the study's objectives.
        """
    }
}

# List of extraction variables
TARGET_VARIABLE_NAMES = [TARGET_VARIABLES.keys()]

# Dictionary of extraction variables and descriptions
TARGET_VARIABLES_DESCRIPTIONS = {key: value["description"] for key, value in TARGET_VARIABLES.items()}

# Dictionary of extraction variable clusterings
CLUSTER_TARGET_VARIABLES = {
    "demographic_info": ["target_users", "n_participants", "participant_age", "participant_gender", "participant_ethnicity"],
    "ai_system": ["ai_hardware", "ai_software", "ai_product", "ai_techniques"],
    "tasks": ["ai_task", "human_ai_task"],
    "other": ["setting", "research_study_classification", "children_developmental_outcomes", "intervention_outcomes"],  
}

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