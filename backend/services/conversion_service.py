import os
import subprocess
import tempfile
import uuid

def convert_to_pdf(file_bytes: bytes, file_extension: str) -> bytes:
    """Convert an office document to PDF using LibreOffice headless."""
    # Ensure libreoffice is available
    
    with tempfile.TemporaryDirectory() as temp_dir:
        input_file = os.path.join(temp_dir, f"input.{file_extension}")
        with open(input_file, "wb") as f:
            f.write(file_bytes)
            
        try:
            # Run libreoffice conversion
            process = subprocess.run(
                [
                    "libreoffice",
                    "--headless",
                    "--convert-to",
                    "pdf",
                    input_file,
                    "--outdir",
                    temp_dir,
                ],
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                timeout=60,
                check=True
            )
            
            output_file = os.path.join(temp_dir, "input.pdf")
            if not os.path.exists(output_file):
                raise Exception(f"Conversion failed, output file not generated. Stderr: {process.stderr.decode()}")
                
            with open(output_file, "rb") as f:
                pdf_bytes = f.read()
                
            return pdf_bytes
            
        except subprocess.TimeoutExpired:
            raise Exception("Document conversion timed out")
        except subprocess.CalledProcessError as e:
            raise Exception(f"Document conversion failed: {e.stderr.decode()}")
