# Logo Setup

To add your custom logo to the printer monitor:

1. **Create or obtain your logo image** (PNG, JPG, or SVG format recommended)
2. **Name it `logo.png`** (or update the path in `public/index.html` if using a different name)
3. **Copy it to the `public/` directory**

```bash
cp /path/to/your/logo.png public/logo.png
```

## Logo Specifications

- **Recommended height**: 50px (width will scale automatically)
- **Recommended format**: PNG with transparent background
- **Supported formats**: PNG, JPG, SVG, WebP

## Example

If your logo file is named differently or in a subdirectory:

Edit `public/index.html` line 12:

```html
<img src="/logo.png" alt="Logo" class="header-logo" id="header-logo">
```

Change to:

```html
<img src="/images/my-custom-logo.svg" alt="Logo" class="header-logo" id="header-logo">
```

## No Logo?

If no logo file is present, the header will display just the title "3D Printer Monitor" - the logo space will remain hidden.
