# File: ai-pdf2docx.py
import argparse
import os
import sys

# Assuming phase1_pdf_to_json.py and phase2_json_to_docx.py are in the same directory
# or accessible via PYTHONPATH
try:
    from phase1_pdf_to_json import run_pdf_to_json_conversion
    from phase2_json_to_docx import run_json_to_docx_conversion
except ImportError as e:
    print(f"Error importing phase modules: {e}")
    print("Ensure 'phase1_pdf_to_json.py' and 'phase2_json_to_docx.py' are in the same directory or PYTHONPATH.")
    sys.exit(1)

def main():
    parser = argparse.ArgumentParser(description="AI PDF to DOCX Conversion Tool")
    subparsers = parser.add_subparsers(dest="command", help="Available commands", required=True)

    # --- pdf2json Subcommand ---
    parser_pdf2json = subparsers.add_parser("pdf2json", help="Phase 1: Convert PDFs to structured JSON.")
    parser_pdf2json.add_argument("input_pdf_directory", help="Path to the directory containing PDF files.")
    parser_pdf2json.add_argument("output_json_directory", help="Path to the directory where JSON files will be saved.")
    parser_pdf2json.add_argument("--project_id", required=True, help="Google Cloud Project ID.")
    parser_pdf2json.add_argument("--location", default="us-central1", help="Google Cloud location (default: us-central1).")
    parser_pdf2json.add_argument("--model", default="gemini-1.5-pro-001", help="Name of the Gemini model (default: gemini-1.5-pro-001).")
    parser_pdf2json.add_argument("--delay", type=int, default=0, help="Delay in seconds between API calls (default: 0).")
    parser_pdf2json.add_argument("--overwrite", action="store_true", help="Overwrite existing JSON files.")
    parser_pdf2json.set_defaults(func=run_pdf_to_json_conversion)

    # --- json2docx Subcommand ---
    parser_json2docx = subparsers.add_parser("json2docx", help="Phase 2: Convert structured JSON to DOCX.")
    parser_json2docx.add_argument("input_json_directory", help="Path to the directory containing JSON files.")
    parser_json2docx.add_argument("output_docx_directory", help="Path to the directory where DOCX files will be saved.")
    parser_json2docx.add_argument("--overwrite", action="store_true", help="Overwrite existing DOCX files.")
    parser_json2docx.set_defaults(func=run_json_to_docx_conversion)

    args = parser.parse_args()
    
    # Ensure output directories exist or create them if they are specific to a run
    if args.command == "pdf2json":
        if not os.path.exists(args.output_json_directory):
            os.makedirs(args.output_json_directory, exist_ok=True)
            print(f"Created output JSON directory: {args.output_json_directory}")
    elif args.command == "json2docx":
        if not os.path.exists(args.output_docx_directory):
            os.makedirs(args.output_docx_directory, exist_ok=True)
            print(f"Created output DOCX directory: {args.output_docx_directory}")

    args.func(args) # Call the appropriate function based on the subcommand

if __name__ == "__main__":
    main()