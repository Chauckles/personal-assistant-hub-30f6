#!/usr/bin/env python3
"""Generate extension icons programmatically."""

from PIL import Image, ImageDraw, ImageFont
import os

# Icon sizes
SIZES = [16, 48, 128]

# Colors (matching the HTML generator)
GRADIENT_START = (79, 70, 229)  # #4F46E5
GRADIENT_END = (124, 58, 237)   # #7C3AED
TEXT_COLOR = (255, 255, 255)    # white

def create_gradient_circle(size):
    """Create a circular gradient background."""
    image = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)

    # Create gradient by drawing multiple circles with interpolated colors
    center = size // 2
    radius = size // 2

    for i in range(radius):
        # Interpolate color
        ratio = i / radius
        r = int(GRADIENT_START[0] + (GRADIENT_END[0] - GRADIENT_START[0]) * ratio)
        g = int(GRADIENT_START[1] + (GRADIENT_END[1] - GRADIENT_START[1]) * ratio)
        b = int(GRADIENT_START[2] + (GRADIENT_END[2] - GRADIENT_START[2]) * ratio)
        color = (r, g, b, 255)

        # Draw circle
        current_radius = radius - i
        draw.ellipse(
            [center - current_radius, center - current_radius,
             center + current_radius, center + current_radius],
            fill=color
        )

    return image

def generate_icon(size, output_path):
    """Generate a single icon at the given size."""
    # Create base image with gradient circle
    image = create_gradient_circle(size)
    draw = ImageDraw.Draw(image)

    # Calculate font size (60% of icon size)
    font_size = int(size * 0.6)

    # Try to load a font, fall back to default
    try:
        font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", font_size)
    except:
        try:
            font = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", font_size)
        except:
            # Use default font
            font = ImageFont.load_default()

    # Draw "P" in the center
    text = "P"

    # Get text bounding box
    bbox = draw.textbbox((0, 0), text, font=font)
    text_width = bbox[2] - bbox[0]
    text_height = bbox[3] - bbox[1]

    # Calculate position to center text
    text_x = (size - text_width) // 2 - bbox[0]
    text_y = (size - text_height) // 2 - bbox[1]

    # Draw text
    draw.text((text_x, text_y), text, fill=TEXT_COLOR, font=font)

    # Save
    image.save(output_path, 'PNG')
    print(f"Generated {output_path}")

def main():
    """Generate all icon sizes."""
    # Ensure icons directory exists
    icons_dir = os.path.join(os.path.dirname(__file__), 'icons')
    os.makedirs(icons_dir, exist_ok=True)

    # Generate each size
    for size in SIZES:
        output_path = os.path.join(icons_dir, f'icon{size}.png')
        generate_icon(size, output_path)

    print("\n✓ All icons generated successfully!")
    print(f"  Location: {icons_dir}")
    print(f"  Files: {', '.join([f'icon{s}.png' for s in SIZES])}")

if __name__ == '__main__':
    main()
