# backend/layout_engine.py

def generate_layout(photos, canvas_width=595, canvas_height=842):
    """
    Returns a list of calculated positions for the photos.
    This is a Rule-Based AI: It adapts based on the count.
    """
    count = len(photos)
    layout_data = []
    
    # Margin and Padding
    margin = 40
    gap = 20
    
    # Available drawing area
    draw_width = canvas_width - (2 * margin)
    draw_height = canvas_height - (2 * margin)

    # --- LAYOUT LOGIC ---
    
    # SCENARIO 1: Single Photo (Hero Shot)
    if count == 1:
        layout_data.append({
            "url": photos[0]["image_url"],
            "left": margin,
            "top": margin,
            "width": draw_width,
            "height": draw_width * 0.75 # 4:3 Aspect Ratio
        })

    # SCENARIO 2: Two Photos (Split Vertical)
    elif count == 2:
        img_height = (draw_height - gap) / 2
        for i, photo in enumerate(photos):
            layout_data.append({
                "url": photo["image_url"],
                "left": margin,
                "top": margin + (i * (img_height + gap)),
                "width": draw_width,
                "height": img_height
            })

    # SCENARIO 3: Four Photos (2x2 Grid)
    elif count == 4:
        box_width = (draw_width - gap) / 2
        box_height = box_width # Square
        
        # Grid positions: (0,0), (1,0), (0,1), (1,1)
        positions = [(0,0), (1,0), (0,1), (1,1)]
        
        for i, photo in enumerate(photos):
            col, row = positions[i]
            layout_data.append({
                "url": photo["image_url"],
                "left": margin + (col * (box_width + gap)),
                "top": margin + (row * (box_height + gap)),
                "width": box_width,
                "height": box_height
            })

    # SCENARIO 4: Default (Masonry / Simple Stack for 3, 5, or more)
    else:
        # Just stack them nicely with a max height
        current_y = margin
        fixed_height = 200
        
        for photo in photos:
            # Stop if we run off the page
            if current_y + fixed_height > canvas_height: break
            
            layout_data.append({
                "url": photo["image_url"],
                "left": margin,
                "top": current_y,
                "width": draw_width,
                "height": fixed_height
            })
            current_y += fixed_height + gap

    return layout_data