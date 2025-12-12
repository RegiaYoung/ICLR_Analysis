I want you to use the following Design System for the UI generation.

Theme Name: The Workspace
Vibe & Description: Inspired by Notion. Stark black & white, serif headers, utilitarian.

### CSS Variables
```css
:root {
  --color-primary: #37352f;
  --color-secondary: #9b9a97;
  --color-accent: #e16259;
  --color-background: #ffffff;
  --color-surface: #f7f6f3;
  --color-text: #37352f;
  --color-muted: #9b9a97;
  --color-success: #0f7b6c;
  --color-warning: #d9730d;
  --color-error: #df5452;
  --color-info: #0b6e99;
  --font-heading: "Merriweather", serif;
  --font-body: "Inter", sans-serif;
  --radius: 0.375rem;
  --border-width: 1px;
}
```

### Theme Configuration (JSON)
```json
{
  "id": "tech-productivity",
  "name": "The Workspace",
  "description": "Inspired by Notion. Stark black & white, serif headers, utilitarian.",
  "colors": {
    "primary": "#37352f",
    "secondary": "#9b9a97",
    "accent": "#e16259",
    "background": "#ffffff",
    "surface": "#f7f6f3",
    "text": "#37352f",
    "muted": "#9b9a97",
    "success": "#0f7b6c",
    "warning": "#d9730d",
    "error": "#df5452",
    "info": "#0b6e99"
  },
  "typography": {
    "headingFont": "\"Merriweather\", serif",
    "bodyFont": "\"Inter\", sans-serif",
    "scale": "medium"
  },
  "ui": {
    "borderRadius": "0.375rem",
    "borderWidth": "1px",
    "shadow": "sm"
  }
}
```
