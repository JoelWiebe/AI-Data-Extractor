import unittest
import docx
from ai_data_extractor import TagClassifierClient
from config import *

class TestClassifySection(unittest.TestCase):
    @classmethod  
    def setUpClass(cls):  
        cls.test_doc_path = os.path.join(INPUT_DIR, "test_paper.docx") 

    def setUp(self):
        print("Starting setup...")
        self.tag_classifier_client = TagClassifierClient()

    def test_classify_section(self):
        print("Starting test...")
        with open(self.test_doc_path, "rb") as docx_file:
            doc = docx.Document(docx_file)
        # Assuming the first paragraph is the heading and the second is the content
        self.assertIsNotNone(doc)
        self.assertIsNotNone(doc.paragraphs)

        heading = None
        paragraphs = None
        
        for par in doc.paragraphs:
            # Get the first heading and first paragraph under that heading
            if heading:
                paragraphs = [par.text]
                break
            if par.style.name.startswith('Heading'):
                heading = par.text
        
        # Classify the section
        classifications = self.tag_classifier_client.classify_section(heading, paragraphs, 1)  # Start index is 1
        print(f"Response: {classifications}")
        
        # Assertions
        self.assertIsNotNone(classifications)  # Response should not be None

        paragraph_index = "1"  # Since we're passing the second paragraph (index 1)
        self.assertIn(paragraph_index, classifications)  # Paragraph index should be in the response

        tags_with_confidences = classifications[paragraph_index]
        self.assertGreater(len(tags_with_confidences), 0)  # Should have at least one tag
        for tag, confidence in tags_with_confidences:
            self.assertTrue(0 <= confidence <= 1)  # Confidence should be between 0 and 1

