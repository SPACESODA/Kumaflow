#!/usr/bin/env python3
import os
import sys
from PIL import Image

def resize_icon(input_path, output_dir, sizes):
    """
    Resizes an image to multiple square sizes and saves them to the output directory.
    """
    if not os.path.exists(input_path):
        print(f"Error: Input file '{input_path}' not found.")
        sys.exit(1)

    if not os.path.exists(output_dir):
        os.makedirs(output_dir)

    try:
        with Image.open(input_path) as img:
            # Ensure image is square
            width, height = img.size
            if width != height:
                print("Warning: Input image is not square. It will be resized to square dimensions, potentially distorting it.")

            for size in sizes:
                output_filename = f"icon-{size}.png"
                output_path = os.path.join(output_dir, output_filename)
                
                # Resize using high-quality resampling
                resized_img = img.resize((size, size), Image.Resampling.LANCZOS)
                resized_img.save(output_path, "PNG")
                print(f"Generated {output_path}")

    except Exception as e:
        print(f"Error processing image: {e}")
        sys.exit(1)

if __name__ == "__main__":
    # Configuration
    INPUT_IMAGE = "assets/logo.png" # Path relative to project root
    OUTPUT_DIR = "src/images"       # Path relative to project root
    SIZES = [16, 48, 128]

    # Get absolute paths
    project_root = os.getcwd()
    input_path = os.path.join(project_root, INPUT_IMAGE)
    output_dir = os.path.join(project_root, OUTPUT_DIR)

    print(f"Input: {input_path}")
    print(f"Output Directory: {output_dir}")

    resize_icon(input_path, output_dir, SIZES)
