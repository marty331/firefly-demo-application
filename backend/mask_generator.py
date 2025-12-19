from PIL import Image
import io
import os
from datetime import datetime

def create_simple_mask(width: int = 2048, height: int = 2048, save_local: bool = True) -> bytes:
    """
    Creates a simple white rectangle mask (no black borders)
    White = where the object will be placed
    
    Args:
        width: Width of the mask image
        height: Height of the mask image
        save_local: If True, saves the mask to current directory
    
    Returns:
        bytes: PNG image data
    """
    # Create a white image
    mask = Image.new('L', (width, height), 255)  # 'L' mode = grayscale, 255 = white
    
    # Save locally if requested
    if save_local:
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"mask_simple_{timestamp}.png"
        mask.save(filename)
        print(f"Mask saved to: {os.path.abspath(filename)}")
    
    # Save to bytes for return
    img_byte_arr = io.BytesIO()
    mask.save(img_byte_arr, format='PNG')
    img_byte_arr.seek(0)
    
    return img_byte_arr.getvalue()


def create_centered_mask(width: int = 2048, height: int = 2048, 
                        object_width_percent: float = 0.6,
                        object_height_percent: float = 0.6,
                        save_local: bool = True) -> bytes:
    """
    Creates a centered white rectangle on black background
    Useful if you want the object to occupy a specific portion of the scene
    
    Args:
        width: Width of the mask image
        height: Height of the mask image
        object_width_percent: Percentage of width for the white rectangle (0.0-1.0)
        object_height_percent: Percentage of height for the white rectangle (0.0-1.0)
        save_local: If True, saves the mask to current directory
    
    Returns:
        bytes: PNG image data
    """
    from PIL import ImageDraw
    
    mask = Image.new('L', (width, height), 0)  # Start with black
    
    # Calculate white rectangle dimensions (centered)
    obj_width = int(width * object_width_percent)
    obj_height = int(height * object_height_percent)
    
    left = (width - obj_width) // 2
    top = (height - obj_height) // 2
    right = left + obj_width
    bottom = top + obj_height
    
    # Draw white rectangle
    draw = ImageDraw.Draw(mask)
    draw.rectangle([left, top, right, bottom], fill=255)
    
    # Save locally if requested
    if save_local:
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"mask_centered_{int(object_width_percent*100)}x{int(object_height_percent*100)}_{timestamp}.png"
        mask.save(filename)
        print(f"Mask saved to: {os.path.abspath(filename)}")
    
    # Save to bytes for return
    img_byte_arr = io.BytesIO()
    mask.save(img_byte_arr, format='PNG')
    img_byte_arr.seek(0)
    
    return img_byte_arr.getvalue()
