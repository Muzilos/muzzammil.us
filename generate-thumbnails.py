import os
from PIL import Image

def create_thumbnail(input_path, output_path, max_size):
    with Image.open(input_path) as img:
        # Calculate the aspect ratio
        aspect_ratio = img.width / img.height
        
        if img.width > img.height:
            new_width = max_size
            new_height = int(max_size / aspect_ratio)
        else:
            new_height = max_size
            new_width = int(max_size * aspect_ratio)
        
        # Resize the image
        img.thumbnail((new_width, new_height))
        
        # Save the thumbnail
        img.save(output_path, optimize=True, quality=85)

def process_directory(input_dir, output_dir, max_size):
    if not os.path.exists(output_dir):
        os.makedirs(output_dir)
    
    for filename in os.listdir(input_dir):
        if filename.lower().endswith(('.png', '.jpg', '.jpeg')):
            input_path = os.path.join(input_dir, filename)
            output_path = os.path.join(output_dir, f"thumb_{filename}")
            create_thumbnail(input_path, output_path, max_size)
            print(f"Created thumbnail for {filename}")

# Example usage
input_directory = "paintings/-"
output_directory = "paintings/-compressed"
max_thumbnail_size = 800  # pixels

process_directory(input_directory, output_directory, max_thumbnail_size)