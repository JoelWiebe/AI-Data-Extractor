import os
import json
import pandas as pd
import vertexai
from vertexai.generative_models import GenerativeModel
import docx
from google.cloud import aiplatform
import datetime
from config import *
import re
import vertexai
from vertexai.generative_models import GenerativeModel, Part, FinishReason
import vertexai.preview.generative_models as generative_models

class TagClassifierClient:
    def __init__(self):
        vertexai.init(project=PROJECT_ID, location=LOCATION)
        self.model = GenerativeModel(GEMINI_MODEL,
            system_instruction="You are a research assistant tasked with identifying paragraphs of a research paper that contain data relevant to given variables.")

    def classify_section(self, heading, paragraphs, start_idx):
        # Create JSON payload for Gemini with absolute paragraph indices
        payload = {
            "heading": heading,
            "paragraphs": {str(i + start_idx): p for i, p in enumerate(paragraphs)}
        }

        json_payload = json.dumps(payload, indent=2)

        # Prompt template with instructions and expected response format (including confidence)
        prompt = (
            "Below is a JSON object containing a heading name from a research paper followed by its paragraphs, where the key is the paragraph index and the value is the paragraph text.\n\n"
            f"{json_payload}\n\n"
            f"Here is a JSON object of classification labels for variables that will be extracted from the paper:\n\n"
            f"{TARGET_VARIABLES}\n\n"
            "Your task is to label the paragraphs that contain data relevant to the provided extraction variables, along with your confidence (0 to 1) in each label. Provide your response in a JSON object that should adhere EXACTLY to the following format using the paragraph index as the key and a list of classification tags with confidence scores as the value, with no additional text:\n\n"
            "{\n  \"classifications\": {\n    \"0\": [[\"ai_types\", 0.95], [\"participant_ages\", 0.82]],\n    \"1\": [[\"participant_ages\", 0.98]],\n    \"2\": []\n  }\n}\n"
        )

        # Generate classifications 
        generation_config = {
            "max_output_tokens": 8192,
            "temperature": 0.2,
            "top_p": 0.95,
            "top_k": 40
        }

        safety_settings = {
            generative_models.HarmCategory.HARM_CATEGORY_HATE_SPEECH: generative_models.HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
            generative_models.HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT: generative_models.HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
            generative_models.HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT: generative_models.HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
            generative_models.HarmCategory.HARM_CATEGORY_HARASSMENT: generative_models.HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
        }
        
        print(f"Prompt: {prompt}")

        # Call the model to predict and get results in string format
        response = self.model.generate_content(prompt, generation_config=generation_config, safety_settings=safety_settings).text
        print(f"Response: {response}")

        clean_response = remove_json_markdown(response)
        print(f"Clean response: {clean_response}")

        # convert the results to a python dictionary
        response_dict = json.loads(clean_response)

        # updated parsing with confidence scores
        return response_dict["classifications"] # Return the dictionary
    

def remove_json_markdown(text):
    pattern = re.compile(r'```json\s*(.*?)\s*```', re.DOTALL)
    return pattern.sub(r'\1', text)

    
def process_document(file_path, tag_classifier_client):
    """
    Reads a Word document, classifies paragraphs into sections based on headings,
    and aggregates relevant paragraphs with their confidence scores for each target variable.

    Args:
        file_path (str): The path to the Word document.
        tag_classifier_client (TagClassifierClient): The client for classifying paragraphs.

    Returns:
        dict: A dictionary where keys are target variable names and values are lists of tuples 
              containing paragraph indices and their corresponding confidence scores.
    """
    
    doc = docx.Document(file_path)

    # Initialize variables to track the current section and paragraph index
    current_heading = None  
    current_paragraphs = []
    paragraph_idx = 0

    # Initialize a dictionary to store aggregated results for each target variable
    aggregated_data = {var_name: [] for var_name in TARGET_VARIABLES} 

    for para in doc.paragraphs:
        # Check if the current paragraph is a heading
        if para.style.name.startswith('Heading'):
            # If we have a previous section (heading and paragraphs), process it
            if current_heading and current_paragraphs:
                # Classify the paragraphs in the current section using the Gemini model
                classifications = tag_classifier_client.classify_section(current_heading, current_paragraphs, paragraph_idx - len(current_paragraphs))  
                
                # Iterate through the classified paragraphs
                for idx, tags_with_confidences in classifications.items():
                    # For each tag and its confidence, check if it's a target variable
                    for tag, confidence in tags_with_confidences:
                        if tag in TARGET_VARIABLES:
                            # If it's a target variable, add the paragraph index and confidence to the aggregated data
                            aggregated_data[tag].append((int(idx), confidence))
                # Clear the current_paragraphs list for the next section
                current_paragraphs = []

            # Update the current heading to the new heading
            current_heading = para.text
        else:
            # If the current paragraph is not a heading, add it to the current_paragraphs list
            current_paragraphs.append(para.text)
        # Increment the paragraph index for the next paragraph
        paragraph_idx += 1

    # Process the last section of the document (if any)
    if current_heading and current_paragraphs:
        classifications = tag_classifier_client.classify_section(current_heading, current_paragraphs, paragraph_idx - len(current_paragraphs))
        for idx, tags_with_confidences in classifications.items():
            for tag, confidence in tags_with_confidences:
                if tag in TARGET_VARIABLES:
                    aggregated_data[tag].append((int(idx), confidence)) 

    # Return the dictionary containing aggregated data for all target variables
    return aggregated_data


def main():
    os.makedirs(OUTPUT_DIR, exist_ok=True)  # Create output directory if not exists
    tag_classifier_client = TagClassifierClient()

    all_results = []  # List to store results from all documents

    for filename in os.listdir(INPUT_DIR):
        file_path = os.path.join(INPUT_DIR, filename)
        if os.path.isfile(file_path) and file_path.endswith(".docx"):
            try:
                aggregated_data = process_document(file_path, tag_classifier_client)  # Get aggregated data directly
                
                # Convert aggregated_data into a list of dictionaries for the dataframe
                all_results.extend(
                    {
                        "filename": filename,
                        "variable": var_name,
                        "paragraph_index": idx, 
                        "confidence": confidence
                    }
                    for var_name, paragraphs in aggregated_data.items()
                    for idx, confidence in paragraphs
                )

            except Exception as e:
                print(f"Error processing {filename}: {e}")

    # Create DataFrame and save to Excel with timestamp
    df = pd.DataFrame(all_results)

    now = datetime.datetime.now()
    timestamp = now.strftime("%Y-%m-%d_%H-%M-%S")

    output_file = os.path.join(OUTPUT_DIR, f"extracted_data_{timestamp}.xlsx")
    df.to_excel(output_file, index=False)
    print(f"Results saved to: {output_file}")


if __name__ == "__main__":
    main()
