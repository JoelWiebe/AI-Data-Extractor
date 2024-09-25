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

      # Define the required columns
      required_columns = ["Domain", "Variable", "Description", "Example", "Chain_of_Thought"]

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
            containing their description, examples, and chain of thought.
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
        raise ValueError(f"Error: 'Variable' and 'Description' columns cannot be empty. Empty value found at row {index + 1}.")

      # Handle empty Example and Chain_of_Thought
      if pd.isna(row["Example"]) or row["Example"] == "":
        examples = []  # Empty list for missing examples
      elif isinstance(row["Example"], int) or isinstance(row["Example"], float):
         examples = [row["Example"]]
      else:
        examples = [ex.strip() for ex in row["Example"].split(";") if ex.strip()]

      if pd.isna(row["Chain_of_Thought"]) or row["Chain_of_Thought"] == "":
        chain_of_thought = ""  # Empty string for missing chain of thought
      else:
        chain_of_thought = row["Chain_of_Thought"]

      # Add the variable and its details to the dictionary
      target_variables[variable] = {
        "description": description,
        "examples": examples,
        "chain_of_thought": chain_of_thought
      }

    return target_variables

  except FileNotFoundError:
    print(f"Error: File not found at {filepath}")
    return None
  except ValueError as e:
    print(f"Error: {e}")
    return None
  except Exception as e:
    print(f"Error: An error occurred while reading the spreadsheet: {e}")
    return None