# utils.py
import pandas as pd

def validate_excel_spreadsheet(filepath):
  """
  Validates an Excel spreadsheet to ensure it has the required columns.

  Args:
      filepath (str): The path to the Excel spreadsheet.

  Returns:
      bool: True if the spreadsheet is valid, False otherwise.
  """

  try:
      df = pd.read_excel(filepath)

      # Define the required columns - UPDATED
      required_columns = ["Domain", "Variable", "Description", "Example", "Notes/Questions"] # CHANGED "Chain_of_Thought" to "Notes/Questions"

      # Check if all required columns are present
      if not all(col in df.columns for col in required_columns):
          missing_columns = [col for col in required_columns if col not in df.columns]
          print(f"Error: Missing columns in the spreadsheet: {missing_columns}")
          return False

      return True

  except FileNotFoundError:
      print(f"Error: File not found at {filepath}")
      return False
  except Exception as e:  # Catch any other potential errors during reading
      print(f"Error: An error occurred while reading the spreadsheet: {e}")
      return False
  

def domain_variable_mapping(filepath):
  """
  Reads an Excel spreadsheet and creates a dictionary mapping Domains to their Variables.

  Args:
      filepath (str): The path to the Excel spreadsheet.

  Returns:
      dict: A dictionary where keys are Domains and values are lists of Variables.
  """

  try:
      df = pd.read_excel(filepath)

      # Create an empty dictionary to store the mapping
      domain_variable_dict = {}

      # Iterate through each row of the DataFrame
      for _, row in df.iterrows():
          domain = row["Domain"]
          variable = row["Variable"]

          # If the domain is not already a key in the dictionary, add it
          if domain not in domain_variable_dict:
              domain_variable_dict[domain] = []

          # Append the variable to the list associated with the domain
          domain_variable_dict[domain].append(variable)

      return domain_variable_dict

  except FileNotFoundError:
      print(f"Error: File not found at {filepath}")
      return None
  except Exception as e:
      print(f"Error: An error occurred while reading the spreadsheet: {e}")
      return None
    

def create_target_variables(filepath):
  """
  Reads an Excel spreadsheet and creates a dictionary of target variables.

  Args:
      filepath (str): The path to the Excel spreadsheet.

  Returns:
      dict: A dictionary where keys are variable names and values are dictionaries 
            containing their description, examples, and notes/questions.
  """

  try:
    df = pd.read_excel(filepath)

    # Create an empty dictionary to store the target variables
    target_variables = {}

    # Iterate through each row of the DataFrame
    for index, row in df.iterrows():
      variable = row["Variable"]
      description = row["Description"]

      # Check if Variable or Description is empty, and report the row number (index + 1, as Excel rows start from 1)
      if pd.isna(variable) or pd.isna(description) or variable == "" or description == "":
        raise ValueError(f"Error: 'Variable' and 'Description' columns cannot be empty. Empty value found at row {index + 2}.") # Excel rows are 1-based, header is 1, so data starts at 2. index is 0-based.

      # Handle empty Example
      if pd.isna(row["Example"]) or row["Example"] == "":
        examples = []  # Empty list for missing examples
      elif isinstance(row["Example"], (int, float)): # Simplified check for int/float
         examples = [str(row["Example"])] # Convert numbers to string for consistency if examples are usually text
      else:
        examples = [ex.strip() for ex in str(row["Example"]).split(";") if ex.strip()]

      # Handle empty Notes/Questions - UPDATED
      if pd.isna(row["Notes/Questions"]) or row["Notes/Questions"] == "": 
        notes_questions_text = ""  # Empty string for missing notes/questions
      else:
        notes_questions_text = str(row["Notes/Questions"]) 

      # Add the variable and its details to the dictionary 
      target_variables[variable] = {
        "description": description,
        "examples": examples,
        "notes_questions": notes_questions_text 
      }

    return target_variables

  except FileNotFoundError:
    print(f"Error: File not found at {filepath}")
    return None
  except ValueError as e: # Specific error from our check
    print(e) # Print the custom error message directly
    return None
  except KeyError as e: # Handles if "Notes/Questions" or other expected columns are missing after validation (should be caught by validate_excel_spreadsheet)
    print(f"Error: Missing expected column in Excel file: {e}. Ensure your codebook.xlsx has a 'Notes/Questions' column.")
    return None
  except Exception as e:
    print(f"Error: An error occurred while reading the spreadsheet in create_target_variables: {e}")
    return None