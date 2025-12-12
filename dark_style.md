I want you to use the following Design System for the UI generation.

Theme Name: Gilded Luxury
Vibe & Description: Sophisticated dark mode with gold accents.

### CSS Variables
```css
:root {
  --color-primary: #d4af37;
  --color-secondary: #262626;
  --color-accent: #f3e5ab;
  --color-background: #0a0a0a;
  --color-surface: #171717;
  --color-text: #e5e5e5;
  --color-muted: #525252;
  --color-success: #d4af37;
  --color-warning: #fcd34d;
  --color-error: #991b1b;
  --color-info: #e5e5e5;
  --font-heading: "Merriweather", serif;
  --font-body: "Outfit", sans-serif;
  --radius: 0.25rem;
  --border-width: 1px;
}
```

### Theme Configuration (JSON)
```json
{
  "id": "luxury-gold",
  "name": "Gilded Luxury",
  "description": "Sophisticated dark mode with gold accents.",
  "colors": {
    "primary": "#d4af37",
    "secondary": "#262626",
    "accent": "#f3e5ab",
    "background": "#0a0a0a",
    "surface": "#171717",
    "text": "#e5e5e5",
    "muted": "#525252",
    "success": "#d4af37",
    "warning": "#fcd34d",
    "error": "#991b1b",
    "info": "#e5e5e5"
  },
  "typography": {
    "headingFont": "\"Merriweather\", serif",
    "bodyFont": "\"Outfit\", sans-serif",
    "scale": "medium"
  },
  "ui": {
    "borderRadius": "0.25rem",
    "borderWidth": "1px",
    "shadow": "2xl"
  }
}
```
